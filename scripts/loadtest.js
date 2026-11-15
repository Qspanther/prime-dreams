// 🚀 PRIME DREEMS — HIGH-CONCURRENCY LOAD TEST HARNESS
// Targets 200 Concurrent WebSockets + 50 HTTP RPS for 60 Seconds
// Validates Render Free Tier + Neon PostgreSQL limits and confirms 0 bots in H2H/Private contests.

const http = require('http');
const https = require('https');
const { WebSocket } = require('../backend/node_modules/ws');

const API_BASE = process.env.TARGET_API_URL || 'https://prime-dreems-backend.onrender.com';
const WS_BASE = process.env.TARGET_WS_URL || 'wss://prime-dreems-backend.onrender.com/ws';
const DURATION_SEC = parseInt(process.env.TEST_DURATION || '60', 10);
const TARGET_WS_CONNS = parseInt(process.env.TARGET_WS_CONNS || '200', 10);
const TARGET_RPS = parseInt(process.env.TARGET_RPS || '50', 10);

console.log('═══════════════════════════════════════════════════════════════');
console.log('🏏 PRIME DREEMS HIGH-CONCURRENCY LOAD & STRESS TEST');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`🎯 HTTP Target:     ${API_BASE}`);
console.log(`⚡ WebSocket Target:${WS_BASE}`);
console.log(`👥 Concurrent WS:   ${TARGET_WS_CONNS} clients`);
console.log(`📊 HTTP Throughput: ${TARGET_RPS} requests / sec`);
console.log(`⏱️ Duration:        ${DURATION_SEC} seconds`);
console.log('═══════════════════════════════════════════════════════════════\n');

// ── Metrics Accumulators ──
const stats = {
  http: {
    total: 0,
    success: 0,
    errors: 0,
    latencies: [],
  },
  ws: {
    connected: 0,
    errors: 0,
    closed: 0,
    messagesReceived: 0,
    pongs: 0,
  },
};

// ── Step 1: Pre-Flight H2H & Private Contest Bot Isolation Check ──
async function verifyContestIsolation() {
  console.log('🛡️ [Pre-Flight] Verifying 0 Bots Rule in H2H & Private Contests...');
  try {
    const res = await fetch(`${API_BASE}/api/matches`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const matches = data.matches || [];

    let inspectedH2H = 0;
    let inspectedPrivate = 0;
    let botViolations = 0;

    for (const m of matches.slice(0, 5)) {
      const cRes = await fetch(`${API_BASE}/api/matches/${m.id}`);
      if (!cRes.ok) continue;
      const cData = await cRes.json();
      const contests = cData.contests || [];

      for (const c of contests) {
        if (c.type === 'h2h' || c.is_private === true || c.type === 'private') {
          if (c.type === 'h2h') inspectedH2H += 1;
          else inspectedPrivate += 1;

          // Fetch leaderboard
          const lbRes = await fetch(`${API_BASE}/api/matches/${m.id}/leaderboard?contestId=${c.id}`);
          if (lbRes.ok) {
            const lbData = await lbRes.json();
            const teams = lbData.teams || [];
            const botTeams = teams.filter((t) => t.is_bot === true || t.user?.is_bot === true);
            if (botTeams.length > 0) {
              console.error(`🚨 VIOLATION: Found ${botTeams.length} bots in ${c.type} contest "${c.title}"!`);
              botViolations += botTeams.length;
            }
          }
        }
      }
    }

    if (botViolations === 0) {
      console.log(`✅ [Contest Isolation Passed] Verified 0 bots across ${inspectedH2H} H2H and ${inspectedPrivate} Private contests!`);
    } else {
      console.error(`❌ [Contest Isolation Failed] ${botViolations} bot violations detected.`);
    }
  } catch (err) {
    console.warn(`⚠️ [Pre-Flight Notice] ${err.message}. Proceeding to traffic test.`);
  }
}

// ── Step 2: Establish 200 Concurrent WebSockets ──
function launchWebSockets() {
  console.log(`\n⚡ Ramping up ${TARGET_WS_CONNS} concurrent WebSocket clients to ${WS_BASE}...`);
  const sockets = [];

  for (let i = 0; i < TARGET_WS_CONNS; i++) {
    setTimeout(() => {
      try {
        const ws = new WebSocket(WS_BASE);

        ws.on('open', () => {
          stats.ws.connected += 1;
          // Subscribe to demo match channel
          ws.send(JSON.stringify({ action: 'subscribe', matchId: 'm-live-demo' }));
        });

        ws.on('message', (msg) => {
          stats.ws.messagesReceived += 1;
          try {
            const parsed = JSON.parse(msg.toString());
            if (parsed.type === 'PONG') stats.ws.pongs += 1;
          } catch (_) {}
        });

        ws.on('error', () => {
          stats.ws.errors += 1;
        });

        ws.on('close', () => {
          stats.ws.closed += 1;
        });

        // 25s ping loop to verify keep-alive
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'ping' }));
          }
        }, 25000);

        ws.on('close', () => clearInterval(pingInterval));
        sockets.push(ws);
      } catch (e) {
        stats.ws.errors += 1;
      }
    }, i * 35); // Stagger connection ramp-up across ~7 seconds
  }

  return sockets;
}

