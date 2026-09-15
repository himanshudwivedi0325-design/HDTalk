const webpush = require('web-push');
const config = require('../config/config');
const db = require('../database/db');

try {
  if (config.VAPID_EMAIL && config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      config.VAPID_EMAIL,
      config.VAPID_PUBLIC_KEY,
      config.VAPID_PRIVATE_KEY
    );
    console.log('[WebPush] VAPID details configured successfully.');
  }
} catch (err) {
  console.warn('[WebPush] VAPID configuration warning:', err.message);
}

const sendPushToUser = async (userId, payload) => {
  try {
    const subscriptions = db.getPushSubscriptionsForUser(userId);
    if (!subscriptions || subscriptions.length === 0) {
      return { sent: 0, total: 0 };
    }

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const promises = subscriptions.map(async (subRecord) => {
      try {
        await webpush.sendNotification(subRecord.subscription, payloadString, {
          TTL: 60 * 60 // 1 hour
        });
        return { success: true, endpoint: subRecord.subscription.endpoint };
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[WebPush] Pruning expired push subscription for user ${userId}`);
          db.removePushSubscription(subRecord.subscription.endpoint);
        } else {
          console.warn(`[WebPush] Notification dispatch failed (${err.statusCode || 'err'}):`, err.message);
        }
        return { success: false, error: err.message };
      }
    });

    const results = await Promise.all(promises);
    const sent = results.filter(r => r.success).length;
    return { sent, total: subscriptions.length };
  } catch (err) {
    console.error('[WebPush] sendPushToUser error:', err);
    return { sent: 0, error: err.message };
  }
};

const notifyIncomingCall = async ({ targetUserId, callerName, callType, callerAvatar }) => {
  return sendPushToUser(targetUserId, {
    title: `📞 Incoming ${callType === 'video' ? 'HD Video' : 'Voice'} Call!`,
    body: `${callerName || 'Someone'} is calling you on HDTalk. Tap to answer!`,
    icon: callerAvatar || '/hdtalk-logo.jpg',
    badge: '/hdtalk-logo.jpg',
    vibrate: [600, 250, 600, 250, 1000],
    tag: 'incoming-call',
    renotify: true,
    requireInteraction: true,
    data: {
      type: 'incoming_call',
      callType: callType || 'video',
      callerName: callerName || 'Someone',
      url: '/'
    }
  });
};

const notifyNewMessage = async ({ recipientId, senderName, text, type, conversationId, senderAvatar }) => {
  let previewText = text;
  if (type === 'image') previewText = '📷 Sent a photo';
  else if (type === 'voice') previewText = '🎤 Sent a voice note';
  else if (type === 'file') previewText = '📎 Sent an attachment';

  return sendPushToUser(recipientId, {
    title: `${senderName || 'HDTalk Message'}`,
    body: previewText || 'Sent you a new message',
    icon: senderAvatar || '/hdtalk-logo.jpg',
    badge: '/hdtalk-logo.jpg',
    vibrate: [300, 100, 300],
    tag: `conv-${conversationId || 'default'}`,
    renotify: true,
    data: {
      type: 'new_message',
      conversationId,
      url: '/'
    }
  });
};

const notifyFriendRequest = async ({ recipientId, senderName, senderAvatar }) => {
  return sendPushToUser(recipientId, {
    title: '👋 New Connection Request!',
    body: `${senderName || 'Someone'} sent you a connection request on HDTalk.`,
    icon: senderAvatar || '/hdtalk-logo.jpg',
    badge: '/hdtalk-logo.jpg',
    vibrate: [300, 100, 300],
    tag: 'friend-request',
    renotify: true,
    data: {
      type: 'friend_request',
      url: '/'
    }
  });
};

module.exports = {
  sendPushToUser,
  notifyIncomingCall,
  notifyNewMessage,
  notifyFriendRequest
};
