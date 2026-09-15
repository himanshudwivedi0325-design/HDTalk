const express = require('express');
const router = express.Router();
const config = require('../config/config');

/**
 * GET /api/webrtc/config
 * Returns STUN/TURN ICE server configuration and mesh constraints.
 */
router.get('/config', (req, res) => {
  const iceServers = [];

  // Add STUN servers
  if (config.STUN_SERVERS && config.STUN_SERVERS.length > 0) {
    iceServers.push({
      urls: config.STUN_SERVERS
    });
  }

  // Add configured TURN servers (if any configured)
  if (config.TURN_SERVERS && config.TURN_SERVERS.length > 0) {
    config.TURN_SERVERS.forEach(ts => {
      if (ts && ts.urls) {
        iceServers.push(ts);
      }
    });
  }

  res.json({
    success: true,
    iceServers,
    maxMeshParticipants: config.MAX_MESH_PARTICIPANTS || 6,
    hasTurnConfigured: Boolean(config.TURN_SERVERS && config.TURN_SERVERS.length > 0),
    turnStatus: (config.TURN_SERVERS && config.TURN_SERVERS.length > 0) ? 'CONFIGURED' : 'UNCONFIGURED'
  });
});

module.exports = router;
