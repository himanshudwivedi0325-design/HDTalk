const API_URL = import.meta.env.VITE_API_URL || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const isPushSupported = () => {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
};

export const getPermissionState = () => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
};

export const registerServiceWorker = async () => {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('[PushService] Service Worker registered:', registration.scope);
    return registration;
  } catch (err) {
    console.warn('[PushService] Service Worker registration error:', err);
    return null;
  }
};

const getAuthToken = (explicitToken) => {
  if (explicitToken && explicitToken !== 'undefined' && explicitToken !== 'null' && typeof explicitToken === 'string') {
    return explicitToken;
  }
  const sessionToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('chatz_token') : null;
  if (sessionToken && sessionToken !== 'undefined' && sessionToken !== 'null') {
    return sessionToken;
  }
  const localToken = typeof localStorage !== 'undefined' ? localStorage.getItem('chatz_token') : null;
  if (localToken && localToken !== 'undefined' && localToken !== 'null') {
    return localToken;
  }
  return null;
};

export const subscribeToPush = async (token) => {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  const authToken = getAuthToken(token);
  if (!authToken) {
    throw new Error('Authentication session not found. Please log in to HDTalk.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied or dismissed.');
  }

  const registration = await registerServiceWorker();
  if (!registration) {
    throw new Error('Failed to register background Service Worker.');
  }

  // Fetch server VAPID public key
  const res = await fetch(`${API_URL}/api/push/vapid-public-key`);
  const data = await res.json();
  if (!data.success || !data.publicKey) {
    throw new Error('Could not retrieve VAPID public key from server.');
  }

  const applicationServerKey = urlBase64ToUint8Array(data.publicKey);

  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    // Check if subscription was created with the previous/different VAPID key
    try {
      const currentKey = subscription.options && subscription.options.applicationServerKey
        ? new Uint8Array(subscription.options.applicationServerKey)
        : null;
      let matches = false;
      if (currentKey && currentKey.length === applicationServerKey.length) {
        matches = currentKey.every((byte, idx) => byte === applicationServerKey[idx]);
      }
      if (!matches) {
        console.log('[PushService] VAPID key rotation detected. Unsubscribing old key and re-subscribing...');
        await subscription.unsubscribe();
        subscription = null;
      }
    } catch (err) {
      console.warn('[PushService] Key check warning, resetting subscription:', err);
      await subscription.unsubscribe().catch(() => {});
      subscription = null;
    }
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
  }

  // Register subscription on backend
  const subRes = await fetch(`${API_URL}/api/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ subscription })
  });

  const subData = await subRes.json();
  if (!subRes.ok || !subData.success) {
    throw new Error(subData.message || 'Failed to save subscription on server.');
  }

  return { success: true, subscription };
};

export const sendTestPushNotification = async (token) => {
  const authToken = getAuthToken(token);
  if (!authToken) {
    throw new Error('Authentication session not found. Please log in to HDTalk.');
  }

  const res = await fetch(`${API_URL}/api/push/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to send test push alert.');
  }
  return data;
};
