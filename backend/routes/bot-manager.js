// ★★★ PRIME DREEMS — BOT MANAGER API ROUTES ★★★
// Autonomous 10,000 Cricket Fantasy Bot Network, 72-Hour Organic Deployment & Fair-Rotation Engine

const crypto = require('crypto');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const {
  User,
  Wallet,
  CricketMatch,
  CricketPlayer,
  MatchContest,
  CricketTeam,
  TeamPlayer,
  ContestParticipant,
  BotWinHistory
} = require('../db/models');
const sequelize = require('../db/index');
const { Op } = require('sequelize');
const {
  botScheduler,
  isContestEligibleForBots,
  buildValidCricketLineup,
  getCachedBots,
  getBallsRemaining,
  checkIsEndGame,
  rearrangeBotsForEndGame
} = require('../services/botScheduler');
const { handleBattlefieldFill } = require('../services/contestService');
const { seedBots } = require('../services/seed-10000-bots');

const router = express.Router();

// ─── Timing-Safe API Key Middleware ───
function requireBotApiKey(req, res, next) {
  const apiKey = req.headers['x-bot-api-key'];
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing x-bot-api-key header'
    });
  }

  const expectedKey = String(config.BOT_API_KEY || 'c11_bot_mgr_sec_9938a7fbc21d49e');
  const expectedHash = crypto.createHash('sha256').update(expectedKey).digest();
  const providedHash = crypto.createHash('sha256').update(String(apiKey)).digest();

  if (!crypto.timingSafeEqual(expectedHash, providedHash)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid x-bot-api-key'
    });
  }
  next();
}

router.use(requireBotApiKey);

// ─── CORE FUNCTION: Deploy Pre-Contest Cricket Teams for Bots ───
/**
 * Deploys bot teams into contests:
 * - If contestId is specified: validates that it is NOT Private and NOT H2H, then fills it.
 * - If contestId is NOT specified: iterates through ALL eligible contests for the match
 *   (Mega contests, Battlefield rooms, Mini contests, Practice contests) while STRICTLY SKIPPING
 *   any Private or Head-to-Head (H2H) contests.
 */
