const express = require('express');
const router = express.Router();
const config = require('../config/config');
const db = require('../database/db');
const pushService = require('../services/pushNotificationService');
const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { pushSchemas } = require('../validation/schemas');

// Public: Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
  res.json({
    success: true,
    publicKey: config.VAPID_PUBLIC_KEY
  });
});

// Authenticated: Subscribe device
router.post('/subscribe', authMiddleware, validate(pushSchemas.subscribe), (req, res) => {
  try {
    const { subscription } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    db.savePushSubscription(req.user.id, subscription, userAgent);

    res.json({
      success: true,
      message: 'Push subscription saved successfully.'
    });
  } catch (err) {
    console.error('Error saving push subscription:', err);
    res.status(500).json({ success: false, message: 'Failed to save push subscription.' });
  }
});

// Authenticated: Unsubscribe device
router.post('/unsubscribe', authMiddleware, validate(pushSchemas.unsubscribe), (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ success: false, message: 'Endpoint must be a non-empty string.' });
    }

    db.removePushSubscription(endpoint, req.user.id);
    res.json({ success: true, message: 'Push subscription removed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove push subscription.' });
  }
});

// Authenticated: Send test push notification to user's registered devices
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const result = await pushService.sendPushToUser(req.user.id, {
      title: '⚡ HDTalk Notification Test',
      body: 'Web Push Notifications are working! You will receive calls & messages even when phone screen is locked.',
      icon: '/hdtalk-logo.jpg',
      badge: '/hdtalk-logo.jpg',
      tag: 'test-notification',
      data: { url: '/' }
    });

    res.json({
      success: true,
      message: `Sent test notification to ${result.sent} of ${result.total} registered devices.`,
      details: result
    });
  } catch (err) {
    console.error('[Push] Test notification error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send test push notification.' });
  }
});

module.exports = router;
