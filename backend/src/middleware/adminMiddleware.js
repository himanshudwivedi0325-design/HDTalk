/**
 * Admin Authorization Middleware for HDTalk
 * Verifies that the authenticated user possesses administrator rights.
 */
module.exports = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const cleanEmail = (req.user.email || '').toLowerCase().trim();
  const isAdmin = 
    req.user.role === 'admin' || 
    cleanEmail === 'shikhar@gmail.com' || 
    cleanEmail === 'himanshudwivedi0325@gmail.com';

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Administrator privileges required.'
    });
  }

  next();
};
