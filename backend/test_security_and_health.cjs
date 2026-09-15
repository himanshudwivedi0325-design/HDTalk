/**
 * HDTalk - Security, Rate Limiter & Health Probe Verification
 * Created with ❤️ by Himanshu Dwivedi
 */

const BACKEND_URL = 'http://localhost:5000';

async function testSecurityAndHealth() {
  console.log('\n======================================================');
  console.log('🩺 HDTALK HEALTH PROBES & RATE LIMITER VERIFICATION');
  console.log('⚡ Created with ❤️ by Himanshu Dwivedi');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function assert(cond, msg) {
    total++;
    if (cond) {
      passed++;
      console.log(`  ✓ ${msg}`);
    } else {
      console.error(`  ❌ FAILED: ${msg}`);
      throw new Error(msg);
    }
  }

  // 1. Test GET /api/health
  const resHealth = await fetch(`${BACKEND_URL}/api/health`);
  assert(resHealth.status === 200, 'GET /api/health returns 200 OK');
  const dataHealth = await resHealth.json();
  assert(dataHealth.status === 'ok', 'General health status is "ok"');
  assert(dataHealth.creator === 'Himanshu Dwivedi', 'Creator attribution intact in health response');

  // 2. Test GET /api/health/live (Liveness probe)
  const resLive = await fetch(`${BACKEND_URL}/api/health/live`);
  assert(resLive.status === 200, 'GET /api/health/live returns 200 OK');
  const dataLive = await resLive.json();
  assert(dataLive.status === 'live', 'Liveness status is "live"');
  assert(typeof dataLive.uptime === 'number' && dataLive.uptime > 0, 'Uptime reported correctly');

  // 3. Test GET /api/health/ready (Readiness probe)
  const resReady = await fetch(`${BACKEND_URL}/api/health/ready`);
  assert(resReady.status === 200, 'GET /api/health/ready returns 200 OK');
  const dataReady = await resReady.json();
  assert(dataReady.status === 'ready', 'Readiness status is "ready"');
  assert(dataReady.database === 'connected', 'Database subsystem reports connected');
  assert(dataReady.storage === 'writable', 'Storage subsystem reports writable');
  assert(dataReady.memory && dataReady.memory.rssMB, 'Memory metrics included in readiness probe');
  console.log(`  ℹ️ Server telemetry: RSS ${dataReady.memory.rssMB} MB | Heap Used ${dataReady.memory.heapUsedMB} MB`);

  // 4. Test Rate Limiter on Auth
  console.log('\n  👉 Testing Rate Limiter on /api/auth/login...');
  let hitRateLimit = false;
  // Burst 60 login attempts to trip the 50-request limit
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.199'
      },
      body: JSON.stringify({ email: `stress_test_${i}@hdtalk.internal`, password: 'BadPassword' })
    });
    if (res.status === 429) {
      hitRateLimit = true;
      const json = await res.json();
      assert(json.success === false, 'Rate limit response has success: false');
      assert(res.headers.has('retry-after'), 'Rate limit response includes Retry-After header');
      console.log(`  ✓ Rate limiter correctly triggered HTTP 429 at attempt ${i + 1} (Retry-After: ${res.headers.get('retry-after')}s)`);
      break;
    }
  }
  assert(hitRateLimit, 'Rate limiter successfully protects against auth flooding (HTTP 429 enforced)');

  console.log(`\n======================================================`);
  console.log(`🎉 ALL ${passed}/${total} HEALTH & SECURITY PROBE TESTS PASSED (100%)`);
  console.log(`======================================================\n`);
}

testSecurityAndHealth().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
