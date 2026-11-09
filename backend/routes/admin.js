const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate, isAdmin } = require('../middleware/auth');
const { purgeCache } = require('../middleware/cache');
const {
  User, Creator, Tournament, Team, Wallet, Transaction, Notification,
  SystemSetting, ReferralLog, CricketMatch, CricketPlayer, MatchContest,
  CricketTeam, TeamPlayer, H2HChallenge, ScoreAuditLog, PlayerPointsLog
} = require('../db/models');
const config = require('../config');
const sequelize = require('../db/index');
const { deleteMatchPermanently } = require('../services/cricketDeleteHelper');

const router = express.Router();

// Setup Multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, WEBP, and GIF images are allowed.'));
    }
  }
});

// All routes require authentication AND admin role
router.use(authenticate);
router.use(isAdmin);

// ─── 0. Dashboard Stats (in INR) ───
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalCreators = await Creator.count();
    const totalTournaments = await Tournament.count();
    const activeMatches = await Tournament.count({ where: { status: 'live' } });
    
    const investedSum = await Transaction.sum('amount', { where: { type: 'entry_fee', status: 'completed' } });
    const prizeSum = await Tournament.sum('prize_pool');
    const pendingDepositsCount = await Transaction.count({ where: { type: 'deposit', status: 'pending' } });
    const pendingWithdrawalsCount = await Transaction.count({ where: { type: 'withdraw', status: 'pending' } });
    
    const totalInvested = Math.abs(investedSum || 0);
    const totalPrizePool = prizeSum || 0;

    res.json({
      currency: 'INR',
      totalUsers,
      totalCreators,
      totalTournaments,
      activeMatches,
      totalInvested,
      totalPrizePool,
      pendingDepositsCount,
      pendingWithdrawalsCount
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// ─── 1. Users ───
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password_hash', 'otp_code'] },
      include: [{ model: Wallet, as: 'wallet' }],
      order: [['createdAt', 'DESC']],
    });
    res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password_hash', 'otp_code'] }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const teams = await Team.findAll({
      where: { user_id: req.params.id },
      include: [{ model: Tournament, as: 'Tournament' }],
      order: [['createdAt', 'DESC']],
    });
    
    const wallet = await Wallet.findOne({ where: { user_id: req.params.id } });
    let transactions = [];
    if (wallet) {
      transactions = await Transaction.findAll({
        where: { wallet_id: wallet.id },
        order: [['createdAt', 'DESC']],
      });
    }
    
    res.json({ user, teams, wallet, transactions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─── 2. Creators ───
router.get('/creators', async (req, res) => {
  try {
    const creators = await Creator.findAll({
      order: [['platform', 'ASC'], ['name', 'ASC']],
    });
    res.json(creators);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch creators' });
  }
});

router.put('/creators/:id', async (req, res) => {
  try {
    const creator = await Creator.findByPk(req.params.id);
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const fields = [
      'name', 'category', 'credit_cost', 'profile_image_url', 
      'profile_url', 'base_views', 'base_likes', 'base_followers',
      'external_channel_id', 'platform'
    ];
    
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        creator[field] = req.body[field];
      }
    }
    
    await creator.save();
    
    await Notification.create({
      title: 'Creator Updated',
      message: `${creator.name}'s details have been updated by admin!`,
      type: 'creator_updated'
    });

    res.json(creator);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update creator' });
  }
});

// POST create new creator
router.post('/creators', async (req, res) => {
  try {
    const creator = await Creator.create(req.body);
    res.json(creator);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create creator' });
  }
});

