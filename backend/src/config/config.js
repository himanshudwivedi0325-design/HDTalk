const path = require('path');
require('./env');

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',

  // ─── Security Secrets (Validated via env.js - No fallback defaults permitted) ──
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_EMAIL: process.env.VAPID_EMAIL || 'mailto:himanshudwivedi0325@gmail.com',

  // ─── Database ─────────────────────────────────────────────────────────────────
  MONGODB_URI: process.env.MONGODB_URI,

  // ─── Storage Paths ────────────────────────────────────────────────────────────
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
  DATA_DIR: process.env.DATA_DIR || path.join(__dirname, '../../data'),

  // ─── n8n Automation ───────────────────────────────────────────────────────────
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/hdtalk',
  N8N_WEBHOOK_SECRET: process.env.N8N_WEBHOOK_SECRET,
  N8N_ENABLED: process.env.N8N_ENABLED !== 'false',

  // ─── WebRTC ICE Configuration ─────────────────────────────────────────────────
  STUN_SERVERS: process.env.STUN_SERVERS
    ? process.env.STUN_SERVERS.split(',').map(s => s.trim())
    : [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
        'stun:openrelay.metered.ca:80'
      ],

  TURN_SERVERS: process.env.TURN_SERVERS
    ? (() => {
        try {
          return JSON.parse(process.env.TURN_SERVERS);
        } catch (e) {
          console.warn('[Config] Failed to parse TURN_SERVERS JSON:', e.message);
          return [];
        }
      })()
    : (() => {
        const urls = [];
        if (process.env.TURN_URL) urls.push(process.env.TURN_URL);
        if (process.env.TURN_URL_UDP && !urls.includes(process.env.TURN_URL_UDP)) urls.push(process.env.TURN_URL_UDP);
        if (process.env.TURN_URL_TCP && !urls.includes(process.env.TURN_URL_TCP)) urls.push(process.env.TURN_URL_TCP);
        if (process.env.TURN_URL_TLS && !urls.includes(process.env.TURN_URL_TLS)) urls.push(process.env.TURN_URL_TLS);
        if (urls.length > 0) {
          return [{ urls, username: process.env.TURN_USERNAME || '', credential: process.env.TURN_CREDENTIAL || '' }];
        }
        // Public OpenRelay TURN servers fallback for mobile & symmetric NAT traversal
        return [{
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp'
          ],
          username: 'openrelay',
          credential: 'openrelay'
        }];
      })(),

  MAX_MESH_PARTICIPANTS: parseInt(process.env.MAX_MESH_PARTICIPANTS, 10) || 6,

  // ─── SSL / TLS ─────────────────────────────────────────────────────────────────
  SSL_KEY_PATH: process.env.SSL_KEY_PATH || null,
  SSL_CERT_PATH: process.env.SSL_CERT_PATH || null,
  SSL_PFX_PATH: process.env.SSL_PFX_PATH || null,
  SSL_PASSPHRASE: process.env.SSL_PASSPHRASE || null,

  // ─── Feature Flags ─────────────────────────────────────────────────────────────
  ALLOW_QUICK_LOGIN: process.env.ALLOW_QUICK_LOGIN === 'true',
};
