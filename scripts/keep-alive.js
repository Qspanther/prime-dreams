/**
 * Prime Dreems - Render Free-Tier Keep-Alive Ping Daemon
 * Pings backend, bot-service, and frontend every 10 minutes to prevent Render 15-minute sleep.
 */

const https = require('https');

const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

const TARGETS = [
  { name: 'Backend API', url: 'https://prime-dreems-backend.onrender.com/health' },
  { name: 'Bot Service', url: 'https://prime-dreems-bot-service.onrender.com/health' },
  { name: 'Frontend UI', url: 'https://prime-dreams.onrender.com' }
];

function pingTarget(target) {
  const start = Date.now();
  const req = https.get(target.url, { timeout: 30000 }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const elapsed = Date.now() - start;
      console.log(`[${new Date().toISOString()}] \x1b[32m✔\x1b[0m ${target.name.padEnd(15)} -> HTTP ${res.statusCode} (${elapsed}ms)`);
    });
  });

  req.on('timeout', () => {
    req.destroy();
    console.warn(`[${new Date().toISOString()}] \x1b[33m⚠\x1b[0m ${target.name.padEnd(15)} -> Timed out (waking up...)`);
  });

  req.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] \x1b[31m✖\x1b[0m ${target.name.padEnd(15)} -> Error: ${err.message}`);
  });
}

function runCycle() {
  console.log(`\n--- [Keep-Alive Cycle: ${new Date().toISOString()}] ---`);
  TARGETS.forEach(target => pingTarget(target));
}

console.log('🚀 Prime Dreems Render Keep-Alive Daemon started.');
console.log(`Interval: Every ${PING_INTERVAL_MS / 60000} minutes`);
runCycle();
setInterval(runCycle, PING_INTERVAL_MS);
