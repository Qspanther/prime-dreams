// 🤖 PRIME DREEMS — AUTONOMOUS BOT SCHEDULER (ISOLATED SERVICE)
// Tuned strictly for Render Free Tier (512MB RAM) and Neon Free PostgreSQL.
// Max 5 bots joined per tick, skips tick if Neon connections > 60.

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const {
  User,
  CricketMatch,
  CricketPlayer,
  MatchContest,
  CricketTeam,
  TeamPlayer,
  ContestParticipant,
} = require('../db/models');
const { getNeonActiveConnections } = require('./db');

const maxActiveBots = parseInt(process.env.BOT_MAX_ACTIVE || '1000', 10);
const maxBatchPerTick = parseInt(process.env.BOT_BATCH_PER_TICK || '5', 10);

let cachedBots = null;
let cachedBotsTime = 0;

async function getCachedBots() {
  const now = Date.now();
  if (cachedBots && now - cachedBotsTime < 300000) {
    return cachedBots;
  }
  const bots = await User.findAll({
    where: { is_bot: true },
    attributes: ['id', 'email', 'name', 'username'],
    order: [['created_at', 'ASC']],
    limit: maxActiveBots,
    raw: true,
  });
  cachedBots = bots;
  cachedBotsTime = now;
  return cachedBots;
}

/**
 * Strict Rule: Bots NEVER enter Head-to-Head (H2H) or Private contests.
 */
function isContestEligibleForBots(contest) {
  if (!contest) return false;
  if (contest.is_private === true) return false;
  if (contest.type === 'private') return false;
  if (contest.invite_code) return false;
  if (contest.creator_id) return false;
  if (contest.type === 'h2h') return false;
  if (contest.h2h_challenge_id) return false;

  const title = String(contest.title || '').toLowerCase();
  if (/\b(h2h|head[\s-]*to[\s-]*head|head[\s-]*2[\s-]*head|duel)\b/i.test(title)) {
    return false;
  }
  return true;
}

/**
 * Valid 11-player fantasy cricket lineup
 */
function buildValidCricketLineup(players) {
  const byRole = { WK: [], BAT: [], AR: [], BOWL: [] };
  players.forEach((p) => {
    const r = (p.role || 'BAT').toUpperCase();
    if (byRole[r]) byRole[r].push(p);
  });

  const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

  const selected = [];
  const teamCounts = {};

  const canAdd = (p) => {
    const t = p.team_code || p.team_name || 'X';
    return (teamCounts[t] || 0) < 7;
  };

  const addPlayer = (p) => {
    selected.push(p);
    const t = p.team_code || p.team_name || 'X';
    teamCounts[t] = (teamCounts[t] || 0) + 1;
  };

  // Base roles: 1 WK, 3 BAT, 1 AR, 3 BOWL = 8 players
  for (const wk of shuffle(byRole.WK)) { if (canAdd(wk)) { addPlayer(wk); break; } }
  for (const bat of shuffle(byRole.BAT)) { if (selected.filter((p) => p.role === 'BAT').length < 3 && canAdd(bat)) addPlayer(bat); }
  for (const ar of shuffle(byRole.AR)) { if (selected.filter((p) => p.role === 'AR').length < 1 && canAdd(ar)) addPlayer(ar); }
  for (const bowl of shuffle(byRole.BOWL)) { if (selected.filter((p) => p.role === 'BOWL').length < 3 && canAdd(bowl)) addPlayer(bowl); }

  // Fill up to 11
  const remaining = shuffle(players.filter((p) => !selected.includes(p)));
  for (const p of remaining) {
    if (selected.length >= 11) break;
    const r = p.role;
    const rCount = selected.filter((s) => s.role === r).length;
    if (r === 'WK' && rCount >= 4) continue;
    if (r === 'BAT' && rCount >= 6) continue;
    if (r === 'AR' && rCount >= 4) continue;
    if (r === 'BOWL' && rCount >= 6) continue;
    if (canAdd(p)) addPlayer(p);
  }

  // Fallback to reach 11 if constraints blocked
  if (selected.length < 11) {
    for (const p of players) {
      if (!selected.includes(p)) selected.push(p);
      if (selected.length >= 11) break;
    }
  }

  const captain = selected[Math.floor(Math.random() * selected.length)];
  const viceCandidates = selected.filter((p) => p.id !== captain?.id);
  const viceCaptain = viceCandidates[Math.floor(Math.random() * viceCandidates.length)] || captain;

  return { players: selected.slice(0, 11), captain, viceCaptain };
}

