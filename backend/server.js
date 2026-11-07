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
require('./db/models'); // Load all models and associations
const { seedCricketMatches } = require('./db/seedCricket');
const { startLiveMatchWorker } = require('./services/cricbuzzService');
const { startIngestionService } = require('./services/ingestion/ingestionWorker');
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

// Static uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
  try {
    await sequelize.sync();
    console.log('📦 Database synced');

    // Seed cricket matches & squads if empty
    await seedCricketMatches();

    // Attach WebSocket Gateway on /ws (Section 3)
    wsGateway.initialize(server);

    // Start Ingestion Service with validation, deduplication, dual-source & hotStore (Section 1 & 2)
    startIngestionService();

    // Start Contest Lock scheduler (§15)
    setInterval(checkContestLocks, 30000);
    checkContestLocks();

    const serverCallback = () => {
      console.log(`🏆 Prime Dreems API running on http://localhost:${config.PORT}`);
      console.log(`🩺 Health check: http://localhost:${config.PORT}/health`);
      console.log(`🏏 Matches endpoint: http://localhost:${config.PORT}/api/matches`);
      console.log(`⚡ WebSocket gateway: ws://localhost:${config.PORT}/ws`);
    };

    if (process.env.HOST) {
      server.listen(config.PORT, process.env.HOST, serverCallback);
    } else {
      server.listen(config.PORT, serverCallback);
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
