// 🎁 PRIME DREEMS — DREAMCOINS REWARDS API ROUTES
// Mounted at /rewards and /api/rewards by the parent agent.

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { UserReward } = require('../db/models');

// ─── Helpers ───
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getOrCreateReward(userId) {
  const [reward] = await UserReward.findOrCreate({ where: { user_id: userId } });
  return reward;
}

// ─── Static mission catalogue ───
const MISSIONS = [
  { id: 'first_team', title: 'Create your first team', description: 'Build a Prime XI', target: 1, reward: 50 },
  { id: 'join_contest', title: 'Join a contest', description: 'Enter any contest', target: 1, reward: 30 },
  { id: 'daily_login', title: 'Daily login', description: 'Claim daily reward', target: 1, reward: 20 },
  { id: 'win_h2h', title: 'Win a H2H duel', description: 'Beat an opponent', target: 1, reward: 100 },
];

const DAILY_COINS = 20;
const SPIN_PRIZES = [10, 20, 30, 50, 75, 100, 150, 200];
const SCRATCH_PRIZES = [5, 10, 15, 25, 50, 100];

/**
 * GET /rewards/state
 * Current DreamCoins balance, spin/scratch availability and mission progress.
 */
router.get('/state', authenticate, async (req, res) => {
  try {
    const reward = await getOrCreateReward(req.user.id);
    const today = getTodayStr();
    const progress = reward.missions_progress || {};

    res.json({
      success: true,
      coins: reward.coins,
      scratch_cards: reward.scratch_cards,
      spins_left: reward.spins_left,
      last_spin_date: reward.last_spin_date,
      can_claim_daily: reward.last_daily_date !== today,
      can_spin: reward.spins_left > 0 && reward.last_spin_date !== today,
      missions: MISSIONS.map(m => ({
        ...m,
        progress: progress[m.id] || 0,
        claimed: !!progress[m.id + '_claimed'],
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /rewards/claim-daily
 * Claim the once-per-day DreamCoins bonus.
 */
router.post('/claim-daily', authenticate, async (req, res) => {
  try {
    const reward = await getOrCreateReward(req.user.id);
    const today = getTodayStr();

    if (reward.last_daily_date === today) {
      return res.status(400).json({ error: 'Already claimed today' });
    }

    const dailyMission = MISSIONS.find(m => m.id === 'daily_login');
    const missionsProgress = { ...(reward.missions_progress || {}) };
    missionsProgress.daily_login = dailyMission ? dailyMission.target : 1;

    await reward.update({
      coins: reward.coins + DAILY_COINS,
      total_coins_earned: reward.total_coins_earned + DAILY_COINS,
      last_daily_date: today,
      missions_progress: missionsProgress,
    });

    res.json({
      success: true,
      coins_earned: DAILY_COINS,
      coins: reward.coins,
      message: `Daily reward claimed! You earned ${DAILY_COINS} DreamCoins.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /rewards/spin
 * Spin the wheel once per day for a random DreamCoins prize.
 */
router.post('/spin', authenticate, async (req, res) => {
  try {
    const reward = await getOrCreateReward(req.user.id);
    const today = getTodayStr();

    if (reward.last_spin_date === today || reward.spins_left <= 0) {
      return res.status(400).json({ error: 'No spins left today. Come back tomorrow!' });
    }

    const prize = SPIN_PRIZES[Math.floor(Math.random() * SPIN_PRIZES.length)];

    await reward.update({
      coins: reward.coins + prize,
      total_coins_earned: reward.total_coins_earned + prize,
      last_spin_date: today,
      spins_left: Math.max(0, reward.spins_left - 1),
    });

    res.json({
      success: true,
      prize,
      coins: reward.coins,
      message: `You won ${prize} DreamCoins!`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /rewards/scratch
 * Redeem one scratch card for a random DreamCoins prize.
 */
router.post('/scratch', authenticate, async (req, res) => {
  try {
    const reward = await getOrCreateReward(req.user.id);

    if (reward.scratch_cards <= 0) {
      return res.status(400).json({ error: 'No scratch cards left' });
    }

    const prize = SCRATCH_PRIZES[Math.floor(Math.random() * SCRATCH_PRIZES.length)];

    await reward.update({
      coins: reward.coins + prize,
      total_coins_earned: reward.total_coins_earned + prize,
      scratch_cards: reward.scratch_cards - 1,
    });

    res.json({
      success: true,
      prize,
      coins: reward.coins,
      scratch_cards: reward.scratch_cards,
      message: `You scratched and won ${prize} DreamCoins!`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /rewards/missions/:id/claim
 * Claim the reward for a completed mission (once only).
 */
router.post('/missions/:id/claim', authenticate, async (req, res) => {
  try {
    const mission = MISSIONS.find(m => m.id === req.params.id);
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const reward = await getOrCreateReward(req.user.id);
    const missionsProgress = { ...(reward.missions_progress || {}) };
    const progress = missionsProgress[mission.id] || 0;

    if (progress < mission.target) {
      return res.status(400).json({ error: 'Mission not completed yet' });
    }
    if (missionsProgress[mission.id + '_claimed']) {
      return res.status(400).json({ error: 'Already claimed' });
    }

    // Reassign a NEW object so Sequelize persists the JSON column change.
    missionsProgress[mission.id + '_claimed'] = true;

    await reward.update({
      coins: reward.coins + mission.reward,
      total_coins_earned: reward.total_coins_earned + mission.reward,
      missions_progress: missionsProgress,
    });

    res.json({
      success: true,
      coins: reward.coins,
      reward: mission.reward,
      message: `Mission complete! You earned ${mission.reward} DreamCoins.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /rewards/progress/:id
 * Internal-ish helper: increment a mission's progress (capped at target).
 * Optional body { increment } defaults to 1.
 */
router.post('/progress/:id', authenticate, async (req, res) => {
  try {
    const mission = MISSIONS.find(m => m.id === req.params.id);
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const reward = await getOrCreateReward(req.user.id);
    const missionsProgress = { ...(reward.missions_progress || {}) };

    const rawIncrement = req.body ? Number(req.body.increment) : NaN;
    const increment = Number.isFinite(rawIncrement) && rawIncrement > 0 ? rawIncrement : 1;
    const current = missionsProgress[mission.id] || 0;
    missionsProgress[mission.id] = Math.min(mission.target, current + increment);

    await reward.update({ missions_progress: missionsProgress });

    res.json({ success: true, progress: missionsProgress[mission.id] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;