async function deployPreContestCricketBots(matchId, contestId = null, botCount = null) {
  const match = await CricketMatch.findByPk(matchId);
  if (!match) throw new Error(`Cricket match not found: ${matchId}`);

  const matchPlayers = await CricketPlayer.findAll({ where: { match_id: matchId } });
  if (matchPlayers.length < 22) {
    throw new Error(`Match squad too small: found ${matchPlayers.length} players, expected at least 22.`);
  }

  const allBots = await getCachedBots();
  if (allBots.length === 0) throw new Error('No registered bots found in database.');

  let targetContests = [];
  if (contestId) {
    const contest = await MatchContest.findByPk(contestId);
    if (!contest) throw new Error(`Contest not found: ${contestId}`);
    if (!isContestEligibleForBots(contest)) {
      throw new Error(`Contest "${contest.title}" (${contest.id}) is Private or Head-to-Head. Bots are strictly prohibited from entering Private or H2H contests.`);
    }
    targetContests = [contest];
  } else {
    // Select ALL eligible contests for this match
    const allMatchContests = await MatchContest.findAll({
      where: { match_id: matchId, is_active: true, status: 'open' }
    });
    targetContests = allMatchContests.filter(c => isContestEligibleForBots(c));
    if (targetContests.length === 0) {
      return {
        success: true,
        message: 'No open eligible contests found for this match (Private and H2H contests are excluded).',
        registered: 0,
        contestsProcessed: 0
      };
    }
  }

  let totalDeployedAcrossContests = 0;
  const contestSummaries = [];

  for (const contest of targetContests) {
    const remainingSpots = Math.max(0, contest.total_spots - contest.filled_spots);
    if (remainingSpots <= 0) continue;

    // Determine target bot count for this contest
    let countToDeploy;
    if (botCount) {
      countToDeploy = Math.min(botCount, remainingSpots);
    } else if (contest.bot_spots && contest.bot_spots > 0) {
      const needed = Math.max(0, contest.bot_spots - contest.filled_spots);
      countToDeploy = Math.min(needed, remainingSpots);
    } else {
      let targetCapacity;
      if (contest.type === 'mega' || String(contest.title || '').toLowerCase().includes('mega')) {
        targetCapacity = Math.min(10000, contest.total_spots);
      } else if (contest.type === 'multi_battlefield' || contest.total_spots === 25 || contest.spots_per_battlefield === 25) {
        targetCapacity = Math.min(contest.total_spots, 7);
      } else if (contest.total_spots === 100) {
        targetCapacity = Math.min(contest.total_spots, 25);
      } else {
        targetCapacity = Math.min(contest.total_spots, Math.max(Math.floor(contest.total_spots * 0.28), 1));
      }
      const needed = Math.max(0, targetCapacity - contest.filled_spots);
      countToDeploy = Math.min(needed, remainingSpots);
    }

    if (countToDeploy <= 0) continue;

    // Multi-team bot allocation: Count existing teams per bot in this contest
    const existingTeams = await CricketTeam.findAll({
      where: { match_id: matchId, contest_id: contest.id },
      attributes: ['user_id', 'team_name']
    });
    const botTeamCounts = new Map();
    for (const t of existingTeams) {
      botTeamCounts.set(t.user_id, (botTeamCounts.get(t.user_id) || 0) + 1);
    }

    // Sort bots by existing team count ascending (bots with 0 teams chosen first, then 1, etc.)
    const sortedBots = [...allBots].sort((a, b) => {
      const countA = botTeamCounts.get(a.id) || 0;
      const countB = botTeamCounts.get(b.id) || 0;
      if (countA !== countB) return countA - countB;
      return Math.random() - 0.5;
    });

    const botsToRegister = sortedBots.slice(0, countToDeploy);
    if (botsToRegister.length === 0) continue;

    const newTeams = [];
    const newTeamPlayers = [];
    const newParticipants = [];

    for (let i = 0; i < botsToRegister.length; i++) {
      const bot = botsToRegister[i];
      const lineup = buildValidCricketLineup(matchPlayers);
      const curBotCount = (botTeamCounts.get(bot.id) || 0) + 1;
      botTeamCounts.set(bot.id, curBotCount);
      const suffix = curBotCount > 1 ? ` (T${curBotCount})` : '';
      const teamName = `${bot.name.split(' ')[0]}'s XI${suffix}`;

      const teamId = uuidv4();
      newTeams.push({
        id: teamId,
        user_id: bot.id,
        match_id: matchId,
        contest_id: contest.id,
        team_name: teamName,
        captain_id: lineup.captain.id,
        vice_captain_id: lineup.viceCaptain.id,
        total_points: 0,
      });

      lineup.players.forEach(p => {
        newTeamPlayers.push({
          id: uuidv4(),
          team_id: teamId,
          player_id: p.id,
          is_captain: p.id === lineup.captain.id,
          is_vice_captain: p.id === lineup.viceCaptain.id,
          points_earned: 0,
        });
      });

      newParticipants.push({
        id: uuidv4(),
        contest_id: contest.id,
        team_id: teamId,
        user_id: bot.id,
        rank: null,
        prize_won: 0,
      });
    }

    // Bulk save in chunks of 200
    const CHUNK = 200;
    for (let i = 0; i < newTeams.length; i += CHUNK) {
      await CricketTeam.bulkCreate(newTeams.slice(i, i + CHUNK));
    }
    for (let i = 0; i < newTeamPlayers.length; i += CHUNK) {
      await TeamPlayer.bulkCreate(newTeamPlayers.slice(i, i + CHUNK));
    }
    for (let i = 0; i < newParticipants.length; i += CHUNK) {
      await ContestParticipant.bulkCreate(newParticipants.slice(i, i + CHUNK));
    }

    const updatedFilled = contest.filled_spots + newTeams.length;
    await contest.update({ filled_spots: updatedFilled });

    if (contest.type === 'multi_battlefield') {
      await handleBattlefieldFill(contest);
    }

    totalDeployedAcrossContests += newTeams.length;
    contestSummaries.push({
      contestId: contest.id,
      title: contest.title,
      type: contest.type,
      deployed: newTeams.length,
      filledSpots: updatedFilled,
      totalSpots: contest.total_spots
    });
  }

  console.log(`🤖 [PrimeDreems BotManager] Deployed ${totalDeployedAcrossContests} bots across ${contestSummaries.length} eligible contests for "${match.title}"`);
  return {
    success: true,
    registered: totalDeployedAcrossContests,
    matchTitle: match.title,
    contestsProcessed: contestSummaries.length,
    contests: contestSummaries
  };
}

