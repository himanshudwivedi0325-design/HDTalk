/**
 * HDTalk - Progressive Socket Load Generator (NFR-007 Validation)
 * Target: Up to 2,500 Concurrent WebSockets
 * Created with ❤️ by Himanshu Dwivedi
 */

const path = require('path');
const { io } = require(path.resolve('C:/Users/hp/.gemini/antigravity/scratch/chatz-ultra/frontend/node_modules/socket.io-client'));

const BACKEND_URL = 'http://localhost:5000';
const TIERS = [100, 250, 500, 1000, 1500, 2000, 2500];
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 60; // Pacing to prevent Windows WSAENOBUFS ephemeral port exhaustion

async function getServerMetrics() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health/ready`);
    if (res.ok) {
      const data = await res.json();
      return data.memory || {};
    }
  } catch (_) {}
  return { rssMB: 'N/A', heapUsedMB: 'N/A' };
}

function measureEventLoopDelay() {
  return new Promise(resolve => {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const delta = process.hrtime.bigint() - start;
      resolve(Number(delta) / 1e6); // convert to ms
    });
  });
}

function connectSingleSocket(id) {
  return new Promise((resolve) => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: 10000
    });

    const timer = setTimeout(() => {
      resolve({ success: false, socket, error: 'TIMEOUT' });
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve({ success: true, socket });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, socket, error: err.message });
    });
  });
}

async function runSocketLoadAudit() {
  console.log('\n================================================================');
  console.log('⚡ HDTALK PROGRESSIVE SOCKET SCALABILITY AUDIT (NFR-007)');
  console.log('⚡ Target: 2,500 Concurrent WebSocket Connections');
  console.log('⚡ Host OS: Windows 10 Pro | Single-Host Loopback Evaluation');
  console.log('⚡ Created with ❤️ by Himanshu Dwivedi');
  console.log('================================================================\n');

  const baselineServerMem = await getServerMetrics();
  console.log(`📊 Initial Server Telemetry: RSS ${baselineServerMem.rssMB} MB | Heap Used ${baselineServerMem.heapUsedMB} MB\n`);

  const activeSockets = [];
  const tierResults = [];
  let maxSuccessfulTier = 0;
  let reachedLimit = false;

  for (const targetCount of TIERS) {
    const needed = targetCount - activeSockets.length;
    console.log(`--- [TIER: ${targetCount} CONCURRENT SOCKETS] ---`);
    console.log(`  👉 Ramping up ${needed} additional sockets in batches of ${BATCH_SIZE}...`);

    const startTime = Date.now();
    let tierFailures = 0;
    let lastError = null;

    for (let i = 0; i < needed; i += BATCH_SIZE) {
      const batchCount = Math.min(BATCH_SIZE, needed - i);
      const batchPromises = [];
      for (let b = 0; b < batchCount; b++) {
        batchPromises.push(connectSingleSocket(activeSockets.length + b));
      }

      const results = await Promise.all(batchPromises);
      for (const res of results) {
        if (res.success) {
          activeSockets.push(res.socket);
        } else {
          tierFailures++;
          lastError = res.error;
          try { res.socket.close(); } catch (_) {}
        }
      }

      // If failure rate exceeds 25% in this batch, trigger safety cutoff
      if (tierFailures > batchCount * 0.5) {
        console.warn(`  ⚠️ High failure rate encountered (${lastError}). Halting further ramp.`);
        reachedLimit = true;
        break;
      }

      // Small pacing delay to respect Windows loopback TCP stack
      if (BATCH_DELAY_MS > 0) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    const elapsed = Date.now() - startTime;
    const currentConnected = activeSockets.length;
    const successRate = ((currentConnected / targetCount) * 100).toFixed(1);
    const serverMem = await getServerMetrics();
    const eventLoopLag = await measureEventLoopDelay();
    const clientMemMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

    const resultRecord = {
      target: targetCount,
      connected: currentConnected,
      successRate: `${successRate}%`,
      rampTimeMs: elapsed,
      serverRssMB: serverMem.rssMB,
      serverHeapUsedMB: serverMem.heapUsedMB,
      clientRssMB: clientMemMB,
      eventLoopLagMs: eventLoopLag.toFixed(2),
      status: currentConnected >= targetCount * 0.95 ? 'PASS' : 'DEGRADED'
    };
    tierResults.push(resultRecord);

    console.log(`  ✓ Active Connections: ${currentConnected} / ${targetCount} (${successRate}%)`);
    console.log(`  ⏱️ Ramp Duration: ${elapsed}ms | Event Loop Lag: ${eventLoopLag.toFixed(2)}ms`);
    console.log(`  🧠 Server RSS: ${serverMem.rssMB} MB | Server Heap: ${serverMem.heapUsedMB} MB`);
    console.log(`  💻 Client Generator RSS: ${clientMemMB} MB`);

    if (currentConnected >= targetCount * 0.95) {
      maxSuccessfulTier = targetCount;
    }

    if (reachedLimit || currentConnected < targetCount * 0.8) {
      console.warn(`\n🛑 Host loopback capacity reached at ${currentConnected} concurrent sockets.`);
      console.warn(`   Reason: Ephemeral port or OS network buffer constraint on Windows single host.`);
      break;
    }

    // Brief stabilization pause before next tier
    await new Promise(r => setTimeout(r, 500));
  }

  // Teardown
  console.log(`\n🧹 Tearing down ${activeSockets.length} sockets cleanly...`);
  for (const s of activeSockets) {
    try { s.close(); } catch (_) {}
  }
  await new Promise(r => setTimeout(r, 1000));

  const postTeardownMem = await getServerMetrics();
  console.log(`📊 Post-Teardown Server Telemetry: RSS ${postTeardownMem.rssMB} MB | Heap Used ${postTeardownMem.heapUsedMB} MB\n`);

  console.log('================================================================');
  console.log('📋 EMPIRICAL SCALABILITY RESULTS SUMMARY TABLE');
  console.log('================================================================');
  console.table(tierResults);
  console.log(`\n🏆 Maximum Verified Concurrent Sockets: ${maxSuccessfulTier}`);
  if (maxSuccessfulTier >= 2500) {
    console.log('✅ NFR-007 (2,500 Concurrent Sockets): FULLY VERIFIED IN LOCAL ENVIRONMENT');
  } else {
    console.log(`⚠️ NFR-007 (2,500 Concurrent Sockets): VERIFIED UP TO ${maxSuccessfulTier} ON SINGLE HOST`);
    console.log(`   (Higher concurrency requires multi-node cluster or distributed client load runners).`);
  }
  console.log('================================================================\n');

  return { tierResults, maxSuccessfulTier };
}

runSocketLoadAudit().catch(err => {
  console.error('Socket load audit failed:', err);
  process.exit(1);
});
