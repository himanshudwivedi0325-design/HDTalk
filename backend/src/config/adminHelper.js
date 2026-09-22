/**
 * HDTalk — Platform Creator & Admin Role Helper
 *
 * Centralized helper to avoid hardcoded email comparisons scattered across files.
 * Configure platform creator emails via PLATFORM_CREATOR_EMAILS env var (comma-separated).
 */

// Load creator emails from env — defaults to Himanshu's email if not set
const PLATFORM_CREATOR_EMAILS = new Set(
  (process.env.PLATFORM_CREATOR_EMAILS || 'himanshudwivedi0325@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
);

/**
 * Returns true if the given email belongs to a platform creator.
 * @param {string} email
 * @returns {boolean}
 */
function isPlatformCreator(email) {
  if (!email || typeof email !== 'string') return false;
  return PLATFORM_CREATOR_EMAILS.has(email.trim().toLowerCase());
}

/**
 * Returns true if the given user object has admin rights.
 * Checks both role field and platform creator email.
 * @param {object} user
 * @returns {boolean}
 */
function isAdminUser(user) {
  if (!user) return false;
  return user.role === 'admin' || isPlatformCreator(user.email);
}

/**
 * Returns the Set of platform creator emails (read-only copy).
 * @returns {Set<string>}
 */
function getCreatorEmails() {
  return new Set(PLATFORM_CREATOR_EMAILS);
}

module.exports = { isPlatformCreator, isAdminUser, getCreatorEmails };
