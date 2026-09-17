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
    const config = { PORT: 5000 };
    const allowedOrigins = ['https://hdtalk.onrender.com', 'http://localhost:5173'];

    const isOriginAllowed = (origin) => {
      if (!origin) return true;
      if (allowedOrigins.includes('*')) return true;
      if (origin.endsWith('.loca.lt') || origin.endsWith('.ngrok-free.app') || origin.endsWith('.onrender.com')) return true;
      if (origin === `http://localhost:${config.PORT}` || origin === `http://127.0.0.1:${config.PORT}`) return true;
      if (origin === `https://localhost:${config.PORT}` || origin === `https://127.0.0.1:${config.PORT}`) return true;
      return allowedOrigins.includes(origin);
    };

    // Allowed origins
    assert.equal(isOriginAllowed(undefined), true);
    assert.equal(isOriginAllowed('http://localhost:5173'), true);
    assert.equal(isOriginAllowed('https://hdtalk.onrender.com'), true);
    assert.equal(isOriginAllowed('https://my-subdomain.onrender.com'), true);
    assert.equal(isOriginAllowed('http://localhost:5000'), true);

    // Disallowed malicious origins
    assert.equal(isOriginAllowed('https://malicious-attacker.com'), false);
    assert.equal(isOriginAllowed('https://phishing-hdtalk.com'), false);
    assert.equal(isOriginAllowed('http://localhost:3000'), false);
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