// ─── 3. Tournaments & 4 Battle Leagues (6h, 24h, 48h, 72h) ───
router.get('/tournaments', async (req, res) => {
  try {
    const tournaments = await Tournament.findAll({
      order: [['start_time', 'DESC']],
    });
    res.json(tournaments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

// In-flight creation locks to prevent multiple leagues being created by rapid clicks / parallel requests
const activeCreationLocks = new Set();


// Turso Cloud Sync Endpoints
router.get('/turso/status', async (req, res) => {
  try {
    const { isTursoConfigured, getTursoClient } = require('../services/tursoSyncService');
    const configured = isTursoConfigured();
    let cloudUsers = 0;
    let cloudOnline = false;

    if (configured) {
      try {
        const client = getTursoClient();
        const check = await client.execute('SELECT COUNT(*) as count FROM users;');
        cloudUsers = check.rows[0]?.count || 0;
        cloudOnline = true;
      } catch (e) {
        cloudOnline = false;
      }
    }

    res.json({
      configured,
      cloudOnline,
      cloudUsers,
      databaseUrl: process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.replace(/:[^:]*@/, ':***@') : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/turso/sync', async (req, res) => {
  try {
    const { isTursoConfigured, syncToTurso } = require('../services/tursoSyncService');
    if (!isTursoConfigured()) {
      return res.status(400).json({ 
        error: 'Turso Cloud is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Render environment.' 
      });
    }
    const result = await syncToTurso();
    res.json({ success: true, message: 'All database records successfully synced to Turso Cloud!', ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync with Turso: ' + err.message });
  }
});

router.post('/turso/pull', async (req, res) => {
  try {
    const { isTursoConfigured, pullFromTurso } = require('../services/tursoSyncService');
    if (!isTursoConfigured()) {
      return res.status(400).json({ 
        error: 'Turso Cloud is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Render environment.' 
      });
    }
    const result = await pullFromTurso();
    res.json({ success: true, message: 'Latest database records pulled from Turso Cloud!', ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pull from Turso: ' + err.message });
  }
});

router.post('/tournaments', async (req, res) => {
  const cleanName = String(req.body.name || '').trim();
  if (!cleanName) {
    return res.status(400).json({ error: 'Tournament name is required' });
  }

  const lockKey = `${cleanName.toLowerCase()}_${req.body.platform || 'youtube'}`;
  if (activeCreationLocks.has(lockKey)) {
    console.log(`⚠️ Active creation lock hit for "${cleanName}". Preventing duplicate parallel creation.`);
    // Wait for in-flight creation to finish and return that tournament
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 100));
      const existing = await Tournament.findOne({
        where: { name: cleanName, platform: req.body.platform || 'youtube' },
        order: [['createdAt', 'DESC']]
      });
      if (existing) return res.json(existing);
    }
  }

  activeCreationLocks.add(lockKey);

  try {
    const { Op } = require('sequelize');
    const recentDuplicate = await Tournament.findOne({
      where: {
        name: cleanName,
        platform: req.body.platform || 'youtube',
        created_at: { [Op.gte]: new Date(Date.now() - 30000) }
      }
    });
    if (recentDuplicate) {
      console.log(`⚠️ Prevented duplicate league creation for "${cleanName}". Returning existing tournament.`);
      return res.json(recentDuplicate);
    }

    const platform = String(req.body.platform || 'youtube').toLowerCase();
    const durationHours = parseFloat(req.body.duration_hours) || (config.TOURNAMENT_DURATIONS_HOURS[req.body.duration_type] || 24);
    const durationType = req.body.duration_type || `${durationHours}h`;

    const now = new Date();
    const defaultStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const defaultLock = new Date(defaultStart.getTime() - (config.LOCK_BEFORE_START_MINUTES || 30) * 60 * 1000);

    const startTime = req.body.start_time && String(req.body.start_time).trim() ? new Date(req.body.start_time) : defaultStart;
    const lockTime = req.body.lock_time && String(req.body.lock_time).trim() ? new Date(req.body.lock_time) : defaultLock;
    // Auto-calculate end_time from start_time + durationHours
    const calculatedEnd = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
    const endTime = req.body.end_time && String(req.body.end_time).trim() ? new Date(req.body.end_time) : calculatedEnd;

    const entryFee = req.body.entry_fee !== undefined && req.body.entry_fee !== ''
      ? parseFloat(req.body.entry_fee)
      : 99.00;
    const prizePool = req.body.prize_pool !== undefined && req.body.prize_pool !== ''
      ? parseFloat(req.body.prize_pool)
      : 50000.00;

    const data = {
      ...req.body,
      name: cleanName,
      platform,
      duration_type: durationType,
      entry_fee: isNaN(entryFee) ? 99.00 : entryFee,
      prize_pool: isNaN(prizePool) ? 50000.00 : prizePool,
      start_time: startTime,
      lock_time: lockTime,
      end_time: endTime,
      status: req.body.status || 'upcoming',
      rankings_finalized: false,
      max_participants: req.body.max_participants || 1100,
    };
    const t = await Tournament.create(data);

    await Notification.create({
      title: 'New Battle League Available',
      message: `A new ${t.platform} league "${t.name}" (${t.duration_type}) has been created.`,
      type: 'tournament_created'
    });

    // Immediately trigger initial organic bot deployment (25 to 40 bots) so tournament is never empty
    try {
      const { registerStaggeredBots } = require('./bot-manager');
      const botResult = await registerStaggeredBots(t.id, { immediateBatch: Math.floor(Math.random() * 16) + 25 });
      t.current_participants = botResult.total;
    } catch (botErr) {
      console.error('Failed to trigger bot manager on tournament create:', botErr.message);
    }

    res.json(t);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create tournament: ' + error.message });
  } finally {
    // Keep lock for 5 seconds to absorb any remaining retry attempts
    setTimeout(() => {
      activeCreationLocks.delete(lockKey);
    }, 5000);
  }
});

// POST /admin/tournaments/:id/deploy-bots — Instantly deploy all remaining 1100 bots
router.post('/tournaments/:id/deploy-bots', async (req, res) => {
  try {
    const { registerStaggeredBots } = require('./bot-manager');
    const result = await registerStaggeredBots(req.params.id, { all: true });
    res.json({
      success: true,
      message: `Successfully registered ${result.registered} bots. Total teams: ${result.total}`,
      ...result
    });
  } catch (error) {
    console.error('Failed to deploy bots:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/tournaments/:id', async (req, res) => {
  try {
    const t = await Tournament.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: 'Tournament not found' });
    
    const oldStatus = t.status;
    const updateData = { ...req.body };
    if (updateData.entry_fee !== undefined && updateData.entry_fee !== '') {
      const parsedFee = parseFloat(updateData.entry_fee);
      if (!isNaN(parsedFee)) updateData.entry_fee = parsedFee;
    }
    if (updateData.prize_pool !== undefined && updateData.prize_pool !== '') {
      const parsedPrize = parseFloat(updateData.prize_pool);
      if (!isNaN(parsedPrize)) updateData.prize_pool = parsedPrize;
    }
    await t.update(updateData);

    if (oldStatus !== 'live' && t.status === 'live') {
      await Notification.create({
        title: 'League is LIVE!',
        message: `The ${t.platform} league "${t.name}" is now live. Follow the action!`,
        type: 'tournament_live'
      });
    }

    res.json(t);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

// DELETE /admin/tournaments/:id — Instant Cascade delete with fault tolerance
router.delete('/tournaments/:id', async (req, res) => {
  try {
    const { Tournament } = require('../db/models');
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tid = tournament.id;
    const name = tournament.name;

    // Execute cascading deletes safely
    const cascadeQueries = [
      'DELETE FROM scores WHERE team_id IN (SELECT id FROM teams WHERE tournament_id = :tid)',
      'DELETE FROM team_creators WHERE team_id IN (SELECT id FROM teams WHERE tournament_id = :tid)',
      'DELETE FROM teams WHERE tournament_id = :tid',
      'DELETE FROM leaderboard WHERE tournament_id = :tid',
      'DELETE FROM creator_stats_snapshots WHERE tournament_id = :tid',
      'DELETE FROM contest_participants WHERE contest_id IN (SELECT id FROM contests WHERE tournament_id = :tid)',
      'DELETE FROM contests WHERE tournament_id = :tid',
      'DELETE FROM tournaments WHERE id = :tid'
    ];

    for (const q of cascadeQueries) {
      try {
        await sequelize.query(q, { replacements: { tid } });
      } catch (subErr) {
        console.warn(`[Admin Delete Subquery Warning]: ${subErr.message}`);
      }
    }

    // Direct model destroy fallback to ensure record removal
    try {
      await tournament.destroy();
    } catch (_) {}

    console.log(`🗑️ [Admin] Tournament "${name}" (ID: ${tid}) and all associated records deleted successfully.`);
    purgeCache('/tournaments');
    res.json({ success: true, message: `Tournament "${name}" deleted successfully` });
  } catch (error) {
    console.error('Failed to delete tournament:', error);
    res.status(500).json({ error: 'Failed to delete tournament: ' + error.message });
  }
});

router.post('/tournaments/:id/contests', async (req, res) => {
  try {
    const { Contest } = require('../db/models');
    const tournament = await Tournament.findByPk(req.params.id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    
    const contestsData = req.body.contests || [req.body];
    const createdContests = [];
    
    for (const data of contestsData) {
      const contest = await Contest.create({
        ...data,
        tournament_id: tournament.id
      });
      createdContests.push(contest);
    }
    
    res.json(createdContests);
  } catch (error) {
    console.error('Failed to create contests:', error);
    res.status(500).json({ error: 'Failed to create contests' });
  }
});

// ─── 4. INR Payment Gateway & Official Account Settings ───

const DEFAULT_INR_ADMIN_SETTINGS = {
  inr_upi_id: 'creator11.league@upi',
  inr_upi_name: 'Creator Entertainment League',
  inr_bank_name: 'HDFC Bank Ltd',
  inr_account_number: '50200084729104',
  inr_ifsc: 'HDFC0000240',
  inr_account_name: 'Creator Entertainment League Pvt Ltd'
};

// GET /admin/inr-settings (also aliases /admin/crypto-settings)
router.get(['/inr-settings', '/crypto-settings'], async (req, res) => {
  try {
    const keys = Object.keys(DEFAULT_INR_ADMIN_SETTINGS);
    const settings = await SystemSetting.findAll({
      where: { key: keys }
    });

    const result = { ...DEFAULT_INR_ADMIN_SETTINGS };
    settings.forEach(s => {
      if (s.value) result[s.key] = s.value;
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch INR settings' });
  }
});

// PUT /admin/inr-settings (also aliases /admin/crypto-settings)
router.put(['/inr-settings', '/crypto-settings'], async (req, res) => {
  try {
    const data = req.body;

    const upsertSetting = async (key, value, description) => {
      if (value !== undefined) {
        const existing = await SystemSetting.findOne({ where: { key } });
        if (existing) {
          await existing.update({ value });
        } else {
          await SystemSetting.create({ key, value, description });
        }
      }
    };

    if (data.inr_upi_id) await upsertSetting('inr_upi_id', data.inr_upi_id.trim(), 'Official Admin UPI ID');
    if (data.inr_upi_name) await upsertSetting('inr_upi_name', data.inr_upi_name.trim(), 'UPI Payee Name');
    if (data.inr_bank_name) await upsertSetting('inr_bank_name', data.inr_bank_name.trim(), 'Corporate Bank Name');
    if (data.inr_account_number) await upsertSetting('inr_account_number', data.inr_account_number.trim(), 'Corporate Account Number');
    if (data.inr_ifsc) await upsertSetting('inr_ifsc', data.inr_ifsc.trim().toUpperCase(), 'Bank IFSC Code');
    if (data.inr_account_name) await upsertSetting('inr_account_name', data.inr_account_name.trim(), 'Account Beneficiary Name');

    res.json({ message: 'INR payment gateway settings updated successfully!' });
  } catch (error) {
    console.error('Update INR settings error:', error);
    res.status(500).json({ error: 'Failed to update INR settings' });
  }
});

// GET /admin/deposits/pending — Queue of pending deposits with TXID
router.get('/deposits/pending', async (req, res) => {
  try {
    const deposits = await Transaction.findAll({
      where: { type: 'deposit', status: 'pending' },
      include: [
        {
          model: Wallet,
          include: [{ model: User, attributes: ['id', 'name', 'email', 'phone'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(deposits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending deposits' });
  }
});

// POST /admin/deposits/:id/approve — 1-Click Approve & Credit INR Balance
router.post('/deposits/:id/approve', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const tx = await Transaction.findByPk(req.params.id, {
      include: [{ model: Wallet, include: [User] }],
      transaction: t
    });

    if (!tx) {
      await t.rollback();
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (tx.status !== 'pending' || tx.type !== 'deposit') {
      await t.rollback();
      return res.status(400).json({ error: 'Transaction is not in pending deposit state' });
    }

    const wallet = tx.Wallet;
    if (!wallet) {
      await t.rollback();
      return res.status(404).json({ error: 'User wallet not found' });
    }

    const newBalance = parseFloat(wallet.balance) + parseFloat(tx.amount);
    await wallet.update({
      balance: newBalance,
      deposit_balance: (parseFloat(wallet.deposit_balance) || 0) + parseFloat(tx.amount),
    }, { transaction: t });
    await tx.update({ status: 'completed' }, { transaction: t });

    // Send notification to user
    await Notification.create({
      user_id: wallet.user_id,
      title: 'INR Deposit Confirmed! 🎉',
      message: `₹${tx.amount} has been verified and added to your balance. Happy Gaming!`,
      type: 'wallet_deposit_approved'
    }, { transaction: t });

    await t.commit();
    res.json({ message: 'Deposit approved and INR balance credited successfully!', balance: newBalance });
  } catch (error) {
    await t.rollback();
    console.error('Approve deposit error:', error);
    res.status(500).json({ error: 'Failed to approve deposit' });
  }
});

// POST /admin/deposits/:id/reject — Reject Deposit
router.post('/deposits/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const tx = await Transaction.findByPk(req.params.id, {
      include: [{ model: Wallet }]
    });

    if (!tx || tx.status !== 'pending') {
      return res.status(400).json({ error: 'Invalid transaction' });
    }

    await tx.update({
      status: 'rejected',
      description: `${tx.description || 'Deposit'} [REJECTED: ${reason || 'Invalid TXID / No funds received'}]`
    });

    if (tx.Wallet && tx.Wallet.user_id) {
      await Notification.create({
        user_id: tx.Wallet.user_id,
        title: 'INR Deposit Rejected ⚠️',
        message: `Your deposit proof for ₹${tx.amount} was rejected. Reason: ${reason || 'Invalid TXID'}.`,
        type: 'wallet_deposit_rejected'
      });
    }

    res.json({ message: 'Deposit marked as rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject deposit' });
  }
});

// GET /admin/withdrawals/pending — Queue of pending payouts
router.get('/withdrawals/pending', async (req, res) => {
  try {
    const withdrawals = await Transaction.findAll({
      where: { type: 'withdraw', status: 'pending' },
      include: [
        {
          model: Wallet,
          include: [{ model: User, attributes: ['id', 'name', 'email', 'phone'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending withdrawals' });
  }
});

// POST /admin/withdrawals/:id/approve — Complete Payout
router.post('/withdrawals/:id/approve', async (req, res) => {
  try {
    const tx = await Transaction.findByPk(req.params.id, {
      include: [{ model: Wallet }]
    });

    if (!tx || tx.status !== 'pending') {
      return res.status(400).json({ error: 'Invalid transaction' });
    }

    await tx.update({ status: 'completed' });

    if (tx.Wallet && tx.Wallet.user_id) {
      await Notification.create({
        user_id: tx.Wallet.user_id,
        title: 'INR Withdrawal Sent! 💸',
        message: `Your payout of ₹${Math.abs(tx.amount)} has been successfully transferred to your external wallet.`,
        type: 'wallet_withdrawal_approved'
      });
    }

    res.json({ message: 'Withdrawal marked as completed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve withdrawal' });
  }
});

// POST /admin/withdrawals/:id/reject — Reject and Refund Balance
router.post('/withdrawals/:id/reject', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { reason } = req.body;
    const tx = await Transaction.findByPk(req.params.id, {
      include: [{ model: Wallet }],
      transaction: t
    });

    if (!tx || tx.status !== 'pending') {
      await t.rollback();
      return res.status(400).json({ error: 'Invalid transaction' });
    }

    const wallet = tx.Wallet;
    if (wallet) {
      const refundAmt = Math.abs(parseFloat(tx.amount));
      await wallet.update({
        balance: parseFloat(wallet.balance) + refundAmt,
        deposit_balance: (parseFloat(wallet.deposit_balance) || 0) + refundAmt,
      }, { transaction: t });
    }

    await tx.update({
      status: 'rejected',
      description: `${tx.description || 'Withdrawal'} [REJECTED: ${reason || 'Invalid Wallet Address'}]`
    }, { transaction: t });

    if (wallet && wallet.user_id) {
      await Notification.create({
        user_id: wallet.user_id,
        title: 'INR Withdrawal Cancelled & Refunded',
        message: `Your withdrawal was cancelled and ₹${Math.abs(tx.amount)} refunded. Reason: ${reason || 'Invalid address'}.`,
        type: 'wallet_withdrawal_rejected'
      }, { transaction: t });
    }

    await t.commit();
    res.json({ message: 'Withdrawal rejected and funds refunded to user' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: 'Failed to reject withdrawal' });
  }
});

// ─── 5. Points Formula & Scoring Engine Config ───

// GET /admin/points-formula
router.get('/points-formula', async (req, res) => {
  try {
    const setting = await SystemSetting.findOne({ where: { key: 'points_formula' } });
    if (setting && setting.value) {
      return res.json(JSON.parse(setting.value));
    }

    res.json({
      youtube_views: config.SCORING_WEIGHTS.youtube_views,
      instagram_likes: config.SCORING_WEIGHTS.instagram_likes,
      instagram_followers: config.SCORING_WEIGHTS.instagram_followers,
      captain_multiplier: config.CAPTAIN_MULTIPLIER,
      vice_captain_multiplier: config.VICE_CAPTAIN_MULTIPLIER
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch points formula' });
  }
});

// PUT /admin/points-formula
router.put('/points-formula', async (req, res) => {
  try {
    const { youtube_views, instagram_likes, instagram_followers, captain_multiplier, vice_captain_multiplier } = req.body;
    
    const formula = {
      youtube_views: parseFloat(youtube_views) || 0.0001,
      instagram_likes: parseFloat(instagram_likes) || 0.0001,
      instagram_followers: parseFloat(instagram_followers) || 0.0002,
      captain_multiplier: parseFloat(captain_multiplier) || 2.0,
      vice_captain_multiplier: parseFloat(vice_captain_multiplier) || 1.5,
    };

    config.SCORING_WEIGHTS.youtube_views = formula.youtube_views;
    config.SCORING_WEIGHTS.instagram_likes = formula.instagram_likes;
    config.SCORING_WEIGHTS.instagram_followers = formula.instagram_followers;
    config.CAPTAIN_MULTIPLIER = formula.captain_multiplier;
    config.VICE_CAPTAIN_MULTIPLIER = formula.vice_captain_multiplier;

    const existing = await SystemSetting.findOne({ where: { key: 'points_formula' } });
    if (existing) {
      await existing.update({ value: JSON.stringify(formula) });
    } else {
      await SystemSetting.create({
        key: 'points_formula',
        value: JSON.stringify(formula),
        description: 'Scoring engine weights and multipliers'
      });
    }

    res.json({ message: 'Points formula updated successfully!', formula });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update points formula' });
  }
});

// POST /upload image
router.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: imageUrl, filename: req.file.filename });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});


// ─── SUBSCRIPTION & REFERRAL ROUNDS CONTROLS ───

// GET /admin/subscription-settings
router.get('/subscription-settings', authenticate, isAdmin, async (req, res) => {
  try {
    const keys = [
      'subscription_enabled',
      'subscription_free_mode',
      'subscription_free_until',
      'share_unlock_target',
      'share_unlock_reward_days',
      'subscription_monthly_price',
      'subscription_duration_days',
    ];

    const settingsRows = await SystemSetting.findAll({ where: { key: keys } });
    const settingsMap = {};
    settingsRows.forEach(s => { settingsMap[s.key] = s.value; });

    const now = new Date();
    const activeSubscribersCount = await User.count({
      where: {
        is_bot: false,
        subscription_active_until: { [sequelize.Sequelize.Op.gt]: now }
      }
    });

    const paidSubscribersCount = await User.count({
      where: {
        is_bot: false,
        subscription_type: 'paid_monthly',
        subscription_active_until: { [sequelize.Sequelize.Op.gt]: now }
      }
    });

    const shareUnlockedUsersCount = await User.count({
      where: {
        is_bot: false,
        subscription_type: 'share_unlocked',
        subscription_active_until: { [sequelize.Sequelize.Op.gt]: now }
      }
    });

    let totalSharesLogged = 0;
    try {
      totalSharesLogged = await ShareLog.count();
    } catch (e) {}

    const totalReferralsMade = await ReferralLog.count();

    // Fetch human users list with share and subscription details
    const targetShares = parseInt(settingsMap.share_unlock_target || '3', 10);
    const users = await User.findAll({
      where: { is_bot: false },
      attributes: [
        'id', 'name', 'email', 'phone', 'role', 'referral_code',
        'subscription_active_until', 'subscription_type',
        'total_shares_count', 'total_referrals_count', 'created_at'
      ],
      order: [['created_at', 'DESC']],
      limit: 50
    });

    const userList = users.map(u => {
      const hasActivePass = Boolean(u.subscription_active_until && new Date(u.subscription_active_until) > now);
      const isShareTargetMet = Math.max(u.total_shares_count || 0, u.total_referrals_count || 0) >= targetShares;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        referralCode: u.referral_code,
        subscriptionActiveUntil: u.subscription_active_until,
        subscriptionType: u.subscription_type || 'none',
        hasActivePass,
        isShareTargetMet,
        totalShares: u.total_shares_count || 0,
        totalReferrals: u.total_referrals_count || 0,
        createdAt: u.created_at
      };
    });

    res.json({
      settings: {
        subscription_enabled: settingsMap.subscription_enabled || 'true',
        subscription_free_mode: settingsMap.subscription_free_mode || 'false',
        subscription_free_until: settingsMap.subscription_free_until || '',
        share_unlock_target: settingsMap.share_unlock_target || '3',
        share_unlock_reward_days: settingsMap.share_unlock_reward_days || '30',
        subscription_monthly_price: settingsMap.subscription_monthly_price || '199',
        subscription_duration_days: settingsMap.subscription_duration_days || '30',
      },
      stats: {
        activeSubscribersCount,
        paidSubscribersCount,
        shareUnlockedUsersCount,
        totalSharesLogged,
        totalReferralsMade,
      },
      users: userList
    });
  } catch (error) {
    console.error('Error fetching subscription settings:', error);
    res.status(500).json({ error: 'Failed to fetch subscription settings' });
  }
});

// PUT /admin/subscription-settings
router.put('/subscription-settings', authenticate, isAdmin, async (req, res) => {
  try {
    const allowedKeys = [
      'subscription_enabled',
      'subscription_free_mode',
      'subscription_free_until',
      'share_unlock_target',
      'share_unlock_reward_days',
      'subscription_monthly_price',
      'subscription_duration_days',
    ];

    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        const val = String(req.body[key]).trim();
        const existing = await SystemSetting.findOne({ where: { key } });
        if (existing) {
          await existing.update({ value: val });
        } else {
          await SystemSetting.create({ key, value: val, description: `Admin setting for ${key}` });
        }
      }
    }

    res.json({ success: true, message: 'Subscription & Share Policy settings updated successfully!' });
  } catch (error) {
    console.error('Error updating subscription settings:', error);
    res.status(500).json({ error: 'Failed to update subscription settings' });
  }
});

// ─── CRICKET ADMIN ENDPOINTS (Prime Dreems v2.1) ───

// GET /admin/cricket/matches (Category filter tabs: All, World Cup, T20, League, Women's) (§5.3, §13)
router.get('/cricket/matches', async (req, res) => {
  try {
    const { category } = req.query;
    const where = {};
    if (category && config.VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }

    const matches = await CricketMatch.findAll({
      where,
      include: [
        { model: CricketPlayer, as: 'players' },
        { model: MatchContest, as: 'contests' },
      ],
      order: [['start_time', 'DESC']],
    });

    res.json({ success: true, matches });
  } catch (error) {
    console.error('Admin cricket matches error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/cricket/matches/verify-and-create (6-Step Match Creation Flow §6, §14)
router.post('/cricket/matches/verify-and-create', async (req, res) => {
  try {
    const {
      team_a, team_b, team_a_logo, team_b_logo, match_poster,
      category, match_date, match_time, venue, lock_time_minutes,
      players, contests
    } = req.body;

    const errors = {};

    // Step 1: Match Details & Category validation (Mandatory 1 of 4)
    if (!team_a || !team_a.trim()) errors.team_a = 'Team A name is required';
    if (!team_b || !team_b.trim()) errors.team_b = 'Team B name is required';
    if (team_a && team_b && team_a.trim().toLowerCase() === team_b.trim().toLowerCase()) {
      errors.team_b = 'Team A and Team B cannot be the same';
    }

    if (!category || !config.VALID_CATEGORIES.includes(category)) {
      errors.category = `Category is mandatory and must be one of: ${config.VALID_CATEGORIES.join(', ')}`;
    }

    if (!match_date) errors.match_date = 'Match date is required';
    if (!match_time) errors.match_time = 'Match start time is required';

    // Step 3: 30 Players validation (15 Team A + 15 Team B mandatory §6)
    if (!Array.isArray(players) || players.length !== 30) {
      errors.players = `Exactly 30 players are mandatory (15 for ${team_a || 'Team A'} and 15 for ${team_b || 'Team B'}). Received ${Array.isArray(players) ? players.length : 0}.`;
    } else {
      const teamAPlayers = players.filter(p => p.team_name === team_a);
      const teamBPlayers = players.filter(p => p.team_name === team_b);

      if (teamAPlayers.length !== 15) {
        errors.team_a_players = `${team_a} must have exactly 15 squad players (got ${teamAPlayers.length})`;
      }
      if (teamBPlayers.length !== 15) {
        errors.team_b_players = `${team_b} must have exactly 15 squad players (got ${teamBPlayers.length})`;
      }

      const validRoles = ['WK', 'BAT', 'AR', 'BOWL'];
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (!p.name || !p.name.trim()) {
          errors[`player_${i}_name`] = `Player #${i + 1} name is missing`;
        }
        if (!p.role || !validRoles.includes(p.role)) {
          errors[`player_${i}_role`] = `Player "${p.name || i}" has invalid role. Must be WK, BAT, AR, or BOWL`;
        }
      }
    }

    // Step 5: Lock time validation (§15)
    const lockMinutes = parseInt(lock_time_minutes, 10);
    if (isNaN(lockMinutes) || lockMinutes < 1) {
      errors.lock_time_minutes = 'Lock time must be at least 1 minute before start';
    }

    // Step 6: DB Verification - if any field mismatch, block with field-level errors (§6)
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Database verification failed. Please correct the highlighted errors.',
        field_errors: errors,
      });
    }

    // Parse start datetime
    const startDateTime = new Date(`${match_date}T${match_time}:00`);

    // Verification passed! Create Match
    const newMatch = await CricketMatch.create({
      title: `${team_a} vs ${team_b} (${category})`,
      category,
      team_a: team_a.trim(),
      team_a_code: team_a.trim().substring(0, 3).toUpperCase(),
      team_a_logo: team_a_logo || '/cricket/team_a.png',
      team_b: team_b.trim(),
      team_b_code: team_b.trim().substring(0, 3).toUpperCase(),
      team_b_logo: team_b_logo || '/cricket/team_b.png',
      match_poster: match_poster || '/cricket/poster.png',
      venue: venue || 'International Cricket Stadium',
      match_date,
      match_time,
      start_time: isNaN(startDateTime.getTime()) ? new Date() : startDateTime,
      lock_time_minutes: lockMinutes || 15,
      status: 'upcoming',
      score_summary: {},
      live_data: {},
    });

    // Create 30 Squad Players
    for (const p of players) {
      await CricketPlayer.create({
        match_id: newMatch.id,
        name: p.name.trim(),
        team_name: p.team_name.trim(),
        role: p.role,
        photo_url: p.photo_url || null,
        credits: parseFloat(p.credits) || 9.0,
        points: 0,
      });
    }

    // Step 4: Create Contests (Standard, Multi-Battlefield, H2H) (§7)
    if (Array.isArray(contests) && contests.length > 0) {
      for (const c of contests) {
        const isH2H = c.type === 'h2h';
        await MatchContest.create({
          match_id: newMatch.id,
          type: c.type || 'standard',
          title: c.title || (isH2H ? 'Head-to-Head Custom Challenge' : `${newMatch.team_a} vs ${newMatch.team_b} Mega Contest`),
          prize_pool: isH2H ? 0 : (parseFloat(c.prize_pool) || 10000),
          entry_fee: isH2H ? 0 : (parseFloat(c.entry_fee) || 49),
          total_spots: isH2H ? 2 : (parseInt(c.total_spots, 10) || 250),
          filled_spots: 0,
          spots_per_battlefield: c.type === 'multi_battlefield' ? (parseInt(c.spots_per_battlefield, 10) || 25) : null,
          battlefield_number: 1,
          is_active: true,
          status: 'open',
        });
      }
    } else {
      // Default 3 standard contests if none supplied
      await MatchContest.create({
        match_id: newMatch.id,
        type: 'standard',
        title: `Mega Contest ₹50,000 (${category})`,
        prize_pool: 50000,
        entry_fee: 49,
        total_spots: 1200,
        filled_spots: 0,
        status: 'open',
      });
      await MatchContest.create({
        match_id: newMatch.id,
        type: 'multi_battlefield',
        title: `PUBG Battlefield Room #1 (${category})`,
        prize_pool: 2500,
        entry_fee: 99,
        total_spots: 30,
        spots_per_battlefield: 30,
        battlefield_number: 1,
        status: 'open',
      });
    }

    res.json({
      success: true,
      message: 'Match verified against live DB and created successfully!',
      match_id: newMatch.id,
    });
  } catch (error) {
    console.error('Match creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /admin/cricket/matches/:id (Edit Match, Squads & Contests)
router.put('/cricket/matches/:id', async (req, res) => {
  try {
    const match = await CricketMatch.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const {
      team_a,
      team_b,
      category,
      match_date,
      match_time,
      venue,
      team_a_logo,
      team_b_logo,
      match_poster,
      lock_time_minutes,
      players,
      contests
    } = req.body;

    const title = `${team_a} vs ${team_b} — ${category} Clash`;

    await match.update({
      title,
      team_a: team_a || match.team_a,
      team_b: team_b || match.team_b,
      category: category || match.category,
      match_date: match_date || match.match_date,
      match_time: match_time || match.match_time,
      venue: venue !== undefined ? venue : match.venue,
      team_a_logo: team_a_logo !== undefined ? team_a_logo : match.team_a_logo,
      team_b_logo: team_b_logo !== undefined ? team_b_logo : match.team_b_logo,
      match_poster: match_poster !== undefined ? match_poster : match.match_poster,
      lock_time_minutes: lock_time_minutes !== undefined ? parseInt(lock_time_minutes, 10) : match.lock_time_minutes,
    });

    // Update players if supplied
    if (Array.isArray(players) && players.length > 0) {
      await CricketPlayer.destroy({ where: { match_id: match.id } });
      for (const p of players) {
        await CricketPlayer.create({
          match_id: match.id,
          team_name: p.team_name,
          name: p.name,
          role: p.role || 'BAT',
          photo_url: p.photo_url || null,
          credits: parseFloat(p.credits) || 9.0,
          points: 0,
          stats: { runs: 0, balls: 0, wickets: 0, overs: 0 },
        });
      }
    }

    // Update contests if supplied
    if (Array.isArray(contests) && contests.length > 0) {
      const teamCount = await CricketTeam.count({ where: { match_id: match.id } });
      if (teamCount === 0) {
        await MatchContest.destroy({ where: { match_id: match.id } });
        for (const c of contests) {
          const isH2H = c.type === 'h2h';
          await MatchContest.create({
            match_id: match.id,
            type: c.type || 'standard',
            title: c.title || (isH2H ? 'Head-to-Head Custom Challenge' : `${match.team_a} vs ${match.team_b} Contest`),
            prize_pool: isH2H ? 0 : (parseFloat(c.prize_pool) || 10000),
            entry_fee: isH2H ? 0 : (parseFloat(c.entry_fee) || 49),
            total_spots: isH2H ? 2 : (parseInt(c.total_spots, 10) || 250),
            filled_spots: 0,
            spots_per_battlefield: c.type === 'multi_battlefield' ? (parseInt(c.spots_per_battlefield, 10) || 25) : null,
            battlefield_number: 1,
            is_active: true,
            status: 'open',
          });
        }
      }
    }

    res.json({
      success: true,
      message: `Match "${match.title}" and its contests have been successfully updated!`,
      match_id: match.id,
    });
  } catch (error) {
    console.error('Match edit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /admin/cricket/matches/:id (Delete Match and Associated Contests Permanently Under Any Condition)
router.delete('/cricket/matches/:id', async (req, res) => {
  try {
    const result = await deleteMatchPermanently(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Match delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Alias: DELETE /admin/matches/:id
router.delete('/matches/:id', async (req, res) => {
  try {
    const result = await deleteMatchPermanently(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Match delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /admin/cricket/matches/:id/status
router.put('/cricket/matches/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const match = await CricketMatch.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    await match.update({ status });
    res.json({ success: true, message: `Match status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/cricket/matches/:id/sync-live
router.post('/cricket/matches/:id/sync-live', async (req, res) => {
  try {
    const { syncLiveMatch } = require('../services/cricbuzzService');
    const updated = await syncLiveMatch(req.params.id);
    res.json({ success: true, message: 'Live match score synced with Cricbuzz pipeline', snapshot: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── CRICBUZZ LIVE EXTRACTOR DATABASE ROUTES ───

// GET /admin/cricket/cricbuzz-feed
router.get(['/cricket/cricbuzz-feed', '/cricbuzz/feed'], async (req, res) => {
  try {
    const { getCricbuzzLiveFeed } = require('../services/cricbuzzAdapter');
    const feed = getCricbuzzLiveFeed();

    // Cross-reference with Prime Dreems DB to see which matches are already imported
    const dbMatches = await CricketMatch.findAll({ attributes: ['team_a', 'team_b'] });
    const existingPairs = new Set(dbMatches.map(m => `${m.team_a.toLowerCase()}_vs_${m.team_b.toLowerCase()}`));

    const liveMatchesWithImportStatus = feed.liveMatches.map(m => ({
      ...m,
      is_imported: existingPairs.has(`${m.team_a.toLowerCase()}_vs_${m.team_b.toLowerCase()}`)
    }));

    const upcomingMatchesWithImportStatus = feed.upcomingMatches.map(m => ({
      ...m,
      is_imported: existingPairs.has(`${m.team_a.toLowerCase()}_vs_${m.team_b.toLowerCase()}`)
    }));

    res.json({
      success: true,
      source: feed.source,
      timestamp: feed.timestamp,
      liveCount: liveMatchesWithImportStatus.length,
      upcomingCount: upcomingMatchesWithImportStatus.length,
      liveMatches: liveMatchesWithImportStatus,
      upcomingMatches: upcomingMatchesWithImportStatus,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/cricket/cricbuzz-import
router.post(['/cricket/cricbuzz-import', '/cricbuzz/import'], async (req, res) => {
  try {
    const { importCricbuzzMatchToDatabase } = require('../services/cricbuzzAdapter');
    const { cricbuzz_id } = req.body;
    if (!cricbuzz_id) {
      return res.status(400).json({ error: 'cricbuzz_id is required' });
    }
    const result = await importCricbuzzMatchToDatabase(cricbuzz_id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─── DATA HEALTH & ZERO-MISTAKE AUDIT ROUTES (Section 4) ───

// GET /admin/data-health
router.get('/data-health', async (req, res) => {
  try {
    const hotStore = require('../services/ingestion/hotStore');
    const wsGateway = require('../services/websocket/wsGateway');
    const report = hotStore.getHealthReport();
    const wsStats = wsGateway.getStats();

    // Fetch active matches from DB to complement snapshot list
    const liveMatches = await CricketMatch.findAll({
      where: { status: 'live' },
      attributes: ['id', 'title', 'team_a', 'team_b', 'category', 'cricbuzz_id', 'last_live_poll_at'],
    });

    res.json({
      success: true,
      report: {
        ...report,
        websocket_gateway: wsStats,
        database_live_matches_count: liveMatches.length,
        database_live_matches: liveMatches,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/matches/:id/override-score (Section 4.2: Manual Override Tool)
router.post('/matches/:id/override-score', async (req, res) => {
  try {
    const { match_id } = req.params;
    const { team, runs, wickets, overs, reason } = req.body;

    if (!reason || String(reason).trim().length < 5) {
      return res.status(400).json({ error: 'A valid audit reason (minimum 5 chars) is mandatory for manual score override.' });
    }

    const match = await CricketMatch.findByPk(req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const oldSummary = JSON.parse(JSON.stringify(match.score_summary || {}));
    const newSummary = { ...oldSummary };
    const targetKey = team === 'team_b' ? 'team_b' : 'team_a';

    newSummary[targetKey] = {
      runs: parseInt(runs, 10) || 0,
      wickets: Math.min(10, Math.max(0, parseInt(wickets, 10) || 0)),
      overs: parseFloat(overs) || 0.0,
    };

    await match.update({ score_summary: newSummary });

    // Update HotStore snapshot
    const hotStore = require('../services/ingestion/hotStore');
    hotStore.setSnapshot(match.id, {
      ...newSummary,
      current_innings: targetKey,
      last_ball_event: `Manual Override by ${req.user.name || 'Admin'}: ${reason}`,
    }, {
      source: 'Admin Manual Override',
      cross_check_status: 'MANUAL_VERIFIED',
    });

    // Record audit log
    await ScoreAuditLog.create({
      match_id: match.id,
      admin_id: req.user.id,
      admin_username: req.user.name || req.user.username || 'Admin',
      action: 'score_override',
      old_value: oldSummary,
      new_value: newSummary,
      reason: String(reason).trim(),
    });

    // Broadcast delta update to connected WebSocket clients
    const wsGateway = require('../services/websocket/wsGateway');
    wsGateway.broadcastDelta(match.id, {
      over: newSummary[targetKey].overs,
      runs: newSummary[targetKey].runs,
      wickets: newSummary[targetKey].wickets,
      current_innings: targetKey,
      event: 'MANUAL_OVERRIDE',
      commentary: `[Official Override] Score adjusted: ${runs}/${wickets} (${overs} ov). Reason: ${reason}`,
      score_summary: newSummary,
    });

    res.json({
      success: true,
      message: 'Score successfully updated and broadcast to all live clients with audit log.',
      score_summary: newSummary,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/matches/:id/override-points (Section 4.2: Player Points Override)
router.post('/matches/:id/override-points', async (req, res) => {
  try {
    const { player_id, new_points, reason } = req.body;
    if (!player_id || new_points === undefined || !reason || String(reason).trim().length < 5) {
      return res.status(400).json({ error: 'player_id, new_points, and audit reason (min 5 chars) are required.' });
    }

    const player = await CricketPlayer.findByPk(player_id);
    if (!player || player.match_id !== req.params.id) {
      return res.status(404).json({ error: 'Player not found in this match' });
    }

    const oldPoints = Number(player.points) || 0;
    const targetPoints = Math.round(Number(new_points) * 10) / 10;

    await player.update({ points: targetPoints });

    // Record audit log
    await ScoreAuditLog.create({
      match_id: req.params.id,
      admin_id: req.user.id,
      admin_username: req.user.name || req.user.username || 'Admin',
      action: 'points_override',
      old_value: { player_id, name: player.name, points: oldPoints },
      new_value: { player_id, name: player.name, points: targetPoints },
      reason: String(reason).trim(),
    });

    const { auditPointsChange } = require('../services/scoring/scoringEngine');
    await auditPointsChange(req.params.id, player.id, player.name, 'admin_manual_override', oldPoints, targetPoints, 'ADMIN_OVERRIDE');

    // Recalculate fantasy user teams in this match
    const { processLiveIngestionTick } = require('../services/ingestion/ingestionWorker');
    processLiveIngestionTick();

    res.json({
      success: true,
      message: `Points for ${player.name} updated from ${oldPoints} to ${targetPoints}. Audit trail recorded.`,
      player: { id: player.id, name: player.name, points: targetPoints },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/matches/:id/toggle-ingestion (Section 4.2: Ingestion Pause/Resume)
router.post('/matches/:id/toggle-ingestion', async (req, res) => {
  try {
    const { paused } = req.body;
    const hotStore = require('../services/ingestion/hotStore');

    if (paused) {
      hotStore.pauseMatch(req.params.id);
    } else {
      hotStore.resumeMatch(req.params.id);
    }

    await ScoreAuditLog.create({
      match_id: req.params.id,
      admin_id: req.user.id,
      admin_username: req.user.name || 'Admin',
      action: paused ? 'pause_ingestion' : 'resume_ingestion',
      old_value: { paused: !paused },
      new_value: { paused: Boolean(paused) },
      reason: `Ingestion stream ${paused ? 'paused' : 'resumed'} by admin`,
    });

    res.json({
      success: true,
      match_id: req.params.id,
      is_paused: hotStore.isMatchPaused(req.params.id),
      message: `Ingestion for match ${req.params.id} is now ${paused ? 'PAUSED' : 'ACTIVE'}.`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/matches/:id/audit-logs
router.get('/matches/:id/audit-logs', async (req, res) => {
  try {
    const logs = await ScoreAuditLog.findAll({
      where: { match_id: req.params.id },
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
