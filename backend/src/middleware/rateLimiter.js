/**
 * HDTalk - In-Memory Sliding Window Rate Limiter Middleware
 * Created with ❤️ by Himanshu Dwivedi
 * 
 * Protects against brute-force attacks and resource exhaustion without external Redis dependencies.
 */

function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // default 1 minute
  const max = options.max || 60; // default 60 requests per window
  const message = options.message || 'Too many requests from this IP, please try again later.';
  
  // Storage for request timestamps: ip -> Array of timestamps
  const hits = new Map();

  // Periodic cleanup of stale entries to prevent memory leak
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits.entries()) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, valid);
      }
    }
  }, Math.max(windowMs, 30000));

  // Ensure interval does not prevent Node process from exiting
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return function rateLimiter(req, res, next) {
    // Respect reverse proxy headers if available, or fall back to connection remoteAddress
    const ip = req.headers['x-forwarded-for'] 
      ? req.headers['x-forwarded-for'].split(',')[0].trim() 
      : req.socket.remoteAddress || req.ip || 'unknown';

    const now = Date.now();
    const timestamps = hits.get(ip) || [];
    
    // Filter timestamps within current window
    const recent = timestamps.filter(t => now - t < windowMs);

    if (recent.length >= max) {
      const oldest = recent[0];
      const retryAfterSec = Math.ceil((windowMs - (now - oldest)) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json({
        success: false,
        message,
        retryAfter: retryAfterSec
      });
    }

    recent.push(now);
    hits.set(ip, recent);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - recent.length));
    next();
  };
}

module.exports = {
  createRateLimiter,
  // Strict limiter for authentication endpoints (brute-force protection)
  authLimiter: createRateLimiter({
    windowMs: 60 * 1000,
    max: 20,
    message: 'Too many authentication attempts. Please try again after 1 minute.'
  }),
  // Limiter for AI queries & chatbots
  aiLimiter: createRateLimiter({
    windowMs: 60 * 1000,
    max: 20,
    message: 'Too many AI queries. Please slow down and try again in 1 minute.'
  }),
  // General API limiter for all other routes
  apiLimiter: createRateLimiter({
    windowMs: 60 * 1000,
    max: 300,
    message: 'Too many requests. Please slow down.'
  }),
  // Strict limiter for file upload endpoints
  uploadLimiter: createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many upload attempts. Please slow down.'
  })
};