// ─── CORE FUNCTION: Post-Match Autonomous Rearrangement with Fair Rotation ───
async function deployAutonomousCricketRearrangement(matchId, contestId = null) {
  const match = await CricketMatch.findByPk(matchId);
  if (!match) throw new Error(`Cricket match not found: ${matchId}`);

  let contest = null;
  if (contestId) {
    contest = await MatchContest.findByPk(contestId);
  } else {
    contest = await MatchContest.findOne({
      where: { match_id: matchId, is_private: false, type: { [Op.ne]: 'h2h' } },
      order: [['total_spots', 'DESC']]
    });
  }

  const allBots = await getCachedBots();
  if (allBots.length === 0) throw new Error('No registered bots found.');

  const matchPlayers = await CricketPlayer.findAll({ where: { match_id: matchId } });
  if (matchPlayers.length < 22) throw new Error('Not enough match players.');

  // 1. Anti-Monopoly & Fair Winner Rotation
  const pastTop10 = await BotWinHistory.findAll({
    where: { rank: { [Op.lte]: 10 } },
    order: [['created_at', 'DESC']],
    limit: 50
  });
  const recentWinnerIds = new Set(pastTop10.map(h => h.bot_user_id));

  let eligibleForTop = allBots.filter(b => !recentWinnerIds.has(b.id));
  if (eligibleForTop.length < 10) eligibleForTop = [...allBots];

  eligibleForTop.sort(() => Math.random() - 0.5);
  const top10Bots = eligibleForTop.slice(0, 10);
  const top10Ids = new Set(top10Bots.map(b => b.id));

  const remainingBots = allBots.filter(b => !top10Ids.has(b.id));
  remainingBots.sort(() => Math.random() - 0.5);

  // 6 Tiers:
  // Tier 1: Rank 1-10 (10 bots) - Top Winners (Fair Rotation)
  // Tier 2: Rank 11-100 (90 bots) - High Performers
  // Tier 3: Rank 101-300 (200 bots) - Mid-High Performers
  // Tier 4: Rank 301-600 (300 bots) - Mid Performers
  // Tier 5: Rank 601-1000 (400 bots) - Lower Performers
  // Tier 6: Rank 1001-2000 (1000 bots) - Underdogs
  const tier2Bots = remainingBots.slice(0, 90);
  const tier3Bots = remainingBots.slice(90, 290);
  const tier4Bots = remainingBots.slice(290, 590);
  const tier5Bots = remainingBots.slice(590, 990);
  const tier6Bots = remainingBots.slice(990, 1990);

  // Clear existing bot teams for this match to rearrange fresh lineups
  const botIds = allBots.map(b => b.id);
  const oldTeams = await CricketTeam.findAll({
    where: { match_id: matchId, user_id: botIds },
    attributes: ['id']
  });

  if (oldTeams.length > 0) {
    const otids = oldTeams.map(t => t.id);
    await TeamPlayer.destroy({ where: { team_id: otids } });
    await ContestParticipant.destroy({ where: { team_id: otids } });
    await CricketTeam.destroy({ where: { id: otids } });
  }

  const newTeams = [];
  const newTeamPlayers = [];
  const newParticipants = [];

  function processTierBots(botsList, tierNumber) {
    botsList.forEach((bot, subIdx) => {
      let lineup;
      if (tierNumber === 1) {
        lineup = buildValidCricketLineup(matchPlayers, { rankByScore: true, invertScore: false });
      } else if (tierNumber === 2) {
        lineup = buildValidCricketLineup(matchPlayers, { rankByScore: true, invertScore: false });
        if (subIdx % 3 === 0 && lineup.players.length > 2) {
          const temp = lineup.captain;
          lineup.captain = lineup.viceCaptain;
          lineup.viceCaptain = temp;
        }
      } else if (tierNumber === 3 || tierNumber === 4) {
        lineup = buildValidCricketLineup(matchPlayers, { rankByScore: false });
      } else {
        lineup = buildValidCricketLineup(matchPlayers, { rankByScore: true, invertScore: true });
      }

      let calculatedPoints = 0;
      lineup.players.forEach(p => {
        let earned = Number(p.points) || 0;
        if (p.id === lineup.captain.id) earned *= (config.CAPTAIN_MULTIPLIER || 2.0);
        else if (p.id === lineup.viceCaptain.id) earned *= (config.VICE_CAPTAIN_MULTIPLIER || 1.5);
        calculatedPoints += earned;
      });

      const teamId = uuidv4();
      newTeams.push({
        id: teamId,
        user_id: bot.id,
        match_id: matchId,
        contest_id: contest ? contest.id : null,
        team_name: `${bot.name.split(' ')[0]}'s XI`,
        captain_id: lineup.captain.id,
        vice_captain_id: lineup.viceCaptain.id,
        total_points: Math.round(calculatedPoints * 10) / 10,
      });

      lineup.players.forEach(p => {
        let earned = Number(p.points) || 0;
        if (p.id === lineup.captain.id) earned *= (config.CAPTAIN_MULTIPLIER || 2.0);
        else if (p.id === lineup.viceCaptain.id) earned *= (config.VICE_CAPTAIN_MULTIPLIER || 1.5);

        newTeamPlayers.push({
          id: uuidv4(),
          team_id: teamId,
          player_id: p.id,
          is_captain: p.id === lineup.captain.id,
          is_vice_captain: p.id === lineup.viceCaptain.id,
          points_earned: Math.round(earned * 10) / 10,
        });
      });

      if (contest) {
        newParticipants.push({
          id: uuidv4(),
          contest_id: contest.id,
          team_id: teamId,
          user_id: bot.id,
          rank: null,
          prize_won: 0,
        });
      }
    });
  }

  processTierBots(top10Bots, 1);
  processTierBots(tier2Bots, 2);
  processTierBots(tier3Bots, 3);
  processTierBots(tier4Bots, 4);
  processTierBots(tier5Bots, 5);
  processTierBots(tier6Bots, 6);

  // Bulk save in chunks
  const CHUNK = 200;
  for (let i = 0; i < newTeams.length; i += CHUNK) {
    await CricketTeam.bulkCreate(newTeams.slice(i, i + CHUNK));
  }
  for (let i = 0; i < newTeamPlayers.length; i += CHUNK) {
    await TeamPlayer.bulkCreate(newTeamPlayers.slice(i, i + CHUNK));
  }
  if (newParticipants.length > 0) {
    for (let i = 0; i < newParticipants.length; i += CHUNK) {
      await ContestParticipant.bulkCreate(newParticipants.slice(i, i + CHUNK));
    }
  }

  // Update ranks in contest
  if (contest) {
    const allContestTeams = await CricketTeam.findAll({
      where: { contest_id: contest.id },
      order: [['total_points', 'DESC'], ['created_at', 'ASC']],
      attributes: ['id', 'user_id', 'total_points']
    });

    const t = await sequelize.transaction();
    try {
      for (let r = 0; r < allContestTeams.length; r++) {
        await allContestTeams[r].update({ rank: r + 1 }, { transaction: t });
        await ContestParticipant.update({ rank: r + 1 }, {
          where: { contest_id: contest.id, team_id: allContestTeams[r].id },
          transaction: t
        });
      }
      await contest.update({ filled_spots: allContestTeams.length }, { transaction: t });
      await t.commit();
    } catch (txErr) {
      await t.rollback();
      console.warn('Rank update warning:', txErr.message);
    }

    const winHistoryRecords = allContestTeams.slice(0, 10).map(t => ({
      id: uuidv4(),
      bot_user_id: t.user_id,
      tournament_id: matchId,
      rank: t.rank,
      points: t.total_points
    }));
    await BotWinHistory.bulkCreate(winHistoryRecords).catch(() => {});
  }

  console.log(`🏆 [PrimeDreems BotManager] Autonomous rearrangement completed for "${match.title}". Total teams: ${newTeams.length}`);
  return {
    success: true,
    totalRearranged: newTeams.length,
    matchTitle: match.title,
    winnerBot: top10Bots[0].name
  };
}

