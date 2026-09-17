const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const webhookAuth = require('../src/middleware/webhookAuth');
const { n8nAskLimiter } = require('../src/middleware/rateLimiter');
const n8nService = require('../src/services/n8nService');

test('Webhook Authentication & Security Suite', async (t) => {
  const secret = 'test_webhook_hmac_secret_key_99887766';
  process.env.N8N_WEBHOOK_SECRET = secret;

  const createMockReqRes = (options = {}) => {
    const headers = options.headers || {};
    const body = options.body !== undefined ? options.body : Buffer.from(JSON.stringify({ text: 'Hello from bot' }));

    const req = {
      headers,
      body,
      rawBody: options.rawBody || (Buffer.isBuffer(body) ? body : undefined)
    };

    let statusCode = 200;
    let responseData = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      },
      getStatusCode: () => statusCode,
      getResponseData: () => responseData
    };

    return { req, res };
  };

  await t.test('Rejects request with missing x-n8n-signature header', async () => {
    const { req, res } = createMockReqRes({
      headers: {
        'x-n8n-timestamp': Date.now().toString()
      }
    });

    let nextCalled = false;
    webhookAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.getStatusCode(), 401);
    assert.match(res.getResponseData().message, /Missing x-n8n-signature/);
  });

  await t.test('Rejects request with missing x-n8n-timestamp header', async () => {
    const { req, res } = createMockReqRes({
      headers: {
        'x-n8n-signature': 'mock_signature'
      }
    });

    let nextCalled = false;
    webhookAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.getStatusCode(), 401);
    assert.match(res.getResponseData().message, /Missing x-n8n-timestamp/);
  });

  await t.test('Rejects replay attack when timestamp is older than 5 minutes', async () => {
    const rawPayload = Buffer.from(JSON.stringify({ conversationId: 'c1', text: 'replay attack' }));
    const expiredTimestamp = Date.now() - (6 * 60 * 1000); // 6 minutes ago
    const sig = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

    const { req, res } = createMockReqRes({
      body: rawPayload,
      headers: {
        'x-n8n-timestamp': expiredTimestamp.toString(),
        'x-n8n-signature': sig
      }
    });

    let nextCalled = false;
    webhookAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.getStatusCode(), 401);
    assert.match(res.getResponseData().message, /expired or outside/i);
  });

  await t.test('Rejects request with forged or invalid HMAC signature', async () => {
    const rawPayload = Buffer.from(JSON.stringify({ conversationId: 'c1', text: 'malicious payload' }));
    const timestamp = Date.now().toString();
    const wrongSig = crypto.createHmac('sha256', 'wrong_secret').update(rawPayload).digest('hex');

    const { req, res } = createMockReqRes({
      body: rawPayload,
      headers: {
        'x-n8n-timestamp': timestamp,
        'x-n8n-signature': wrongSig
      }
    });

    let nextCalled = false;
    webhookAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.getStatusCode(), 401);
    assert.match(res.getResponseData().message, /Invalid webhook signature/i);
  });

  await t.test('Accepts valid HMAC signature and fresh timestamp, properly parsing raw buffer body to JSON', async () => {
    const payloadObj = { conversationId: 'conv_12345', text: 'Verified AI answer' };
    const rawPayload = Buffer.from(JSON.stringify(payloadObj));
    const timestamp = Date.now().toString();
    const validSig = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

    const { req, res } = createMockReqRes({
      body: rawPayload,
      headers: {
        'x-n8n-timestamp': timestamp,
        'x-n8n-signature': validSig
      }
    });

    let nextCalled = false;
    webhookAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(res.getStatusCode(), 200);
    assert.deepEqual(req.body, payloadObj);
    assert.ok(Buffer.isBuffer(req.rawBody));
  });

  await t.test('Accepts valid HMAC signature with sha256= prefix', async () => {
    const payloadObj = { conversationId: 'conv_67890', text: 'Prefixed signature answer' };
    const rawPayload = Buffer.from(JSON.stringify(payloadObj));
    const timestamp = Date.now().toString();
    const validSig = 'sha256=' + crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

    const { req, res } = createMockReqRes({
      body: rawPayload,
      headers: {
        'x-n8n-timestamp': timestamp,
        'x-n8n-signature': validSig
      }
    });

    let nextCalled = false;
    webhookAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.deepEqual(req.body, payloadObj);
  });

  await t.test('n8nAskLimiter throttles after 10 requests per 10 minutes', async () => {
    const testIp = '198.51.100.99';
    let blockedOnIteration = null;

    for (let i = 1; i <= 12; i++) {
      let nextCalled = false;
      let statusCode = 200;
      let responseBody = null;

      const req = {
        headers: { 'x-forwarded-for': testIp },
        socket: {}
      };
      const res = {
        setHeader: () => {},
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (data) => {
          responseBody = data;
          return res;
        }
      };

      n8nAskLimiter(req, res, () => { nextCalled = true; });

      if (!nextCalled && statusCode === 429) {
        blockedOnIteration = i;
        break;
      }
    }

    assert.equal(blockedOnIteration, 11, 'Request #11 must be rate-limited (HTTP 429)');
  });

  await t.test('getN8nStatus does not disclose internal webhookUrl', () => {
    const status = n8nService.getN8nStatus();
    assert.equal(status.webhookUrl, undefined, 'Internal webhookUrl must never be exposed');
    assert.ok(status.mode);
    assert.ok(Array.isArray(status.availableEvents));
  });
});
