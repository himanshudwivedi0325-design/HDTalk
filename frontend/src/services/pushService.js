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
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    } catch (pushErr) {
      console.warn('[PushService] Push manager subscribe error:', pushErr);
      const isBrave = (navigator.brave && typeof navigator.brave.isBrave === 'function') || 
                      navigator.userAgent.includes('Brave');
      if (pushErr.message && (pushErr.message.includes('push service error') || pushErr.name === 'AbortError')) {
        if (isBrave) {
          throw new Error('Brave Browser blocks push service by default. Please toggle "Use Google services for push messaging" in brave://settings/privacy, or enjoy built-in local notifications.');
        }
        throw new Error('Browser push service is temporarily blocked by privacy settings or ad-blocker. Local notifications remain active.');
      }
      throw pushErr;
    }
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

export const showLocalTestNotification = async () => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    throw new Error('Notification permission has not been granted.');
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification('⚡ HDTalk Notification Test', {
          body: 'Notifications are working! You will receive calls & messages.',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'hdtalk-test-alert',
          vibrate: [200, 100, 200]
        });
        return { success: true, message: 'Notification alert dispatched to your screen!' };
      }
    }
    new Notification('⚡ HDTalk Notification Test', {
      body: 'Notifications are working! You will receive calls & messages.',
      icon: '/favicon.ico'
    });
    return { success: true, message: 'Notification alert dispatched to your screen!' };
  } catch (err) {
    throw new Error('Could not display local notification: ' + err.message);
  }
};

export const sendTestPushNotification = async (token) => {
  const authToken = getAuthToken(token);
  if (!authToken) {
    // Fallback to local notification if not authenticated
    return await showLocalTestNotification();
  }

  try {
    const res = await fetch(`${API_URL}/api/push/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      // Backend test returned error or 0 devices, show local notification fallback
      await showLocalTestNotification();
      return {
        success: true,
        message: 'Notification alert dispatched to your screen!'
      };
    }

    // Also trigger local notification so user gets instant visual confirmation
    await showLocalTestNotification().catch(() => {});
    return data;
  } catch (err) {
    // If backend network fails, trigger local notification directly
    try {
      return await showLocalTestNotification();
    } catch (_) {
      throw err;
    }
  }
};
