const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const config = require('../config/config');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Generate standard ephemeral TURN credentials (RFC 5766 TURN REST API)
 * Valid for 1 hour (3600 seconds)
 */
function generateEphemeralTurnCredentials(secret, userId) {
  const ttl = 3600; // 1 hour in seconds
  const timestamp = Math.floor(Date.now() / 1000) + ttl;
  const username = `${timestamp}:${userId}`;
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(username);
  const password = hmac.digest('base64');
  return { username, credential: password, ttl, expiresAt: new Date(timestamp * 1000).toISOString() };
}

/**
 * GET /api/webrtc/config
 * Requires valid JWT authentication (authMiddleware).
 * Generates short-lived (1 hour) ephemeral TURN credentials for authenticated user session.
 */
router.get('/config', authMiddleware, (req, res) => {
  const iceServers = [];

  // 1. Add STUN servers
  if (config.STUN_SERVERS && config.STUN_SERVERS.length > 0) {
    iceServers.push({
      urls: config.STUN_SERVERS
    });
  }

  // 2. Generate ephemeral TURN credentials
  const turnSecret = process.env.TURN_SECRET || config.TURN_SECRET || null;
  const userId = req.user?.id || 'hdtalk-user';

  if (config.TURN_SERVERS && config.TURN_SERVERS.length > 0) {
    config.TURN_SERVERS.forEach(ts => {
      if (!ts || !ts.urls) return;

      if (turnSecret) {
        const ephemeral = generateEphemeralTurnCredentials(turnSecret, userId);
        iceServers.push({
          urls: ts.urls,
          username: ephemeral.username,
          credential: ephemeral.credential
        });
      } else if (ts.credential) {
        const ephemeral = generateEphemeralTurnCredentials(ts.credential, `${userId}:${ts.username || 'user'}`);
        iceServers.push({
          urls: ts.urls,
          username: ephemeral.username,
          credential: ephemeral.credential
        });
      } else {
        iceServers.push({ urls: ts.urls });
      }
    });
  }

  res.json({
    success: true,
    iceServers,
    maxMeshParticipants: config.MAX_MESH_PARTICIPANTS || 6,
    hasTurnConfigured: Boolean(config.TURN_SERVERS && config.TURN_SERVERS.length > 0),
    turnStatus: (config.TURN_SERVERS && config.TURN_SERVERS.length > 0) ? 'CONFIGURED' : 'UNCONFIGURED',
    ttl: 3600
  });
});

module.exports = router;