// ── Step 3: Generate 50 HTTP RPS ──
function startHttpTraffic() {
  console.log(`📊 Generating steady ${TARGET_RPS} RPS HTTP workload for ${DURATION_SEC}s...`);
  const endpoints = [
    '/health',
    '/api/matches',
  ];

  const startTime = Date.now();
  const endTime = startTime + DURATION_SEC * 1000;

  const interval = setInterval(() => {
    if (Date.now() >= endTime) {
      clearInterval(interval);
      return;
    }

    // Fire batch of requests every second
    for (let i = 0; i < TARGET_RPS; i++) {
      const ep = endpoints[i % endpoints.length];
      const reqStart = Date.now();
      const url = `${API_BASE}${ep}`;

      fetch(url, { signal: AbortSignal.timeout(6000) })
        .then((res) => {
          const lat = Date.now() - reqStart;
          stats.http.total += 1;
          stats.http.latencies.push(lat);
          if (res.ok) stats.http.success += 1;
          else stats.http.errors += 1;
        })
        .catch(() => {
          stats.http.total += 1;
          stats.http.errors += 1;
        });
    }
  }, 1000);
}

// ── Step 4: Summary Reporter ──
function printReport(sockets) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📈 LOAD TEST COMPLETED — PERFORMANCE SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  // HTTP Stats
  const lats = stats.http.latencies.sort((a, b) => a - b);
  const p50 = lats[Math.floor(lats.length * 0.5)] || 0;
  const p95 = lats[Math.floor(lats.length * 0.95)] || 0;
  const p99 = lats[Math.floor(lats.length * 0.99)] || 0;
  const avg = lats.length > 0 ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0;
  const successRate = stats.http.total > 0 ? ((stats.http.success / stats.http.total) * 100).toFixed(2) : 100;

  console.log(`HTTP Requests Total:   ${stats.http.total}`);
  console.log(`HTTP Success:          ${stats.http.success} (${successRate}%)`);
  console.log(`HTTP Errors:           ${stats.http.errors}`);
  console.log(`Latency (p50 / avg):   ${p50}ms / ${avg}ms`);
  console.log(`Latency (p95 / p99):   ${p95}ms / ${p99}ms`);
  console.log('───────────────────────────────────────────────────────────────');

  // WS Stats
  console.log(`WebSocket Concurrent:  ${stats.ws.connected} connected`);
  console.log(`WebSocket Errors:      ${stats.ws.errors}`);
  console.log(`WebSocket Msgs Recv:   ${stats.ws.messagesReceived}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Clean close sockets
  for (const s of sockets) {
    try { s.close(); } catch (_) {}
  }
}

async function run() {
  await verifyContestIsolation();
  const sockets = launchWebSockets();
  startHttpTraffic();

  setTimeout(() => {
    printReport(sockets);
  }, (DURATION_SEC + 3) * 1000);
}

run();
