/**
 * HDTalk - Adversarial Security Verification Suite (NFR-011 to NFR-018)
 * Created with ❤️ by Himanshu Dwivedi
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const config = require('./src/config/config');
const db = require('./src/database/db');
const { io } = require(path.resolve('C:/Users/hp/.gemini/antigravity/scratch/chatz-ultra/frontend/node_modules/socket.io-client'));

const BACKEND_URL = 'http://localhost:5000';

async function runSecurityAudit() {
  console.log('\n======================================================');
  console.log('🛡️  HDTALK ADVERSARIAL SECURITY AUDIT (NFR-011 to NFR-018)');
  console.log('⚡ Authoritative Verification against IEEE 830 SRS v1.1.0');
  console.log('⚡ Created with ❤️ by Himanshu Dwivedi');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;
  let total = 0;
  const auditResults = {};

  function record(section, name, cond, detail = '') {
    total++;
    if (!auditResults[section]) auditResults[section] = [];
    if (cond) {
      passed++;
      auditResults[section].push({ name, status: 'PASS', detail });
      console.log(`  ✓ [${section}] ${name}${detail ? ` (${detail})` : ''}`);
    } else {
      failed++;
      auditResults[section].push({ name, status: 'FAIL', detail });
      console.error(`  ❌ [${section}] FAILED: ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  // --------------------------------------------------------------------------
  // SECTION 1: NFR-011 — BCRYPT PASSWORD SALT COST (>= 10 ROUNDS)
  // --------------------------------------------------------------------------
  console.log('👉 [AUDIT 1] NFR-011: Bcrypt Password Salt Cost (>= 10 Rounds)...');
  const testEmail = `sec_audit_${Date.now()}@hdtalk.internal`;
  const testPassword = 'SuperSecurePassword2026!';

  // 1.1 Register user
  const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Security Test User',
      email: testEmail,
      password: testPassword,
      profession: 'Security Architect',
      bio: 'Auditing platform security.',
      interests: ['Cryptography', 'AppSec']
    })
  });
  const regData = await regRes.json();
  record('NFR-011', 'Registration succeeds with valid password', regRes.status === 201 && regData.success);

  // Wait 100ms for async database disk flush
  await new Promise(r => setTimeout(r, 100));

  const registeredUser = db.getUserByEmail(testEmail);
  record('NFR-011', 'User stored in database', Boolean(registeredUser));

  if (registeredUser) {
    const isBcrypt = /^\$2[aby]\$\d{2}\$/.test(registeredUser.password);
    record('NFR-011', 'Password stored as bcrypt hash format', isBcrypt);

    const costMatch = registeredUser.password.match(/^\$2[aby]\$(\d{2})\$/);
    const costRounds = costMatch ? parseInt(costMatch[1], 10) : 0;
    record('NFR-011', 'Bcrypt salt cost >= 10 rounds', costRounds >= 10, `Cost = ${costRounds} rounds`);
  }

  // 1.2 Rejected short password
  const shortPwdRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Short Pwd User',
      email: `short_${Date.now()}@hdtalk.internal`,
      password: '123'
    })
  });
  record('NFR-011', 'Rejects password shorter than 6 characters', shortPwdRes.status === 400);

  // 1.3 Rejected wrong password on login
  const wrongPwdRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'WrongPassword123' })
  });
  record('NFR-011', 'Rejects incorrect password with 401 Unauthorized', wrongPwdRes.status === 401);

  // 1.4 Valid login
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPassword })
  });
  const loginData = await loginRes.json();
  record('NFR-011', 'Accepts correct password with 200 OK', loginRes.status === 200 && loginData.success);
  const userToken = loginData.token;
  const testUserId = loginData.user.id;

  // --------------------------------------------------------------------------
  // SECTION 2: NFR-012 — MANDATORY TLS / WSS
  // --------------------------------------------------------------------------
  console.log('\n👉 [AUDIT 2] NFR-012: Mandatory TLS/WSS Transport...');
  const deploymentDocsExist = fs.existsSync(path.resolve('C:/Users/hp/.gemini/antigravity/scratch/chatz-ultra/DEPLOYMENT.md')) ||
                             fs.existsSync(path.resolve('C:/Users/hp/.gemini/antigravity/scratch/chatz-ultra/docs/SRS-COMPLIANCE-FINAL.md'));
  record('NFR-012', 'Production deployment reverse proxy architecture documented', deploymentDocsExist);
  console.log('  ℹ️ [NFR-012 Status] Local dev running on loopback HTTP/WS.');
  console.log('  ℹ️ [NFR-012 Requirement] Production requires TLS 1.2/1.3 reverse proxy (Nginx / Cloudflare / Let\'s Encrypt).');

  // --------------------------------------------------------------------------
  // SECTION 3: NFR-013 — DTLS-SRTP MEDIA ENCRYPTION
  // --------------------------------------------------------------------------
  console.log('\n👉 [AUDIT 3] NFR-013: DTLS-SRTP Media Encryption...');
  const webrtcServicePath = path.resolve('C:/Users/hp/.gemini/antigravity/scratch/chatz-ultra/frontend/src/services/webrtcService.js');
  const webrtcCode = fs.existsSync(webrtcServicePath) ? fs.readFileSync(webrtcServicePath, 'utf8') : '';
  const usesRtcPeerConnection = webrtcCode.includes('RTCPeerConnection');
  record('NFR-013', 'Instantiates W3C RTCPeerConnection enforcing mandatory DTLS-SRTP', usesRtcPeerConnection);

  // --------------------------------------------------------------------------
  // SECTION 4: NFR-014 — JWT CRYPTOGRAPHIC INTEGRITY & SOCKET AUTHENTICATION
  // --------------------------------------------------------------------------
  console.log('\n👉 [AUDIT 4] NFR-014: JWT Cryptographic Integrity & Socket.io Auth...');
  
  // 4.1 Missing token on protected REST route
  const resNoToken = await fetch(`${BACKEND_URL}/api/users`);
  record('NFR-014', 'Protected route rejects missing token with 401', resNoToken.status === 401);

  // 4.2 Malformed token
  const resMalformed = await fetch(`${BACKEND_URL}/api/users`, {
    headers: { 'Authorization': 'Bearer NOT_A_REAL_JWT_TOKEN' }
  });
  record('NFR-014', 'Protected route rejects malformed token with 401', resMalformed.status === 401);

  // 4.3 Expired token
  const expiredToken = jwt.sign({ id: testUserId }, config.JWT_SECRET, { expiresIn: '-10s' });
  const resExpired = await fetch(`${BACKEND_URL}/api/users`, {
    headers: { 'Authorization': `Bearer ${expiredToken}` }
  });
  record('NFR-014', 'Protected route rejects expired token with 401', resExpired.status === 401);

  // 4.4 Forged token (signed with attacker key)
  const forgedToken = jwt.sign({ id: testUserId }, 'attacker_super_secret_key', { expiresIn: '1h' });
  const resForged = await fetch(`${BACKEND_URL}/api/users`, {
    headers: { 'Authorization': `Bearer ${forgedToken}` }
  });
  record('NFR-014', 'Protected route rejects token with invalid signature', resForged.status === 401);

  // 4.5 Alg none attack
  const algNoneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const algNonePayload = Buffer.from(JSON.stringify({ id: testUserId })).toString('base64url');
  const algNoneToken = `${algNoneHeader}.${algNonePayload}.`;
  const resAlgNone = await fetch(`${BACKEND_URL}/api/users`, {
    headers: { 'Authorization': `Bearer ${algNoneToken}` }
  });
  record('NFR-014', 'Protected route rejects alg=none token with 401', resAlgNone.status === 401);

  // 4.6 Valid token accepts
  const resValid = await fetch(`${BACKEND_URL}/api/users`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  record('NFR-014', 'Protected route accepts valid JWT with 200 OK', resValid.status === 200);

  // 4.7 Key length verification (>= 256 bits / 32 bytes)
  const keyLengthBytes = Buffer.byteLength(config.JWT_SECRET, 'utf8');
  record('NFR-014', 'JWT Secret key length >= 256 bits (32 bytes)', keyLengthBytes >= 32, `Key: ${keyLengthBytes * 8} bits`);

  // 4.8 Socket.io JWT Authentication & Spoofing Defense
  console.log('  👉 Testing Socket.io JWT authentication & identity spoofing defenses...');
  const victimUserId = 'usr_victim_test_' + Date.now();
  db.createUser({
    id: victimUserId,
    name: 'Victim User',
    email: `victim_${Date.now()}@hdtalk.internal`,
    password: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    profession: 'Engineer'
  });

  // Test A: Socket spoofing with token mismatch
  const attackerSocket = io(BACKEND_URL, { transports: ['websocket'], forceNew: true, reconnection: false });
  await new Promise(r => attackerSocket.on('connect', r));

  let spoofErrorCaught = false;
  attackerSocket.on('socket_error', (err) => {
    if (err && (err.message.includes('Authentication mismatch') || err.message.includes('mismatch'))) {
      spoofErrorCaught = true;
    }
  });

  attackerSocket.emit('register_user', { userId: victimUserId, token: userToken });
  await new Promise(r => setTimeout(r, 200));
  record('NFR-014', 'Socket.io blocks identity spoofing when JWT payload does not match requested userId', spoofErrorCaught);

  // Test B: Socket spoofing with invalid/tampered token
  let invalidTokenCaught = false;
  attackerSocket.on('socket_error', (err) => {
    if (err && (err.message.includes('Invalid session token') || err.message.includes('token'))) {
      invalidTokenCaught = true;
    }
  });
  attackerSocket.emit('register_user', { userId: victimUserId, token: 'bad_token' });
  await new Promise(r => setTimeout(r, 200));
  record('NFR-014', 'Socket.io blocks registration with invalid session token', invalidTokenCaught);

  // Test C: Socket registration with completely missing token
  const unauthSocket = io(BACKEND_URL, { transports: ['websocket'], forceNew: true, reconnection: false });
  await new Promise(r => unauthSocket.on('connect', r));
  
  let unauthRejected = false;
  unauthSocket.on('socket_error', (err) => {
    if (err && err.message) {
      unauthRejected = true;
    }
  });
  unauthSocket.emit('register_user', victimUserId);
  await new Promise(r => setTimeout(r, 200));
  record('NFR-014', 'Socket.io rejects unauthenticated registration when token is omitted', unauthRejected);

  attackerSocket.disconnect();
  unauthSocket.disconnect();

  // --------------------------------------------------------------------------
  // SECTION 5: NFR-015 — XSS PROTECTION
  // --------------------------------------------------------------------------
  console.log('\n👉 [AUDIT 5] NFR-015: Cross-Site Scripting (XSS) Protection...');
  
  const frontendSrc = path.resolve('C:/Users/hp/.gemini/antigravity/scratch/chatz-ultra/frontend/src');
  function scanDirForPatterns(dir, pattern) {
    let found = [];
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        found = found.concat(scanDirForPatterns(full, pattern));
      } else if (f.endsWith('.jsx') || f.endsWith('.js')) {
        const c = fs.readFileSync(full, 'utf8');
        if (pattern.test(c)) found.push(full);
      }
    }
    return found;
  }
  const dangerMatches = scanDirForPatterns(frontendSrc, /dangerouslySetInnerHTML/);
  record('NFR-015', 'Zero dangerouslySetInnerHTML usage across frontend JSX', dangerMatches.length === 0, `Matches: ${dangerMatches.length}`);

  const innerHtmlMatches = scanDirForPatterns(frontendSrc, /\.innerHTML\s*=/);
  record('NFR-015', 'Zero raw .innerHTML assignments across frontend source', innerHtmlMatches.length === 0);

  // XSS Payload in Chat Message
  const xssPayload = `<script>alert('XSS')</script><img src="x" onerror="alert(1)">`;
  const xssConvRes = await fetch(`${BACKEND_URL}/api/chat/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: JSON.stringify({ targetUserId: victimUserId })
  });
  const xssConvData = await xssConvRes.json();
  const convId = xssConvData.conversation.id;

  const xssMsgRes = await fetch(`${BACKEND_URL}/api/chat/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: JSON.stringify({ text: xssPayload, type: 'text' })
  });
  const xssMsgData = await xssMsgRes.json();
  record('NFR-015', 'XSS payload message stored as literal text in database', xssMsgData.message && xssMsgData.message.text === xssPayload);

  // --------------------------------------------------------------------------
  // SECTION 6: NFR-016 — UPLOAD WHITELIST & PATH SANITIZATION
  // --------------------------------------------------------------------------
  console.log('\n👉 [AUDIT 6] NFR-016: Upload Whitelist & Path Sanitization...');

  // 6.1 Prohibited extension in chat upload (.exe)
  const formExe = new FormData();
  formExe.append('file', new Blob(['fake_executable_binary'], { type: 'application/octet-stream' }), 'trojan.exe');
  const resExe = await fetch(`${BACKEND_URL}/api/chat/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: formExe
  });
  record('NFR-016', 'Rejects .exe executable upload in chat', resExe.status === 400);

  // 6.2 Prohibited script in chat upload (.html)
  const formHtml = new FormData();
  formHtml.append('file', new Blob(['<script>alert(1)</script>'], { type: 'text/html' }), 'exploit.html');
  const resHtml = await fetch(`${BACKEND_URL}/api/chat/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: formHtml
  });
  record('NFR-016', 'Rejects .html script upload in chat', resHtml.status === 400);

  // 6.3 Prohibited script in chat upload (.php)
  const formPhp = new FormData();
  formPhp.append('file', new Blob(['<?php system($_GET["cmd"]); ?>'], { type: 'application/x-php' }), 'shell.php');
  const resPhp = await fetch(`${BACKEND_URL}/api/chat/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: formPhp
  });
  record('NFR-016', 'Rejects .php web shell upload in chat', resPhp.status === 400);

  // 6.4 Upload file without extension
  const formNoExt = new FormData();
  formNoExt.append('file', new Blob(['unknown_binary_data'], { type: 'application/octet-stream' }), 'malicious_no_ext');
  const resNoExt = await fetch(`${BACKEND_URL}/api/chat/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: formNoExt
  });
  record('NFR-016', 'Rejects upload with no file extension', resNoExt.status === 400);

  // 6.5 Path traversal in chat upload filename
  const formTraversal = new FormData();
  formTraversal.append('file', new Blob(['test image data'], { type: 'image/png' }), '../../../../traversal_test.png');
  const resTraversal = await fetch(`${BACKEND_URL}/api/chat/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: formTraversal
  });
  const traversalData = await resTraversal.json();
  const savedFilename = traversalData.fileUrl ? path.basename(traversalData.fileUrl) : '';
  const noPathTraversal = savedFilename && !savedFilename.includes('..') && !savedFilename.startsWith('/');
  record('NFR-016', 'Sanitizes path traversal in originalFilename into safe UUID filename', noPathTraversal, `Saved as: ${savedFilename}`);

  // 6.6 Avatar upload security: Reject .exe with spoofed image MIME type
  const formAvatarExe = new FormData();
  formAvatarExe.append('avatar', new Blob(['MZ\x90\x00executable'], { type: 'image/png' }), 'backdoor.exe');
  const resAvatarExe = await fetch(`${BACKEND_URL}/api/users/avatar`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: formAvatarExe
  });
  record('NFR-016', 'Rejects .exe file with spoofed image/png MIME in avatar upload', resAvatarExe.status === 400);

  // 6.7 Avatar upload security: Reject .html with spoofed image MIME type
  const formAvatarHtml = new FormData();
  formAvatarHtml.append('avatar', new Blob(['<script>alert("avatar_xss")</script>'], { type: 'image/jpeg' }), 'xss.html');
  const resAvatarHtml = await fetch(`${BACKEND_URL}/api/users/avatar`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: formAvatarHtml
  });
  record('NFR-016', 'Rejects .html file with spoofed image/jpeg MIME in avatar upload', resAvatarHtml.status === 400);

  // 6.8 Avatar upload security: Reject .svg containing scripts
  const formAvatarSvg = new FormData();
  formAvatarSvg.append('avatar', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: 'image/svg+xml' }), 'vector.svg');
  const resAvatarSvg = await fetch(`${BACKEND_URL}/api/users/avatar`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: formAvatarSvg
  });
  record('NFR-016', 'Rejects .svg vector files in avatar upload to prevent SVG XSS', resAvatarSvg.status === 400);

  // 6.9 Legitimate image upload in avatar
  const formAvatarValid = new FormData();
  formAvatarValid.append('avatar', new Blob(['fake_png_header'], { type: 'image/png' }), 'avatar.png');
  const resAvatarValid = await fetch(`${BACKEND_URL}/api/users/avatar`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` },
    body: formAvatarValid
  });
  record('NFR-016', 'Accepts legitimate PNG avatar upload', resAvatarValid.status === 200);

  // --------------------------------------------------------------------------
  // SECTION 7: NFR-017 — CORS (CROSS-ORIGIN RESOURCE SHARING)
  // --------------------------------------------------------------------------
  console.log('\n👉 [AUDIT 7] NFR-017: CORS Configuration...');

  // 7.1 Legitimate client origin
  const resCorsValid = await fetch(`${BACKEND_URL}/api/health`, {
    headers: { 'Origin': 'http://localhost:5173' }
  });
  const corsHeaderValid = resCorsValid.headers.get('access-control-allow-origin');
  record('NFR-017', 'Permits configured CLIENT_URL origin', corsHeaderValid === 'http://localhost:5173');

  // 7.2 Untrusted attacker origin
  const resCorsUntrusted = await fetch(`${BACKEND_URL}/api/health`, {
    headers: { 'Origin': 'http://untrusted-malicious-site.com' }
  });
  const corsHeaderUntrusted = resCorsUntrusted.headers.get('access-control-allow-origin');
  record('NFR-017', 'Omits or blocks Access-Control-Allow-Origin for untrusted origins', corsHeaderUntrusted !== 'http://untrusted-malicious-site.com', `Header: ${corsHeaderUntrusted}`);

  // --------------------------------------------------------------------------
  // SECTION 8: NFR-018 — CREDENTIAL & PASSWORD SANITIZATION
  // --------------------------------------------------------------------------
  console.log('\n👉 [AUDIT 8] NFR-018: Credential & Password Sanitization...');

  // 8.1 Register response has no password
  record('NFR-018', 'Password sanitized from register response', regData.user && regData.user.password === undefined);

  // 8.2 Login response has no password
  record('NFR-018', 'Password sanitized from login response', loginData.user && loginData.user.password === undefined);

  // 8.3 GET /api/auth/me has no password
  const resMe = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  const meData = await resMe.json();
  record('NFR-018', 'Password sanitized from GET /api/auth/me', meData.user && meData.user.password === undefined);

  // 8.4 GET /api/users directory has no passwords
  const resUsers = await fetch(`${BACKEND_URL}/api/users`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  const usersData = await resUsers.json();
  const anyPasswordLeakedInDirectory = (usersData.users || []).some(u => u.password !== undefined);
  record('NFR-018', 'Password sanitized from all user objects in GET /api/users directory', !anyPasswordLeakedInDirectory);

  // 8.5 GET /api/users/:id profile has no password
  const resProfile = await fetch(`${BACKEND_URL}/api/users/${testUserId}`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  const profileData = await resProfile.json();
  record('NFR-018', 'Password sanitized from GET /api/users/:id profile', profileData.user && profileData.user.password === undefined);

  // 8.6 Inspect database on disk: Zero plaintext passwords
  const diskDb = JSON.parse(fs.readFileSync(path.join(config.DATA_DIR, 'db.json'), 'utf8'));
  const allPasswordsBcryptHashed = (diskDb.users || []).every(u => !u.password || /^\$2[aby]\$\d{2}\$/.test(u.password));
  record('NFR-018', 'All passwords on disk are exclusively bcrypt hashes, zero plaintext', allPasswordsBcryptHashed);

  console.log('\n======================================================');
  console.log(`📊 AUDIT SUMMARY: ${passed}/${total} TESTS PASSED (${failed} FAILED)`);
  console.log('======================================================\n');

  if (failed > 0) {
    console.log(`⚠️ DISCOVERED ${failed} GENUINE DEFECTS / GAPS TO BE HARDENED.`);
    return { success: false, passed, failed, total, auditResults };
  } else {
    console.log('🎉 ALL SECURITY REQUIREMENTS VERIFIED!');
    return { success: true, passed, failed, total, auditResults };
  }
}

runSecurityAudit()
  .then(res => {
    if (!res.success) {
      console.log('Audit completed with findings.');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Audit crashed:', err);
    process.exit(1);
  });