class BotSchedulerService {
  constructor() {
    this.intervalId = null;
    this.isProcessing = false;
    this.lastTickTime = null;
    this.totalBotsJoined = 0;
  }

  start(intervalMs = 60000) {
    if (this.intervalId) return;
    console.log(`🤖 [Bot Service Scheduler] Started with ${intervalMs}ms tick interval (Max active bots: ${maxActiveBots}).`);
    this.intervalId = setInterval(() => this.tick(), intervalMs);
    // Initial tick after 5 seconds
    setTimeout(() => this.tick(), 5000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async tick() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.lastTickTime = new Date().toISOString();

    try {
      // 🛡️ Neon Connection Guard: Skip tick if database is under heavy load (> 60 active connections)
      const neonActiveConns = await getNeonActiveConnections();
      if (neonActiveConns > 60) {
        console.warn(`⚠️ [Bot Guard] Neon active connections high (${neonActiveConns}/100). Skipping bot tick.`);
        return;
      }

      const now = new Date();
      const upcomingMatches = await CricketMatch.findAll({
        where: { status: 'upcoming' },
        order: [['start_time', 'ASC']],
      });

      for (const match of upcomingMatches) {
        const startTime = new Date(match.start_time);
        const diffMs = startTime.getTime() - now.getTime();
        const hoursUntilStart = diffMs / (1000 * 60 * 60);

        const lockMinutes = match.lock_time_minutes || 15;
        // Don't join locked or far-away matches
        if (hoursUntilStart <= lockMinutes / 60 || hoursUntilStart > 72) {
          continue;
        }

        await this.deployTickForMatch(match, hoursUntilStart);
      }
    } catch (err) {
      console.error('⚠️ [Bot Scheduler Error]:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  async deployTickForMatch(match, hoursUntilStart) {
    const matchId = match.id;
    const contests = await MatchContest.findAll({
      where: { match_id: matchId, is_active: true, status: 'open' },
    });
    if (contests.length === 0) return;

    const allBots = await getCachedBots();
    if (allBots.length === 0) return;

    const matchPlayers = await CricketPlayer.findAll({ where: { match_id: matchId } });
    if (matchPlayers.length < 22) return;

    for (const contest of contests) {
      if (!isContestEligibleForBots(contest)) continue;

      const totalSpots = contest.total_spots || 100;
      const currentFilled = contest.filled_spots || 0;
      const botTarget = contest.bot_spots || (contest.type === 'mega' ? 10000 : Math.min(25, totalSpots));

      if (currentFilled >= botTarget || currentFilled >= totalSpots) continue;

      const needed = Math.min(botTarget - currentFilled, totalSpots - currentFilled);
      // Batch joins to at most 5 bots per tick to prevent CPU / DB spikes on Free Tier
      const batchCount = Math.min(needed, maxBatchPerTick);
      if (batchCount <= 0) continue;

      const botsToEnter = [...allBots].sort(() => Math.random() - 0.5).slice(0, batchCount);

      for (const bot of botsToEnter) {
        try {
          const lineup = buildValidCricketLineup(matchPlayers);
          const teamId = uuidv4();
          const teamName = `${bot.username || 'Bot'}'s XI`;

          await CricketTeam.create({
            id: teamId,
            user_id: bot.id,
            match_id: matchId,
            contest_id: contest.id,
            team_name: teamName,
            captain_id: lineup.captain?.id,
            vice_captain_id: lineup.viceCaptain?.id,
            total_points: 0,
            rank: currentFilled + 1,
            phase: 1,
          });

          const teamPlayerRows = lineup.players.map((p) => ({
            id: uuidv4(),
            team_id: teamId,
            player_id: p.id,
            multiplier: p.id === lineup.captain?.id ? 2.0 : p.id === lineup.viceCaptain?.id ? 1.5 : 1.0,
          }));

          await TeamPlayer.bulkCreate(teamPlayerRows, { ignoreDuplicates: true });

          await ContestParticipant.create({
            id: uuidv4(),
            contest_id: contest.id,
            user_id: bot.id,
            team_id: teamId,
            entry_fee: contest.entry_fee || 0,
            points: 0,
            rank: currentFilled + 1,
          });

          await contest.increment('filled_spots', { by: 1 });
          this.totalBotsJoined += 1;
        } catch (botJoinErr) {
          // Best effort join
        }
      }
    }
  }

  getStatus() {
    return {
      running: Boolean(this.intervalId),
      lastTickTime: this.lastTickTime,
      totalBotsJoined: this.totalBotsJoined,
      maxActiveBots,
      maxBatchPerTick,
    };
  }
}

module.exports = new BotSchedulerService();
