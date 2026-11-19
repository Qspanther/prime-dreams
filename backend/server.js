// 🏆 PRIME DREEMS — CRICKET FANTASY SPORTS PLATFORM
// Backend Express API & Live Scoring Engine

const express = require('express');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const config = require('./config');
const sequelize = require('./db/index');
const { SystemSetting } = require('./db/models'); // Load all models and associations
// const { seedCricketMatches } = require('./db/seedCricket'); // DISABLED: No auto-seeding on restart
const { seedDefaultUsers } = require('./db/seedDefaultUsers');
const { startLiveMatchWorker } = require('./services/cricbuzzService');
const wsGateway = require('./services/websocket/wsGateway');
const { checkContestLocks } = require('./services/contestService');
const { authenticate, isAdmin } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

// Trust proxy for reverse proxy headers
app.set('trust proxy', 1);

// Global crash guards
process.on('uncaughtException', (err) => {
  console.error('🛡️ [Server Guard] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('🛡️ [Server Guard] Unhandled Rejection:', reason);
});

// Security Headers (Helmet)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  validate: { xForwardedForHeader: false },
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);
app.use('/wallet', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  validate: { xForwardedForHeader: false },
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again in 15 minutes.' },
});
app.use('/auth/login', authLimiter);
app.use('/auth/signup', authLimiter);

// Middleware
app.use(compression());
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory with 7-day client cache for mobile speed
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d', immutable: true }));
app.get('/uploads/:filename', async (req, res) => {
  const filename = String(req.params.filename || '');
  if (!/^[a-z0-9_-]+\.(?:jpe?g|png|webp|gif)$/i.test(filename)) {
    return res.sendStatus(404);
  }

  try {
    const asset = await SystemSetting.findOne({ where: { key: `uploaded_media:${filename}` } });
    const imageData = asset?.value?.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([a-z0-9+/=]+)$/i);
    if (!imageData) return res.sendStatus(404);

    res.set({
      'Content-Type': imageData[1],
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.send(Buffer.from(imageData[2], 'base64'));
  } catch (error) {
    console.error('Uploaded image lookup error:', error.message);
    return res.sendStatus(500);
  }
});

// Request logging (development)
app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString().slice(11, 19)}] ${req.method} ${req.path}`);
  }
  next();
});

// ─── API Routes ───
const cricketRoutes = require('./routes/cricket');
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const adminRoutes = require('./routes/admin');
const notifRoutes = require('./routes/notifications');
const subRoutes = require('./routes/subscription');
const rewardsRoutes = require('./routes/rewards');
const guruRoutes = require('./routes/guru');
const gamificationRoutes = require('./routes/gamification');

// Dual mounting: direct and /api prefixed to guarantee zero 404s
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

app.use('/wallet', walletRoutes);
app.use('/api/wallet', walletRoutes);

app.use('/admin', adminRoutes);
app.use('/api/admin', adminRoutes);

app.use('/notifications', notifRoutes);
app.use('/api/notifications', notifRoutes);

app.use('/subscription', subRoutes);
app.use('/api/subscription', subRoutes);

app.use('/rewards', rewardsRoutes);
app.use('/api/rewards', rewardsRoutes);

app.use('/guru', guruRoutes);
app.use('/api/guru', guruRoutes);

app.use('/gamification', gamificationRoutes);
app.use('/api/gamification', gamificationRoutes);

const botManagerRoutes = require('./routes/bot-manager').router;
app.use('/bot-manager', botManagerRoutes);
app.use('/api/bot-manager', botManagerRoutes);

app.use('/api/config', require('./routes/config'));

// Cricket routes mounted at both /api and root /
app.use('/api', cricketRoutes);
app.use('/', cricketRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', platform: 'Prime Dreems', timestamp: new Date().toISOString() });
});

// Root welcome page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Prime Dreems API</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1C1A17; color: #fff; text-align: center; padding: 60px 20px; }
          .card { max-width: 540px; margin: 0 auto; background: #26221B; border: 1px solid #3D352A; border-radius: 16px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          h1 { color: #E53935; margin-bottom: 8px; font-size: 26px; }
          p { color: #D1C7B7; font-size: 15px; line-height: 1.6; }
          .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; background: rgba(229, 57, 53, 0.15); border: 1px solid #E53935; color: #FFD54F; font-weight: bold; font-size: 13px; margin: 12px 0 20px; }
          .btn { display: inline-block; padding: 12px 24px; background: #E53935; color: #fff; text-decoration: none; font-weight: bold; border-radius: 8px; margin-top: 16px; }
          .btn:hover { background: #FFC107; color: #1C1A17; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🏏 Prime Dreems Fantasy Engine</h1>
          <div class="badge">● Server Active &amp; Live</div>
          <p>Prime Dreems Fantasy Sports API &amp; Live Scoring Engine running on Port 5000.</p>
          <a class="btn" href="http://localhost:3000">Open Prime Dreems Web App &rarr;</a>
        </div>
      </body>
    </html>
  `);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
