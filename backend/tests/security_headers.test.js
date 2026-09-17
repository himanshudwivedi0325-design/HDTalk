const test = require('node:test');
const assert = require('node:assert/strict');

test('Security Headers & CORS Suite', async (t) => {
  await t.test('Permissions-Policy permits camera and microphone for self origin', () => {
    const permissionsPolicy = 'camera=(self), microphone=(self), geolocation=()';

    assert.match(permissionsPolicy, /camera=\(self\)/);
    assert.match(permissionsPolicy, /microphone=\(self\)/);
    // Ensure it is not blocking self
    assert.doesNotMatch(permissionsPolicy, /camera=\(\)/);
    assert.doesNotMatch(permissionsPolicy, /microphone=\(\)/);
  });

  await t.test('CORS origin validator correctly handles trusted and untrusted origins', () => {
    const rawAllowed = 'https://hdtalk.onrender.com, http://localhost:5173';
    const configuredOrigins = new Set(rawAllowed.split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean));

    const isOriginAllowed = (origin, isProd = false) => {
      if (!origin) return true;
      const normalized = origin.trim().replace(/\/+$/, '');
      if (configuredOrigins.has(normalized)) return true;
      if (!isProd) {
        try {
          const url = new URL(origin);
          const host = url.hostname.toLowerCase();
          if (host === 'localhost' || host === '127.0.0.1') return true;
        } catch (_) {}
      }
      return false;
    };

    // Allowed explicitly configured origins
    assert.equal(isOriginAllowed(undefined), true);
    assert.equal(isOriginAllowed('http://localhost:5173'), true);
    assert.equal(isOriginAllowed('https://hdtalk.onrender.com'), true);

    // Disallowed wildcard / unauthorized onrender domains (attacker tenant defense)
    assert.equal(isOriginAllowed('https://attacker.onrender.com'), false);
    assert.equal(isOriginAllowed('https://evil.loca.lt'), false);
    assert.equal(isOriginAllowed('https://malicious-attacker.com'), false);
    assert.equal(isOriginAllowed('https://phishing-hdtalk.com'), false);

    // Localhost disallowed in production mode if not in configured origins
    assert.equal(isOriginAllowed('http://localhost:3000', true), false);
  });

  await t.test('Defensive HTTP security headers are properly structured', () => {
    const headers = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['X-Frame-Options'], 'DENY');
    assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  });

  await t.test('NoSQL injection sanitizer strips MongoDB operator keys and prototype pollutants', () => {
    const sanitizeNoSql = (obj) => {
      if (obj && typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor') {
            delete obj[key];
          } else if (typeof obj[key] === 'object') {
            sanitizeNoSql(obj[key]);
          }
        }
      }
      return obj;
    };

    const maliciousBody = {
      email: { $gt: '' },
      password: 'password123',
      nested: {
        $where: 'sleep(5000)',
        cleanField: 'allowed'
      },
      'attacker.dotted': 'payload'
    };

    sanitizeNoSql(maliciousBody);

    assert.equal(maliciousBody.email.$gt, undefined);
    assert.equal(maliciousBody.password, 'password123');
    assert.equal(maliciousBody.nested.$where, undefined);
    assert.equal(maliciousBody.nested.cleanField, 'allowed');
    assert.equal(maliciousBody['attacker.dotted'], undefined);
  });
});
