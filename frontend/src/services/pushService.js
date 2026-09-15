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

export const subscribeToPush = async (token) => {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser.');
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
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ subscription })
  });

  const subData = await subRes.json();
  if (!subData.success) {
    throw new Error(subData.message || 'Failed to save subscription on server.');
  }

  return { success: true, subscription };
};

export const sendTestPushNotification = async (token) => {
  const res = await fetch(`${API_URL}/api/push/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  return res.json();
};