// ─── ROUTE ENDPOINTS ───

// 1. GET /bot-manager/status — Overview
router.get('/status', async (req, res) => {
  try {
    const totalBots = await User.count({ where: { is_bot: true } });
    const matches = await CricketMatch.findAll({
      attributes: ['id', 'title', 'category', 'status', 'start_time']
    });
    const contests = await MatchContest.count();
    const botTeams = await CricketTeam.count();
    const schedulerStatus = botScheduler.getStatus();

    res.json({
      success: true,
      platform: 'Prime Dreems',
      botNetwork: {
        totalBots,
        botManagerApiKeyConfigured: true,
        specialPostContestAccess: 'ENABLED',
        fairRotationEngine: 'ACTIVE',
        preContestAutoTeamCreation: 'ENABLED',
        engine72HourAlert: 'ACTIVE',
        schedulerActive: schedulerStatus.active,
        lastSchedulerTick: schedulerStatus.lastTickTime,
        activeBotTeams: botTeams,
        rules: {
          megaContests: 'ENABLED',
          multiBattlefield: 'ENABLED (Auto-Clone Supported)',
          miniContests: 'ENABLED',
          headToHeadContests: 'STRICTLY EXCLUDED (Protected)',
          privateContests: 'STRICTLY EXCLUDED (Protected)'
        }
      },
      totalMatches: matches.length,
      totalContests: contests,
      matches,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. GET /bot-manager/72h-status — Real-time 72-Hour Watcher & Contest Details
router.get('/72h-status', async (req, res) => {
  try {
    const now = new Date();
    const upcoming = await CricketMatch.findAll({
      where: { status: 'upcoming' },
      order: [['start_time', 'ASC']]
    });

    const detailedMatches = [];

    for (const match of upcoming) {
      const startTime = new Date(match.start_time);
      const hoursUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      const allContests = await MatchContest.findAll({
        where: { match_id: match.id }
      });

      const contestsInfo = allContests.map(c => {
        const eligible = isContestEligibleForBots(c);
        let exclusionReason = null;
        if (!eligible) {
          if (c.is_private || c.type === 'private' || c.invite_code) exclusionReason = 'Private Contest (Protected)';
          else if (c.type === 'h2h' || c.h2h_challenge_id || /h2h|head[\s-]*to[\s-]*head/i.test(c.title)) exclusionReason = 'Head-to-Head Duel (Protected)';
          else if (!c.is_active || c.status !== 'open') exclusionReason = 'Contest Closed / Inactive';
          else if (c.filled_spots >= c.total_spots) exclusionReason = 'Contest Full';
        }

        return {
          id: c.id,
          title: c.title,
          type: c.type,
          isPrivate: Boolean(c.is_private),
          botEligible: eligible,
          exclusionReason,
          filledSpots: c.filled_spots,
          totalSpots: c.total_spots
        };
      });

      const tracked = botScheduler.getStatus().matches.find(m => m.matchId === match.id);

      detailedMatches.push({
        id: match.id,
        title: match.title,
        startTime: match.start_time,
        hoursUntilStart: Math.max(0, Math.round(hoursUntilStart * 10) / 10),
        within72Hours: hoursUntilStart <= 72 && hoursUntilStart > 0.25,
        alert72hTriggered: tracked ? tracked.alert72hTriggered : (hoursUntilStart <= 72),
        schedulerStatus: tracked ? tracked.status : (hoursUntilStart <= 72 ? 'ACTIVE_72H_DEPLOYMENT' : 'STANDBY_WAITING_72H'),
        totalContests: contestsInfo.length,
        eligibleContests: contestsInfo.filter(c => c.botEligible).length,
        excludedContests: contestsInfo.filter(c => !c.botEligible).length,
        contests: contestsInfo
      });
    }

    res.json({
      success: true,
      currentTime: now.toISOString(),
      upcomingMatchesCount: detailedMatches.length,
      matches: detailedMatches
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. POST /bot-manager/trigger-72h-check — Force immediate 72h check and organic join tick
router.post('/trigger-72h-check', async (req, res) => {
  try {
    await botScheduler.tick();
    res.json({
      success: true,
      message: '72-Hour bot scheduler check and organic deployment tick executed successfully.',
      status: botScheduler.getStatus()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. GET /bot-manager/schedule — Real-time cricket match schedule
router.get('/schedule', async (req, res) => {
  try {
    const now = new Date();
    const upcoming = await CricketMatch.findAll({
      where: { status: 'upcoming' },
      order: [['start_time', 'ASC']],
      limit: 10
    });

    const live = await CricketMatch.findAll({
      where: { status: 'live' },
      order: [['start_time', 'ASC']]
    });

    const completed = await CricketMatch.findAll({
      where: { status: 'completed' },
      order: [['start_time', 'DESC']],
      limit: 10
    });

    res.json({
      success: true,
      currentTime: now.toISOString(),
      liveMatches: live.map(m => ({
        id: m.id,
        title: m.title,
        startTime: m.start_time
      })),
      upcomingMatches: upcoming.map(m => ({
        id: m.id,
        title: m.title,
        startTime: m.start_time,
        minutesUntilStart: Math.max(0, Math.round((new Date(m.start_time) - now) / 60000)),
        hoursUntilStart: Math.max(0, Math.round((new Date(m.start_time) - now) / 360000) / 10),
        within72hWindow: (new Date(m.start_time) - now) <= (72 * 60 * 60 * 1000)
      })),
      completedMatches: completed.map(m => ({
        id: m.id,
        title: m.title,
        startTime: m.start_time
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. GET /bot-manager/bots — List registered bots with wallet balances
router.get('/bots', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 10000);
    const offset = parseInt(req.query.offset) || 0;

    const bots = await User.findAll({
      where: { is_bot: true },
      attributes: ['id', 'name', 'username', 'email', 'created_at'],
      include: [{
        model: Wallet,
        as: 'wallet',
        attributes: ['balance', 'deposit_balance']
      }],
      order: [['created_at', 'ASC']],
      limit,
      offset
    });

    const total = await User.count({ where: { is_bot: true } });

    res.json({
      success: true,
      total,
      limit,
      offset,
      bots: bots.map(b => ({
        id: b.id,
        name: b.name,
        username: b.username,
        email: b.email,
        walletBalance: b.wallet ? parseFloat(b.wallet.balance) : 0,
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. POST /bot-manager/seed-bots — Seed bots up to 10,000
router.post('/seed-bots', async (req, res) => {
  try {
    const target = parseInt(req.body.targetCount) || 10000;
    const finalCount = await seedBots(target);
    res.json({
      success: true,
      message: `Bot network seeded successfully. Total bots: ${finalCount}`,
      totalBots: finalCount
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. GET /bot-manager/winners-history — Past winners rotation
router.get('/winners-history', async (req, res) => {
  try {
    const history = await BotWinHistory.findAll({
      order: [['created_at', 'DESC']],
      limit: 50
    });
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. POST /bot-manager/deploy-pre-contest — Pre-contest team building across eligible contests
router.post('/deploy-pre-contest', async (req, res) => {
  try {
    const { matchId, contestId, botCount } = req.body;
    if (!matchId) return res.status(400).json({ success: false, error: 'matchId is required' });

    const result = await deployPreContestCricketBots(matchId, contestId, botCount);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. POST /bot-manager/deploy-staggered — Organic Staggered Join Tick
router.post('/deploy-staggered', async (req, res) => {
  try {
    const { matchId } = req.body;
    if (!matchId) return res.status(400).json({ success: false, error: 'matchId is required' });

    const match = await CricketMatch.findByPk(matchId);
    if (!match) return res.status(404).json({ success: false, error: 'Match not found' });

    const now = new Date();
    const hoursUntilStart = (new Date(match.start_time).getTime() - now.getTime()) / (1000 * 60 * 60);

    await botScheduler.deployOrganicStaggeredTick(match, hoursUntilStart);
    res.json({
      success: true,
      message: `Organic staggered deployment tick executed for match "${match.title}".`,
      hoursUntilStart: Math.round(hoursUntilStart * 10) / 10
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. POST /bot-manager/deploy-autonomous — Post-match rearrangement & tier scoring
router.post('/deploy-autonomous', async (req, res) => {
  try {
    const { matchId, contestId } = req.body;
    if (!matchId) return res.status(400).json({ success: false, error: 'matchId is required' });

    const result = await deployAutonomousCricketRearrangement(matchId, contestId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. POST /bot-manager/batch-join — Batch join bots into contest
router.post('/batch-join', async (req, res) => {
  try {
    const { matchId, contestId, botCount } = req.body;
    if (!matchId) return res.status(400).json({ success: false, error: 'matchId is required' });

    const count = parseInt(botCount) || 10;
    const result = await deployPreContestCricketBots(matchId, contestId, count);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 12. POST /bot-manager/rearrange-endgame — Death stage (last 6-10 balls) tactical bot rearrangement
router.post('/rearrange-endgame', async (req, res) => {
  try {
    const { matchId } = req.body;
    if (!matchId) return res.status(400).json({ success: false, error: 'matchId is required' });

    const result = await rearrangeBotsForEndGame(matchId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 13. GET /bot-manager/endgame-status/:matchId — Death stage status & balls remaining
router.get('/endgame-status/:matchId', async (req, res) => {
  try {
    const match = await CricketMatch.findByPk(req.params.matchId);
    if (!match) return res.status(404).json({ success: false, error: 'Match not found' });

    const status = checkIsEndGame(match);
    res.json({
      success: true,
      matchId: match.id,
      matchTitle: match.title,
      matchStatus: match.status,
      ...status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 14. GET /bot-manager/phases/:matchId — Manager Bot phase distribution & rotation report
router.get('/phases/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const match = await CricketMatch.findByPk(matchId);
    if (!match) return res.status(404).json({ success: false, error: 'Match not found' });

    const botUsers = await User.findAll({ where: { is_bot: true }, attributes: ['id'] });
    const botIdSet = new Set(botUsers.map(b => b.id));

    const teams = await CricketTeam.findAll({
      where: { match_id: matchId },
      attributes: ['id', 'user_id', 'team_name', 'contest_id', 'rank', 'total_points', 'phase'],
      order: [['rank', 'ASC']]
    });

    const botTeams = teams.filter(t => botIdSet.has(t.user_id));
    const humanTeams = teams.filter(t => !botIdSet.has(t.user_id));

    const phaseGroups = {};
    for (const bt of botTeams) {
      const p = bt.phase || 1;
      if (!phaseGroups[p]) {
        phaseGroups[p] = { phase: p, count: 0, sampleTeams: [] };
      }
      phaseGroups[p].count++;
      if (phaseGroups[p].sampleTeams.length < 5) {
        phaseGroups[p].sampleTeams.push({
          teamName: bt.team_name,
          rank: bt.rank,
          points: bt.total_points
        });
      }
    }

    res.json({
      success: true,
      matchId,
      matchTitle: match.title,
      totalBots: botTeams.length,
      totalHumans: humanTeams.length,
      botRankRange: botTeams.length > 0 ? `1 - ${botTeams.length}` : 'None',
      humanRankRange: humanTeams.length > 0 ? `${botTeams.length + 1} - ${botTeams.length + humanTeams.length}` : 'None',
      phases: Object.values(phaseGroups)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = {
  router,
  deployPreContestCricketBots,
  deployAutonomousCricketRearrangement,
  rearrangeBotsForEndGame,
  checkIsEndGame,
  getBallsRemaining,
  buildValidCricketLineup,
  isContestEligibleForBots
};
