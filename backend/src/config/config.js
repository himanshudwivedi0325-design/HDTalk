const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  PORT: process.env.PORT || 5000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET || 'chatz_ultra_jwt_super_secret_key_2026',
  JWT_EXPIRES_IN: '7d',
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
  DATA_DIR: process.env.DATA_DIR || path.join(__dirname, '../../data'),
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/hdtalk',
  N8N_ENABLED: process.env.N8N_ENABLED !== 'false',
  STUN_SERVERS: process.env.STUN_SERVERS
    ? process.env.STUN_SERVERS.split(',').map(s => s.trim())
    : [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302'
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
          return [{
            urls,
            username: process.env.TURN_USERNAME || '',
            credential: process.env.TURN_CREDENTIAL || ''
          }];
        }
        return [];
      })(),
  MAX_MESH_PARTICIPANTS: 6,
  SSL_KEY_PATH: process.env.SSL_KEY_PATH || null,
  SSL_CERT_PATH: process.env.SSL_CERT_PATH || null,
  SSL_PFX_PATH: process.env.SSL_PFX_PATH || null,
  SSL_PASSPHRASE: process.env.SSL_PASSPHRASE || null
};
