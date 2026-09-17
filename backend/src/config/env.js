const path = require('path');
const dotenv = require('dotenv');

// Load .env from root and backend directory if present
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const REQUIRED_ENV_VARS = [
  'JWT_SECRET'
];

// If VAPID keys are missing, generate valid keys automatically so WebPush functions without crashing
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  try {
    const webpush = require('web-push');
    const autoKeys = webpush.generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || autoKeys.publicKey;
    process.env.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || autoKeys.privateKey;
    console.log('[Config] VAPID keys auto-configured for background push notifications.');
  } catch (e) {
    console.warn('[Config] Could not auto-generate VAPID keys:', e.message);
  }
}

function validateEnv() {
  const isTest = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('test'));

  if (isTest) {
    // Inject mock environment variables for unit test runners
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_unit_tests_only_32_chars';
    process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hdtalk_test';
    process.env.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'test_vapid_public_key';
    process.env.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'test_vapid_private_key';
    process.env.N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || 'test_n8n_webhook_secret_32_chars';
    return true;
  }

  const missing = REQUIRED_ENV_VARS.filter(key => {
    const val = process.env[key];
    return !val || typeof val !== 'string' || val.trim() === '';
  });

  if (missing.length > 0) {
    console.error('================================================================');
    console.error('❌ [FATAL CONFIG ERROR] Missing required environment variable(s):');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nAll required secrets must be provided via environment variables.');
    console.error('No default fallback strings are permitted.');
    console.error('Refer to .env.example for required keys and setup.');
    console.error('================================================================');
    process.exit(1);
  }

  return true;
}

// Run validation immediately on module load (fail-fast on startup)
validateEnv();

module.exports = {
  validateEnv,
  REQUIRED_ENV_VARS
};
