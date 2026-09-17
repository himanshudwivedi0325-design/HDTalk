/**
 * HDTalk - Distributed Rate Limiter with MongoDB Store & Memory Fallback
 * Designed for Multi-Instance Deployments (Render / Containers)
 */

const { rateLimit } = require('express-rate-limit');
const mongoAdapter = require('../database/mongoAdapter');

class MongoRateLimitStore {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60 * 1000;
    this.localHits = new Map();
  }

  init(options) {
    if (options && options.windowMs) {
      this.windowMs = options.windowMs;
    }
  }

  localFallback(key, now) {
    let entry = this.localHits.get(key);
    if (!entry || entry.resetTime < now) {
      entry = { totalHits: 1, resetTime: new Date(now + this.windowMs) };
    } else {
      entry.totalHits += 1;
    }
    this.localHits.set(key, entry);
    return {
      totalHits: entry.totalHits,
      resetTime: entry.resetTime
    };
  }

  async increment(key) {
    const now = Date.now();
    const resetTime = new Date(now + this.windowMs);
    const db = mongoAdapter.getDbInstance();

    if (!db || !mongoAdapter.isConnected()) {
      return this.localFallback(key, now);
    }

    try {
      const coll = db.collection('rateLimits');
      const doc = await coll.findOneAndUpdate(
        { key },
        {
          $inc: { totalHits: 1 },
          $setOnInsert: { createdAt: new Date(now), resetTime }
        },
        { upsert: true, returnDocument: 'after' }
      );

      const resDoc = doc?.value || doc;
      if (resDoc && resDoc.resetTime && new Date(resDoc.resetTime).getTime() < now) {
        await coll.updateOne(
          { key },
          { $set: { totalHits: 1, resetTime, createdAt: new Date(now) } }
        );
        return { totalHits: 1, resetTime };
      }

      return {
        totalHits: resDoc ? resDoc.totalHits : 1,
        resetTime: resDoc?.resetTime ? new Date(resDoc.resetTime) : resetTime
      };
    } catch (_) {
      return this.localFallback(key, now);
    }
  }

  async decrement(key) {
    const db = mongoAdapter.getDbInstance();
    if (db && mongoAdapter.isConnected()) {
      try {
        await db.collection('rateLimits').updateOne({ key }, { $inc: { totalHits: -1 } });
      } catch (_) {}
    } else {
      const entry = this.localHits.get(key);
      if (entry && entry.totalHits > 0) {
        entry.totalHits -= 1;
      }
    }
  }

  async resetKey(key) {
    const db = mongoAdapter.getDbInstance();
    if (db && mongoAdapter.isConnected()) {
      try {
        await db.collection('rateLimits').deleteOne({ key });
      } catch (_) {}
    } else {
      this.localHits.delete(key);
    }
  }
}

/**
 * Creates a rate limiter middleware that uses MongoDB in production clusters
 * and transparently falls back to synchronous in-memory sliding window when
 * MongoDB is not connected (e.g. unit tests or offline local development).
 */
function createDistributedLimiter({ windowMs, max, message, keyGenerator }) {
  const mongoLimiter = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    store: new MongoRateLimitStore({ windowMs }),
    keyGenerator,
    handler: (req, res, next, options) => {
      res.status(options.statusCode || 429).json(options.message);
    },
    message: {
      success: false,
      message: typeof message === 'string' ? message : (message?.message || 'Too many requests, please try again later.')
    }
  });

  const memoryHits = new Map();

  return function rateLimiter(req, res, next) {
    if (mongoAdapter.isConnected()) {
      return mongoLimiter(req, res, next);
    }

    // Synchronous memory sliding-window fallback
    const key = keyGenerator
      ? keyGenerator(req)
      : (req.user?.id || req.ip || req.headers?.['x-forwarded-for'] || 'unknown');

    const now = Date.now();
    let timestamps = memoryHits.get(key) || [];
    timestamps = timestamps.filter(t => now - t < windowMs);

    if (timestamps.length >= max) {
      const oldest = timestamps[0];
      const retryAfterSec = Math.ceil((windowMs - (now - oldest)) / 1000);
      if (typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', retryAfterSec);
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', 0);
      }
      return res.status(429).json({
        success: false,
        message: typeof message === 'string' ? message : (message?.message || 'Too many requests, please try again later.'),
        retryAfter: retryAfterSec
      });
    }

    timestamps.push(now);
    memoryHits.set(key, timestamps);

    if (typeof res.setHeader === 'function') {
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - timestamps.length));
    }

    return next();
  };
}

// 1. Strict Limiter for Auth endpoints: /api/auth/login, /register, /password-reset
// Limit: 5 requests / 15 min per IP + per email
const authLimiter = createDistributedLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    const ip = req.ip || req.headers?.['x-forwarded-for'] || 'unknown';
    return email ? `auth:${ip}:${email}` : `auth:${ip}`;
  },
  message: 'Too many authentication attempts. Please try again after 15 minutes.'
});

// 2. Dedicated Limiter for heavy operations: /api/n8n/ask and file uploads
// Limit: 10 requests / 10 min
const heavyLimiter = createDistributedLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const userOrIp = req.user?.id || req.ip || req.headers?.['x-forwarded-for'] || 'unknown';
    return `heavy:${userOrIp}`;
  },
  message: 'Too many requests. Please try again after 10 minutes.'
});

// 3. General Authenticated API Limiter
// Limit: 100 requests / min per user
const apiLimiter = createDistributedLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => {
    const userOrIp = req.user?.id || req.ip || req.headers?.['x-forwarded-for'] || 'unknown';
    return `api:${userOrIp}`;
  },
  message: 'Too many requests. Please slow down.'
});

module.exports = {
  authLimiter,
  apiLimiter,
  uploadLimiter: heavyLimiter,
  n8nAskLimiter: heavyLimiter,
  MongoRateLimitStore,
  createDistributedLimiter
};
