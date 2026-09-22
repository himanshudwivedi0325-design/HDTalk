/**
 * Admin Authorization Middleware for HDTalk
 * Verifies that the authenticated user possesses administrator rights.
 */
const { isAdminUser } = require('../config/adminHelper');

module.exports = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  if (!isAdminUser(req.user)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Administrator privileges required.'
    });
  }

  next();
};
