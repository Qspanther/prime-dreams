// 🤖 PRIME DREEMS — DEDICATED BOT SERVICE (RENDER FREE TIER COMPATIBLE)
// Isolated process with independent Express server, dedicated PG pool (max 3 connections),
// and internal /ws-bots WebSocket path. Completely decoupled from user backend (port 5000).

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const scheduler = require('./scheduler');
const { getNeonActiveConnections, isPostgres } = require('./db');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || process.env.BOT_SERVICE_PORT || 5100;
const BOT_MANAGER_KEY = process.env.BOT_MANAGER_KEY || process.env.BOT_API_KEY || 'c11_bot_mgr_sec_9938a7fbc21d49e';
const BOT_INTERVAL_MS = parseInt(process.env.BOT_INTERVAL_MS || '60000', 10);

app.use(express.json());

// ─── Health Check for Render Keep-Alive ───
app.get('/health', async (req, res) => {
  const neonConns = await getNeonActiveConnections();
  const status = scheduler.getStatus();
  res.json({
    status: 'ok',
    service: 'prime-dreems-bot-service',
    port: PORT,
    database: isPostgres() ? 'neon-postgres' : 'sqlite-local',
    neon_active_connections: neonConns,
    scheduler: status,
    timestamp: new Date().toISOString(),
  });
});

// ─── Mount Bot Manager Admin API ───
try {
  const botManagerRoutes = require('../routes/bot-manager').router;
  app.use('/bot-manager', botManagerRoutes);
  app.use('/api/bot-manager', botManagerRoutes);
} catch (routeErr) {
  console.warn('⚠️ Could not mount legacy bot-manager routes:', routeErr.message);
}

// ─── Internal WebSocket Gateway on /ws-bots ───
const botWss = new WebSocketServer({
  server,
  path: '/ws-bots',
  maxPayload: 8 * 1024,
});

botWss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'BOT_GATEWAY_CONNECTED',
    time: new Date().toISOString(),
  }));
});

// ─── Start Server ───
server.listen(PORT, () => {
  console.log(`🤖 Prime Dreems Bot Service running on port ${PORT}`);
  console.log(`🩺 Bot Health check: http://localhost:${PORT}/health`);
  console.log(`⚡ Internal Bot WebSocket: ws://localhost:${PORT}/ws-bots`);

  // Start Autonomous Organic Scheduler
  if (process.env.ENABLE_BOT_SERVICE !== 'false') {
    scheduler.start(BOT_INTERVAL_MS);
  } else {
    console.log('⏸️ Bot scheduler disabled via ENABLE_BOT_SERVICE=false');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🤖 Shutting down bot service...');
  scheduler.stop();
  server.close(() => process.exit(0));
});