async function start() {
  const serverCallback = () => {
    console.log(`🏆 Prime Dreems API running on http://localhost:${config.PORT}`);
    console.log(`🩺 Health check: http://localhost:${config.PORT}/health`);
    console.log(`🏏 Matches endpoint: http://localhost:${config.PORT}/api/matches`);
    console.log(`🤖 Bot Manager endpoint: http://localhost:${config.PORT}/bot-manager`);
    console.log(`⚡ WebSocket gateway: ws://localhost:${config.PORT}/ws`);
  };

  // 1. Immediately bind and start listening so Render health check passes in < 2ms!
  if (process.env.HOST) {
    server.listen(config.PORT, process.env.HOST, serverCallback);
  } else {
    server.listen(config.PORT, serverCallback);
  }

  // 2. Attach WebSocket Gateway on /ws (Section 3)
  try {
    wsGateway.initialize(server);
  } catch (wsErr) {
    console.warn('⚠️ WebSocket initialization notice:', wsErr.message);
  }

  // 3. Asynchronously initialize database, models, bots, and background schedulers
  try {
    await sequelize.sync();
    console.log('📦 Database synced');
  } catch (dbErr) {
    console.warn('⚠️ Database sync notice:', dbErr.message);
  }

  // Load admin deleted matches tombstones
  try {
    const { loadDeletedMatches } = require('./services/deletedMatchesRegistry');
    await loadDeletedMatches();
    console.log('🛡️ Deleted matches tombstones loaded');
  } catch (tombErr) {
    console.warn('⚠️ Deleted matches tombstones notice:', tombErr.message);
  }

  // Ensure default Admin & User accounts exist
  try {
    await seedDefaultUsers();
  } catch (defaultUserErr) {
    console.warn('⚠️ Default users seed notice:', defaultUserErr.message);
  }

  // Ensure 10,000 Autonomous Bots exist in DB
  try {
    const { User } = require('./db/models');
    const { seedBots } = require('./services/seed-10000-bots');
    const botCount = await User.count({ where: { is_bot: true } });
    if (botCount === 0) {
      console.log('🤖 Initializing 10,000 autonomous bots in DB on startup...');
      await seedBots(10000);
    }
  } catch (botSeedErr) {
    console.warn('⚠️ Bot network seed notice:', botSeedErr.message);
  }

  // 🛡️ Auto-seeding of default sample matches and contests on server restart
  // has been DISABLED. Only admin-created matches and contests will persist.
  // If you ever need to re-seed, run `node backend/db/seedCricket.js` manually.
  console.log('🛡️ [Startup] Default match/contest auto-seeding is DISABLED. Only admin-created data will show.');

  // Start Ingestion Worker (Free tier: 30s poll, toggled via ENABLE_INGESTION)
  if (process.env.ENABLE_INGESTION !== 'false') {
    try {
      const { startWorker } = require('./ingestion/worker');
      const pollInterval = parseInt(process.env.INGESTION_POLL_INTERVAL_MS || '30000', 10);
      startWorker(pollInterval);
    } catch (ingestErr) {
      console.warn('⚠️ Ingestion worker notice:', ingestErr.message);
    }
  } else {
    console.log('⏸️ Ingestion worker disabled via ENABLE_INGESTION=false');
  }

  // Start Contest Lock scheduler (§15)
  try {
    setInterval(checkContestLocks, 30000);
    checkContestLocks();
  } catch (lockErr) {
    console.warn('⚠️ Contest lock scheduler notice:', lockErr.message);
  }

  // Start Autonomous 1-Hour Rule Bot Engine & End-Game Tactical Rearranger
  if (process.env.ENABLE_INTERNAL_BOT_SCHEDULER !== 'false') {
    try {
      const { botScheduler } = require('./services/botScheduler');
      botScheduler.startScheduler(30000);
      console.log('🤖 Autonomous 10,000 Bot Scheduler & 1-Hour Rule Engine active (30s tick)');
    } catch (botErr) {
      console.warn('⚠️ Bot scheduler startup notice:', botErr.message);
    }
  } else {
    console.log('🛡️ [Bot Isolation] Internal bot scheduler disabled on backend API — handled by dedicated bot service.');
  }
}

start();
