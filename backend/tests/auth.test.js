const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

test('Auth Security Suite', async (t) => {
  const TEST_JWT_SECRET = 'hdtalk_test_jwt_secret_key_1234567890';

  await t.test('Password hashing produces secure, salted hash', async () => {
    const plainPassword = 'SuperSecurePassword@2026';
    const hash = await bcrypt.hash(plainPassword, 10);

    assert.notEqual(hash, plainPassword);
    assert.match(hash, /^\$2[aby]\$\d+\$/);

    const isMatch = await bcrypt.compare(plainPassword, hash);
    assert.equal(isMatch, true);

    const isWrongMatch = await bcrypt.compare('WrongPassword', hash);
    assert.equal(isWrongMatch, false);
  });

  await t.test('JWT token signs and verifies with user claims', () => {
    const userId = 'user_test_uuid_9988';
    const token = jwt.sign({ id: userId }, TEST_JWT_SECRET, { expiresIn: '1h' });

    assert.ok(typeof token === 'string' && token.split('.').length === 3);

    const decoded = jwt.verify(token, TEST_JWT_SECRET);
    assert.equal(decoded.id, userId);
  });

  await t.test('JWT token rejects tampered signature', () => {
    const token = jwt.sign({ id: 'user_123' }, TEST_JWT_SECRET, { expiresIn: '1h' });
    const wrongSecret = 'wrong_secret_key_99999999';

    assert.throws(() => {
      jwt.verify(token, wrongSecret);
    }, /invalid signature/);
  });

  await t.test('User sanitization never leaks password or passwordHash', () => {
    const rawUser = {
      id: 'usr_abc',
      name: 'Himanshu',
      email: 'himanshu@example.com',
      password: 'PlainPassword123',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      status: 'online',
      avatar: '/avatars/himanshu.png'
    };

    const sanitizeUser = (user) => {
      if (!user) return null;
      const { password, passwordHash, ...safeUser } = user;
      return safeUser;
    };

    const safeUser = sanitizeUser(rawUser);

    assert.equal(safeUser.id, 'usr_abc');
    assert.equal(safeUser.name, 'Himanshu');
    assert.equal(safeUser.password, undefined);
    assert.equal(safeUser.passwordHash, undefined);
    assert.equal('password' in safeUser, false);
    assert.equal('passwordHash' in safeUser, false);
  });
});
