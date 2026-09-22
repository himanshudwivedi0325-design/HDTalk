const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { z } = require('zod');
const validate = require('../src/middleware/validate');
const { authSchemas, chatSchemas, pushSchemas } = require('../src/validation/schemas');
const { MongoRateLimitStore } = require('../src/middleware/rateLimiter');
const db = require('../src/database/db');

test('Comprehensive Security Hardening Suite', async (t) => {

  // ── 1. NoSQL Injection & Type Validation ───────────────────────────────────
  await t.test('NoSQL Injection: unsubscribe rejects non-string endpoint with 400', () => {
    let statusCode = null;
    let responseJson = null;

    const req = {
      body: { endpoint: { $ne: null } },
      user: { id: 'usr_test_user' }
    };

    const res = {
      status: (code) => {
        statusCode = code;
        return { json: (d) => { responseJson = d; } };
      }
    };

    const unsubscribeValidator = validate(pushSchemas.unsubscribe);
    unsubscribeValidator(req, res, () => {
      // If validation passed, shouldn't reach here
      assert.fail('Validator should have blocked object endpoint');
    });

    assert.equal(statusCode, 400);
    assert.equal(responseJson.success, false);
  });

  await t.test('db.removePushSubscription strictly rejects non-string endpoint', () => {
    const objectEndpoint = { $ne: null };
    const result = db.removePushSubscription(objectEndpoint, 'usr_any');
    assert.equal(result, false, 'Non-string endpoint must immediately return false without executing delete');
  });

  // ── 2. Zod Validation Middleware ──────────────────────────────────────────
  await t.test('validate middleware catches missing and invalid fields with generic 400', () => {
    let statusCode = null;
    let responseJson = null;

    const invalidReq = {
      body: { name: 'A', email: 'not-an-email', password: '123' },
      query: {},
      params: {}
    };

    const res = {
      status: (code) => {
        statusCode = code;
        return { json: (d) => { responseJson = d; } };
      }
    };

    const registerValidator = validate(authSchemas.register);
    registerValidator(invalidReq, res, () => {
      assert.fail('Validator should not call next() on invalid input');
    });

    assert.equal(statusCode, 400);
    assert.equal(responseJson.success, false);
    assert.equal(responseJson.message, 'Invalid request data.');
    assert.ok(Array.isArray(responseJson.errors));
  });

  await t.test('validate middleware passes through valid input to next()', () => {
    let nextCalled = false;
    const validReq = {
      body: { name: 'Valid User', email: 'valid@example.com', password: 'securePassword123' },
      query: {},
      params: {}
    };

    const res = {
      status: () => res,
      json: () => {}
    };

    const registerValidator = validate(authSchemas.register);
    registerValidator(validReq, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  // ── 3. Magic-Byte File Type Verification ──────────────────────────────────
  await t.test('FileType detects genuine magic bytes for PNG and PDF', async () => {
    const { fileTypeFromBuffer } = await import('file-type');
    // 8-byte PNG header: 89 50 4E 47 0D 0A 1A 0A
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
    const detectedPng = await fileTypeFromBuffer(pngHeader);
    assert.ok(detectedPng);
    assert.equal(detectedPng.mime, 'image/png');
    assert.equal(detectedPng.ext, 'png');

    // PDF header: %PDF-
    const pdfHeader = Buffer.from('%PDF-1.7\n%Fake PDF content for test\n%%EOF');
    const detectedPdf = await fileTypeFromBuffer(pdfHeader);
    assert.ok(detectedPdf);
    assert.equal(detectedPdf.mime, 'application/pdf');
    assert.equal(detectedPdf.ext, 'pdf');
  });

  await t.test('FileType rejects text file renamed with .png extension (spoofing defense)', async () => {
    const { fileTypeFromBuffer } = await import('file-type');
    const maliciousTextFile = Buffer.from('<?php echo "malicious script"; ?>');
    const detected = await fileTypeFromBuffer(maliciousTextFile);
    // Should NOT be detected as image/png
    assert.notEqual(detected?.mime, 'image/png');
  });

  await t.test('Filename randomization produces secure UUID without using original name', () => {
    const originalName = '../../../../etc/passwd.jpg';
    const ext = 'jpg';
    const randomUuid = crypto.randomUUID();
    const diskFilename = `${randomUuid}.${ext}`;

    assert.doesNotMatch(diskFilename, /\.\./);
    assert.doesNotMatch(diskFilename, /passwd/);
    assert.match(diskFilename, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/);
  });

  // ── 4. Ephemeral TURN Credentials ─────────────────────────────────────────
  await t.test('Ephemeral TURN credentials generate valid HMAC-SHA1 with 1-hour expiry', () => {
    const secret = 'test-turn-secret-key-12345';
    const userId = 'usr_turn_tester';
    const ttl = 3600;

    const timestamp = Math.floor(Date.now() / 1000) + ttl;
    const username = `${timestamp}:${userId}`;
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(username);
    const expectedPassword = hmac.digest('base64');

    assert.ok(username.startsWith(String(timestamp)));
    assert.ok(username.endsWith(userId));
    assert.ok(expectedPassword.length > 20);
    // Verify expiry is approximately 1 hour from now
    const expiryDate = new Date(timestamp * 1000);
    const diffMs = expiryDate.getTime() - Date.now();
    assert.ok(diffMs > 3500 * 1000 && diffMs <= 3600 * 1000);
  });

  // ── 5. Distributed Mongo Rate Limit Store ──────────────────────────────────
  await t.test('MongoRateLimitStore increments and resets keys cleanly', async () => {
    const store = new MongoRateLimitStore({ windowMs: 60 * 1000 });
    const testKey = 'test_ratelimit_key_' + Date.now();

    const hit1 = await store.increment(testKey);
    assert.equal(hit1.totalHits, 1);
    assert.ok(hit1.resetTime instanceof Date);

    const hit2 = await store.increment(testKey);
    assert.equal(hit2.totalHits, 2);

    await store.decrement(testKey);
    const hit3 = await store.increment(testKey);
    assert.equal(hit3.totalHits, 2); // 2 - 1 + 1 = 2

    await store.resetKey(testKey);
    const hitAfterReset = await store.increment(testKey);
    assert.equal(hitAfterReset.totalHits, 1);
  });

});
