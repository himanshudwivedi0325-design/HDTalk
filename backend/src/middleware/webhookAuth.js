const crypto = require('crypto');
const config = require('../config/config');

/**
 * Replay-resistant HMAC-SHA256 signature verification middleware for n8n webhooks.
 *
 * Headers expected:
 * - x-n8n-signature: Hex HMAC-SHA256 hash of the exact raw JSON request body
 * - x-n8n-timestamp: Timestamp of the request (reject if > 5 minutes old)
 */
module.exports = function webhookAuth(req, res, next) {
  const secret = process.env.N8N_WEBHOOK_SECRET || config.N8N_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhookAuth] N8N_WEBHOOK_SECRET is not configured on the server.');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error: Webhook secret is not configured.'
    });
  }

  const signatureHeader = req.headers['x-n8n-signature'] || req.headers['x-signature'];
  if (!signatureHeader) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing x-n8n-signature header.'
    });
  }

  const timestampHeader = req.headers['x-n8n-timestamp'] || req.headers['x-timestamp'];
  if (!timestampHeader) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing x-n8n-timestamp header.'
    });
  }

  // Verify timestamp is within 5 minutes (300,000 ms) to prevent replay attacks
  let requestTime = Number(timestampHeader);
  if (isNaN(requestTime)) {
    requestTime = Date.parse(timestampHeader);
  }
  // If timestamp was provided in seconds (unix timestamp), convert to milliseconds
  if (requestTime > 0 && requestTime < 10000000000) {
    requestTime = requestTime * 1000;
  }

  const now = Date.now();
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  if (isNaN(requestTime) || Math.abs(now - requestTime) > FIVE_MINUTES_MS) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Webhook timestamp is expired or outside the permitted 5-minute window.'
    });
  }

  // Obtain raw payload bytes (works with express.raw() or express.json({ verify }))
  let rawBuffer;
  if (Buffer.isBuffer(req.body)) {
    rawBuffer = req.body;
  } else if (Buffer.isBuffer(req.rawBody)) {
    rawBuffer = req.rawBody;
  } else if (typeof req.body === 'string') {
    rawBuffer = Buffer.from(req.body, 'utf8');
  } else if (req.body && typeof req.body === 'object') {
    rawBuffer = Buffer.from(JSON.stringify(req.body), 'utf8');
  } else {
    rawBuffer = Buffer.from('', 'utf8');
  }

  // Clean signature header (strip optional "sha256=" prefix)
  const receivedSig = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7).trim()
    : signatureHeader.trim();

  // Compute expected HMAC signatures
  // 1. Raw body hash: HMAC-SHA256(rawBody, secret)
  const expectedBodySig = crypto
    .createHmac('sha256', secret)
    .update(rawBuffer)
    .digest('hex');

  // 2. Timestamp + Body hash: HMAC-SHA256(`${timestamp}.${rawBody}`, secret)
  const expectedTimestampBodySig = crypto
    .createHmac('sha256', secret)
    .update(`${timestampHeader}.${rawBuffer.toString('utf8')}`)
    .digest('hex');

  const safeCompare = (sigA, sigB) => {
    if (typeof sigA !== 'string' || typeof sigB !== 'string') return false;
    const bufA = Buffer.from(sigA.toLowerCase(), 'utf8');
    const bufB = Buffer.from(sigB.toLowerCase(), 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  };

  const isMatch = safeCompare(receivedSig, expectedBodySig) || safeCompare(receivedSig, expectedTimestampBodySig);
  if (!isMatch) {
    console.warn('[webhookAuth] Webhook HMAC signature verification failed');
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid webhook signature.'
    });
  }

  // Preserve rawBody and parse JSON body for downstream handlers if it was a Buffer
  req.rawBody = rawBuffer;
  if (Buffer.isBuffer(req.body)) {
    try {
      req.body = JSON.parse(rawBuffer.toString('utf8'));
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON payload format.'
      });
    }
  }

  next();
};
