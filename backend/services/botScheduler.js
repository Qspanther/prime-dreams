// ★★★ PRIME DREEMS — AUTONOMOUS 10,000 BOT NETWORK & 72-HOUR ORGANIC ENGINE ★★★
// Monitors Upcoming Matches, Dispatches 72-Hour Alerts, and Orchestrates Organic Gradual Team Creation

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const sequelize = require('../db/index');
const {
  User,
  Wallet,
  CricketMatch,
  CricketPlayer,
  MatchContest,
  CricketTeam,
  TeamPlayer,
  ContestParticipant,
  BotWinHistory,
  BotTeam
} = require('../db/models');
const { handleBattlefieldFill } = require('./contestService');
const config = require('../config');

// In-memory cache for bot users (up to 10,000 bots)
let cachedBots = null;
let cachedBotsTime = 0;

function clearCachedBots() {
  cachedBots = null;
  cachedBotsTime = 0;
}

async function getCachedBots(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedBots && Array.isArray(cachedBots) && cachedBots.length > 0 && (now - cachedBotsTime < 300000)) {
    return cachedBots;
  }
  let bots = await User.findAll({
    where: { is_bot: true },
    attributes: ['id', 'email', 'name', 'username'],
    order: [['created_at', 'ASC']],
    limit: 10000,
    raw: true
  });

  // Auto-seed bots if DB is completely empty
  if (!bots || bots.length === 0) {
    try {
      const { seedBots } = require('./seed-10000-bots');
      console.log('🤖 [BotScheduler] No bots found in DB. Auto-seeding 10,000 bots...');
      await seedBots(10000);
      bots = await User.findAll({
        where: { is_bot: true },
        attributes: ['id', 'email', 'name', 'username'],
        order: [['created_at', 'ASC']],
        limit: 10000,
        raw: true
      });
    } catch (e) {
      console.warn('⚠️ Auto-seed bots notice in getCachedBots:', e.message);
    }
  }

  cachedBots = (bots && bots.length > 0) ? bots : null;
  cachedBotsTime = now;
  return cachedBots || [];
}

/**
 * Strict validation to ensure bots NEVER enter Head-to-Head (H2H) or Private contests.
 * Allowed: Standard (Mega / Mini), Multi-Battlefield, Practice public contests.
 */
function isContestEligibleForBots(contest) {
  if (!contest) return false;

  // 1. Strict Isolation: Private Contests
  if (contest.is_private === true) return false;
  if (contest.type === 'private') return false;
  if (contest.invite_code) return false;
  if (contest.creator_id) return false;

  // 2. Strict Isolation: Head-to-Head (H2H) Duels & Challenges
  if (contest.type === 'h2h') return false;
  if (contest.h2h_challenge_id) return false;
  const title = String(contest.title || '').toLowerCase();
  if (/\b(h2h|head[\s-]*to[\s-]*head|head[\s-]*2[\s-]*head|duel)\b/i.test(title)) {
    return false;
  }

  // 3. Status and availability checks
  if (contest.is_active === false) return false;
  if (contest.status && contest.status !== 'open') return false;
  if (contest.filled_spots >= contest.total_spots) return false;

  return true;
}

/**
 * Detect maximum position/rank that receives a prize in this contest.
 * Inspects contest.prize_breakup (from Payout Portal / Admin),
 * or falls back to system rules for the contest type.
 * Ensures bots capture 100% of all prize-winning ranks!
 */
function getMaxPrizeRank(contest) {
  if (!contest) return 0;
  let maxRank = 0;
  try {
    let breakup = contest.prize_breakup;
    if (typeof breakup === 'string') {
      breakup = JSON.parse(breakup);
    }
    if (Array.isArray(breakup)) {
      for (const item of breakup) {
        const prize = parseFloat(item.prize || item.amount || 0);
        if (prize > 0) {
          const to = parseInt(item.rank_to || item.rank || item.rank_from || 0, 10);
          if (to > maxRank) maxRank = to;
        }
      }
    }
  } catch (_) {}

  // System fallback defaults if no explicit breakup was set
  if (maxRank === 0) {
    if (contest.type === 'multi_battlefield' || contest.total_spots === 25) {
      maxRank = 5; // Top 5 win prizes in 25-spot room
    } else if (contest.type === 'mini') {
      maxRank = 10;
    } else if (contest.type === 'mega') {
      maxRank = Math.min(1000, Math.max(100, Math.floor((contest.total_spots || 10000) * 0.10)));
    }
  }
  return maxRank;
}

/**
 * Intelligent Cricket Lineup Builder
 * Adheres to Dream11 / Prime Dreems rules:
 * - Exactly 11 players
 * - Max 7 per team
 * - WK: 1-4, BAT: 3-6, AR: 1-4, BOWL: 3-6
 * - Total credits <= 105
 * - Distinct Captain (2x) and Vice-Captain (1.5x)
 */
function buildValidCricketLineup(players, options = {}) {
  const byRole = { WK: [], BAT: [], AR: [], BOWL: [] };
  players.forEach(p => {
    if (byRole[p.role]) byRole[p.role].push(p);
  });

  const sortByPoints = Boolean(options.rankByScore);
  const invertScore = Boolean(options.invertScore);

  for (const r of ['WK', 'BAT', 'AR', 'BOWL']) {
    if (sortByPoints) {
      byRole[r].sort((a, b) => invertScore ? (a.points - b.points) : (b.points - a.points));
    } else {
      byRole[r].sort(() => Math.random() - 0.5);
    }
  }

  const distributions = [
    { WK: 1, BAT: 4, AR: 2, BOWL: 4 },
    { WK: 1, BAT: 3, AR: 3, BOWL: 4 },
    { WK: 2, BAT: 3, AR: 2, BOWL: 4 },
    { WK: 1, BAT: 4, AR: 3, BOWL: 3 },
    { WK: 2, BAT: 4, AR: 2, BOWL: 3 },
  ];

  const dist = distributions[Math.floor(Math.random() * distributions.length)];
  let selected = [];
  const teamCounts = {};

  function canAdd(player) {
    const current = teamCounts[player.team_name] || 0;
    return current < (config.MAX_PLAYERS_PER_TEAM || 7);
  }

  function addPlayer(player) {
    selected.push(player);
    teamCounts[player.team_name] = (teamCounts[player.team_name] || 0) + 1;
  }

  for (const role of ['WK', 'BAT', 'AR', 'BOWL']) {
    const needed = dist[role];
    const available = byRole[role];
    let added = 0;

    for (const p of available) {
      if (added >= needed) break;
      if (canAdd(p)) {
        addPlayer(p);
        added++;
      }
    }

    if (added < needed) {
      for (const p of available) {
        if (added >= needed) break;
        if (!selected.some(s => s.id === p.id)) {
          addPlayer(p);
          added++;
        }
      }
    }
  }

  if (selected.length < 11) {
    const unpicked = players.filter(p => !selected.some(s => s.id === p.id));
    for (const p of unpicked) {
      if (selected.length >= 11) break;
      addPlayer(p);
    }
  } else if (selected.length > 11) {
    selected = selected.slice(0, 11);
  }

  let totalCredits = selected.reduce((sum, p) => sum + (Number(p.credits) || 9.0), 0);
  const maxCredits = config.TOTAL_CREDITS || 105;
  if (totalCredits > maxCredits) {
    selected.sort((a, b) => (Number(b.credits) || 9) - (Number(a.credits) || 9));
    for (let i = 0; i < selected.length; i++) {
      const cur = selected[i];
      const cheaperInRole = byRole[cur.role].filter(p => 
        !selected.some(s => s.id === p.id) &&
        (Number(p.credits) || 9) < (Number(cur.credits) || 9) &&
        canAdd(p)
      );
      if (cheaperInRole.length > 0) {
        selected[i] = cheaperInRole[0];
        totalCredits = selected.reduce((sum, p) => sum + (Number(p.credits) || 9.0), 0);
        if (totalCredits <= maxCredits) break;
      }
    }
  }

  let captain, viceCaptain;
  if (sortByPoints) {
    const sortedByRank = [...selected].sort((a, b) => invertScore ? (a.points - b.points) : (b.points - a.points));
    captain = sortedByRank[0];
    viceCaptain = sortedByRank[1] || sortedByRank[0];
  } else {
    const shuffled = [...selected].sort(() => Math.random() - 0.5);
    captain = shuffled[0];
    viceCaptain = shuffled[1];
  }

  return { players: selected, captain, viceCaptain, totalCredits };
}

// Global In-Memory Match Tracking Registry
const trackedMatches = new Map();

/**
 * Determine the estimated number of balls remaining in a live cricket match.
 * Inspects score_summary, current innings overs, and live_data.
 */
function getBallsRemaining(match) {
  if (!match) return null;
  const score = match.score_summary || {};
  const live = match.live_data || {};

  // 1. Explicit balls remaining field
  if (typeof score.balls_remaining === 'number') return score.balls_remaining;
  if (typeof live.balls_remaining === 'number') return live.balls_remaining;

  // 2. Parse from overs bowled in current/second innings
  const currentInnings = score.current_innings || 'team_b';
  const innData = score[currentInnings] || score.team_b || score.team_a;
  if (!innData) return null;

  const oversVal = innData.overs;
  if (oversVal === undefined || oversVal === null) return null;

  const oversStr = String(oversVal);
  const parts = oversStr.split('.');
  const completedOvers = parseInt(parts[0], 10) || 0;
  const ballsInOver = parseInt(parts[1], 10) || 0;
  const ballsBowled = (completedOvers * 6) + ballsInOver;

  let maxOvers = 20; // Default T20 / League format (120 balls total)
  if (score.max_overs && Number(score.max_overs) > 0) {
    maxOvers = Number(score.max_overs);
  } else if (match.category === 'World Cup' && completedOvers > 20) {
    maxOvers = 50;
  }

  const totalBalls = maxOvers * 6;
  const remaining = Math.max(0, totalBalls - ballsBowled);

  // If 9 wickets are down in limited overs, match is in death stage (1 wicket left)
  if (innData.wickets >= 9 && remaining <= 30) {
    return Math.min(remaining, 8);
  }

  return remaining;
}

/**
 * Determine the estimated number of runs remaining to win for the batting team.
 * Inspects commentary text, status text, and score summary targets.
 */
function getRunsRemaining(match) {
  if (!match) return null;
  const score = match.score_summary || {};
  const live = match.live_data || {};

  // 1. Explicit field if set
  if (typeof score.runs_needed === 'number') return score.runs_needed;
  if (typeof live.runs_needed === 'number') return live.runs_needed;

  // 2. Parse from commentary or status text (e.g., "need 9 runs in 12 balls")
  const text = `${live.status_text || ''} ${score.last_ball_event || ''} ${(live.commentary && live.commentary[0]) || ''}`;
  const m = text.match(/(?:need|require|requires)\s+(\d+)\s+runs?/i);
  if (m) {
    return parseInt(m[1], 10);
  }

  // 3. Compute from target if second innings
  const currInn = score.current_innings;
  if (currInn === 'team_b' && score.team_a?.runs > 0 && score.team_b?.runs !== undefined) {
    const target = score.team_a.runs + 1;
    return Math.max(0, target - score.team_b.runs);
  }
  if (currInn === 'team_a' && score.team_b?.runs > 0 && score.team_a?.runs !== undefined) {
    const target = score.team_b.runs + 1;
    return Math.max(0, target - score.team_a.runs);
  }

  return null;
}

/**
 * Checks if a live match is in its death stage:
 * Condition A: Final 6 to 10 balls remaining (balls <= 10).
 * Condition B: Batting team needs only 6 to 10 runs to win (runsNeeded <= 10).
 */
function checkIsEndGame(match) {
  if (!match || match.status !== 'live') {
    return { isEndGame: false, remainingBalls: null, remainingRuns: null, reason: 'Match is not live' };
  }

  // Explicit endgame flag
  if (match.live_data?.endgame === true || match.score_summary?.endgame === true) {
    return { isEndGame: true, remainingBalls: 6, remainingRuns: 6, reason: 'Explicit endgame flag active' };
  }

  const remainingBalls = getBallsRemaining(match);
  const remainingRuns = getRunsRemaining(match);

  // Condition 1: 0 to 10 balls remaining (specifically 6 to 10 balls window)
  const isBallsDeathStage = remainingBalls !== null && remainingBalls <= 10 && remainingBalls >= 0;

  // Condition 2: 0 to 10 runs remaining to win (specifically 6 to 10 runs window)
  const isRunsDeathStage = remainingRuns !== null && remainingRuns <= 10 && remainingRuns > 0;

  if (isBallsDeathStage || isRunsDeathStage) {
    return {
      isEndGame: true,
      remainingBalls,
      remainingRuns,
      reason: isBallsDeathStage && isRunsDeathStage
        ? `Death stage: ${remainingBalls} balls left and ${remainingRuns} runs needed to win`
        : isBallsDeathStage
        ? `Death stage: ${remainingBalls} balls remaining`
        : `Death stage: only ${remainingRuns} runs needed to win`
    };
  }

  return {
    isEndGame: false,
    remainingBalls,
    remainingRuns,
    reason: `${remainingBalls !== null ? `${remainingBalls} balls` : 'In-play'}, ${remainingRuns !== null ? `${remainingRuns} runs needed` : 'steady pace'}`
  };
}

/**
 * Dynamic End-Game Tactical Rearrangement Engine (Last 6-10 Balls Stage)
 * Orchestrated by Manager Bot with Dynamic Phases, Round-Off Jitter, and Top Rank Reservation.
 */
async function rearrangeBotsForEndGame(matchId) {
  const { managerBot } = require('./botManagerBot');
  return await managerBot.executeManagerBotRearrangement(matchId);
}

/**
 * Main 72-Hour Scheduler & Organic Staggered Deployment Engine
 */
class BotScheduler {
  constructor() {
    this.intervalId = null;
    this.isProcessing = false;
    this.lastTickTime = null;
    this.postContestProcessed = new Set();
    this.endGameProcessed = new Set();
  }

  /**
   * Return status of all tracked matches and bot network
   */
  getStatus() {
    const list = [];
    for (const [id, data] of trackedMatches.entries()) {
      list.push(data);
    }
    return {
      active: Boolean(this.intervalId),
      lastTickTime: this.lastTickTime,
      trackedMatchesCount: list.length,
      matches: list
    };
  }

  /**
   * Core periodic tick:
   * 1. Detects new upcoming matches.
   * 2. Checks if start_time is <= 72 hours away.
   * 3. Fires 72-hour alert when match enters 72h window.
   * 4. Deploys bots organically and randomly over the 72h window across all eligible contests.
   * 5. Strictly isolates and skips Private & H2H contests.
   */
  async tick() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.lastTickTime = new Date().toISOString();

    try {
      const now = new Date();
      const upcomingMatches = await CricketMatch.findAll({
        where: { status: 'upcoming' },
        order: [['start_time', 'ASC']]
      });

      for (const match of upcomingMatches) {
        const startTime = new Date(match.start_time);
        const diffMs = startTime.getTime() - now.getTime();
        const hoursUntilStart = diffMs / (1000 * 60 * 60);

        let matchRecord = trackedMatches.get(match.id);
        if (!matchRecord) {
          // Newly discovered match
          matchRecord = {
            matchId: match.id,
            title: match.title,
            startTime: match.start_time,
            discoveredAt: now.toISOString(),
            alert72hTriggered: false,
            alert72hTriggeredAt: null,
            status: 'STANDBY_WAITING_72H',
            contestsProgress: {},
            lastDeploymentAt: null,
          };
          trackedMatches.set(match.id, matchRecord);
          console.log(`📢 [Bot Watcher] Naya upcoming match detect hua: "${match.title}" (ID: ${match.id})`);
          console.log(`   ⏳ Match Start: ${startTime.toLocaleString()} | Bache hain: ${hoursUntilStart.toFixed(1)} ghante.`);
        }

        // Lock check: if <= 15 minutes before start or past start
        const lockMinutes = match.lock_time_minutes || 15;
        if (hoursUntilStart <= (lockMinutes / 60)) {
          if (matchRecord.status !== 'LOCKED_OR_LIVE') {
            matchRecord.status = 'LOCKED_OR_LIVE';
            console.log(`🔒 [Bot Watcher] Match "${match.title}" locks within ${lockMinutes} mins. Bot joins ceased.`);
          }
          continue;
        }

        // ⏱️ 1-HOUR RULE: All bot teams must complete entry by 1 hour before start
        if (hoursUntilStart <= 1.0) {
          if (matchRecord.status !== '1H_COMPLETED_STANDBY') {
            matchRecord.status = '1H_COMPLETED_STANDBY';
            console.log(`⏱️ [1-Hour Rule] Match "${match.title}" starts in <= 1 hour (${(hoursUntilStart * 60).toFixed(0)}m). Bot target 100% completed & locked.`);
          }
          continue;
        }

        // Case A: More than 48 hours away -> Wait on standby
        if (hoursUntilStart > 48) {
          matchRecord.status = 'STANDBY_WAITING_WINDOW';
          continue;
        }

        // Case B: Active Window (> 1.0 hour and <= 48 hours) -> Organic Paced Deployment
        if (hoursUntilStart <= 48 && hoursUntilStart > 1.0) {
          if (!matchRecord.alert72hTriggered) {
            matchRecord.alert72hTriggered = true;
            matchRecord.alert72hTriggeredAt = now.toISOString();
            matchRecord.status = 'ACTIVE_1H_RULE_DEPLOYMENT';
            console.log('\n================================================================');
            console.log(`🚨 [1-HOUR RULE BOT NETWORK ACTIVE]`);
            console.log(`🏏 Match: "${match.title}" (ID: ${match.id})`);
            console.log(`⏰ Time Left: ${hoursUntilStart.toFixed(1)} hours (completes at 1.0h mark)!`);
            console.log(`🤖 10,000 Bots Network: Natural Micro-Batches with Jitter`);
            console.log(`🛡️  Strict Rules: Isolated Bot Tables | H2H & Private 100% Excluded`);
            console.log('================================================================\n');
          } else {
            matchRecord.status = 'ACTIVE_1H_RULE_DEPLOYMENT';
          }

          // Execute organic 1-by-1 micro-batch staggered join tick
          await this.deployOrganicStaggeredTick(match, hoursUntilStart);
        }
      }

      // Check live matches for End-Game (last 6-10 balls) Tactical Rearrangement
      const liveMatches = await CricketMatch.findAll({
        where: { status: 'live' }
      });

      for (const lm of liveMatches) {
        const { isEndGame, remainingBalls, reason } = checkIsEndGame(lm);
        if (isEndGame && !this.endGameProcessed.has(lm.id)) {
          console.log('\n================================================================');
          console.log(`🚨 [END-GAME DEATH STAGE DETECTED]`);
          console.log(`🏏 Match: "${lm.title}" (ID: ${lm.id})`);
          console.log(`🎯 Balls Remaining: ${remainingBalls} balls left (${reason})!`);
          console.log(`🤖 Rearranging all bot squads across eligible contests: replacing underperformers with top match players...`);
          console.log(`🏆 Guaranteed: Top ranks strictly reserved for bots (Ranks 1 to B)! Human users placed behind bots.`);
          console.log('================================================================\n');

          try {
            await rearrangeBotsForEndGame(lm.id);
            this.endGameProcessed.add(lm.id);
          } catch (rearrangeErr) {
            console.error(`⚠️ [End-Game Rearrangement Error for ${lm.title}]:`, rearrangeErr.message);
          }
        }
      }

      // Check completed matches for post-contest rearrangement
      const completedMatches = await CricketMatch.findAll({
        where: { status: 'completed' },
        limit: 5,
        order: [['start_time', 'DESC']]
      });

      for (const cm of completedMatches) {
        if (!this.postContestProcessed.has(cm.id)) {
          const hasHistory = await BotWinHistory.count({ where: { tournament_id: cm.id } });
          if (hasHistory > 0) {
            this.postContestProcessed.add(cm.id);
            continue;
          }
          console.log(`🏁 [Bot Scheduler] Match "${cm.title}" completed. Applying Fair Winner Rotation & Tactical Rearrangement.`);
          const botManagerRoutes = require('../routes/bot-manager');
          if (botManagerRoutes.deployAutonomousCricketRearrangement) {
            try {
              await botManagerRoutes.deployAutonomousCricketRearrangement(cm.id);
              this.postContestProcessed.add(cm.id);
            } catch (postErr) {
              console.warn(`⚠️ [PostContest Notice] ${postErr.message}`);
            }
          }
        }
      }
    } catch (err) {
      console.error('⚠️ [BotScheduler Error]:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Organic Staggered Deployment:
   * Slowly trickles randomized bot squads into eligible contests across the 72-hour period.
   * Bots join at realistic random intervals so it looks like authentic human users.
   */
  async deployOrganicStaggeredTick(match, hoursUntilStart) {
    const matchId = match.id;
    const matchRecord = trackedMatches.get(matchId);

    // Fetch all active open contests for this match
    const contests = await MatchContest.findAll({
      where: { match_id: matchId, is_active: true, status: 'open' }
    });

    if (contests.length === 0) return;

    // ⏱️ 1-HOUR RULE: Stop bot entries if <= 1.0 hour remains before match start!
    if (hoursUntilStart <= 1.0) {
      return;
    }

    const allBots = await getCachedBots();
    if (allBots.length === 0) return;

    const matchPlayers = await CricketPlayer.findAll({ where: { match_id: matchId } });
    if (matchPlayers.length < 22) return;

    // Calculate progression: Target must reach 100% at hoursUntilStart === 1.0
    // Active window from 48h down to 1.0h before start
    const totalDeploymentWindow = 47; // 48h to 1h
    const hoursRemainingUntilTarget = Math.max(0, hoursUntilStart - 1.0);
    const elapsed = Math.max(0, totalDeploymentWindow - hoursRemainingUntilTarget);
    const progressRatio = Math.min(1.0, elapsed / totalDeploymentWindow);
    // Smooth natural curve reaching 1.0 (100% of target) at exactly 1 hour before start
    const targetFillFactor = Math.min(1.0, Math.pow(progressRatio, 0.85));

    for (const contest of contests) {
      // 1. STRICT ISOLATION FILTER: Head-to-Head & Private contests are 100% EXCLUDED
      if (!isContestEligibleForBots(contest)) {
        continue;
      }

      const totalSpots = contest.total_spots;
      const currentFilled = contest.filled_spots;
      const maxPrizeRank = getMaxPrizeRank(contest);

      // 1. Calculate Target Bot Spots:
      // Priority A: Explicit bot_spots set by Admin (> 0)
      let contestBotTarget = 0;
      if (contest.bot_spots && contest.bot_spots > 0) {
        contestBotTarget = Math.min(contest.bot_spots, totalSpots);
      } else {
        // Priority B: System Rules
        // Mega contest -> up to 10,000 teams
        if (contest.type === 'mega' || String(contest.title || '').toLowerCase().includes('mega')) {
          contestBotTarget = Math.min(10000, totalSpots);
        }
        // 25 spots / Multi-Battlefield -> minimum 7 bots guaranteed (never empty)
        else if (contest.type === 'multi_battlefield' || totalSpots === 25 || contest.spots_per_battlefield === 25) {
          const roomSpots = contest.spots_per_battlefield || totalSpots || 25;
          contestBotTarget = Math.min(roomSpots, Math.max(7, Math.floor(roomSpots * 0.28)));
        }
        // 100 spots -> minimum 25 bots guaranteed
        else if (totalSpots === 100) {
          contestBotTarget = Math.min(totalSpots, 25);
        }
        // Default public contest -> at least 25% - 28% bots
        else {
          contestBotTarget = Math.min(totalSpots, Math.max(Math.floor(totalSpots * 0.28), 1));
        }
      }

      // CRITICAL GUARANTEE: Target must ALWAYS be at least maxPrizeRank so bots capture 100% of prize positions!
      if (maxPrizeRank > 0) {
        contestBotTarget = Math.min(totalSpots, Math.max(contestBotTarget, maxPrizeRank));
      }

      // Minimum guaranteed floor:
      let minGuaranteed = Math.min(totalSpots, Math.max(maxPrizeRank, 7));
      if (contest.type === 'mini' || totalSpots === 100) {
        minGuaranteed = Math.min(totalSpots, Math.max(minGuaranteed, 25));
      } else if (contestBotTarget > 0) {
        minGuaranteed = Math.min(contestBotTarget, Math.max(minGuaranteed, Math.floor(contestBotTarget * 0.25)));
      }

      // Immediate top-up if below minimum guaranteed floor:
      let targetForThisMoment;
      if (currentFilled < minGuaranteed) {
        targetForThisMoment = minGuaranteed;
      } else {
        targetForThisMoment = Math.max(minGuaranteed, Math.floor(contestBotTarget * targetFillFactor));
      }

      if (currentFilled >= targetForThisMoment || currentFilled >= totalSpots) {
        continue;
      }

      // Natural jitter pause only if we already met the minimum guaranteed floor
      if (currentFilled >= minGuaranteed && Math.random() > 0.75) {
        continue;
      }

      const needed = Math.min(targetForThisMoment - currentFilled, totalSpots - currentFilled);
      if (needed <= 0) continue;

      // 🛡️ ISOLATED BOT MANAGEMENT: Query existing teams from dedicated bot_teams table
      const existingBotTeams = await BotTeam.findAll({
        where: { match_id: matchId, contest_id: contest.id },
        attributes: ['bot_id'],
        raw: true
      });

      const botTeamCounts = new Map();
      for (const t of existingBotTeams) {
        botTeamCounts.set(t.bot_id, (botTeamCounts.get(t.bot_id) || 0) + 1);
      }

      // Sort bots by existing team count ascending (0 teams first, then 1, etc.)
      const sortedBots = [...allBots].sort((a, b) => {
        const countA = botTeamCounts.get(a.id) || 0;
        const countB = botTeamCounts.get(b.id) || 0;
        if (countA !== countB) return countA - countB;
        return Math.random() - 0.5;
      });

      const bot = sortedBots[0];
      if (!bot) continue;

      const lineup = buildValidCricketLineup(matchPlayers);
      const teamId = uuidv4();
      const curBotCount = (botTeamCounts.get(bot.id) || 0) + 1;
      const suffix = curBotCount > 1 ? ` (T${curBotCount})` : '';
      const teamName = `${(bot.name || 'Player').split(' ')[0]}'s XI${suffix}`;

      // 🛡️ ISOLATED BOT ENTRY: Writes to dedicated bot_teams table with compact JSON lineup
      // Eliminates 11 rows in team_players & contest_participants -> 91% fewer DB writes on Neon Free Tier!
      await BotTeam.create({
        id: teamId,
        bot_id: bot.id,
        bot_name: bot.name,
        bot_username: bot.username || bot.name.split(' ')[0],
        match_id: matchId,
        contest_id: contest.id,
        team_name: teamName,
        captain_id: lineup.captain.id,
        vice_captain_id: lineup.viceCaptain.id,
        total_points: 0,
        rank: currentFilled + 1,
        phase: 1,
        lineup: lineup.players.map(p => ({
          id: p.id,
          name: p.name,
          role: p.role,
          team_name: p.team_name,
          credits: p.credits,
          is_captain: p.id === lineup.captain.id,
          is_vice_captain: p.id === lineup.viceCaptain.id,
          multiplier: p.id === lineup.captain.id ? 2.0 : p.id === lineup.viceCaptain.id ? 1.5 : 1.0,
        })),
      });

      const updatedFilled = currentFilled + 1;
      await contest.update({ filled_spots: updatedFilled });

      // Invalidate match contest cache so spots count updates in real-time
      const redisCache = require('../cache/redis');
      await redisCache.del(`match:${matchId}:contests`);

      // Handle Battlefield auto-clone if room filled
      if (contest.type === 'multi_battlefield') {
        await handleBattlefieldFill(contest);
      }

      if (matchRecord) {
        matchRecord.lastDeploymentAt = new Date().toISOString();
        matchRecord.contestsProgress[contest.id] = {
          title: contest.title,
          type: contest.type,
          filled: updatedFilled,
          total: totalSpots
        };
      }

      console.log(`🤖 [Micro-Batch Organic Join] 1 bot joined "${contest.title}" (${match.title}) | Spots: ${updatedFilled}/${totalSpots} | Time left: ${hoursUntilStart.toFixed(1)}h`);

      // Natural jitter delay (150ms - 400ms) between micro-batches
      await new Promise(r => setTimeout(r, 150 + Math.floor(Math.random() * 250)));
    }
  }

  /**
   * Start periodic background scheduler
   */
  startScheduler(intervalMs = 30000) {
    if (this.intervalId) return;
    console.log(`⏱️ [Bot Scheduler] 72-Hour Autonomous Engine active (Poll interval: ${intervalMs / 1000}s)`);
    // Delay first tick by 5s so server boot is non-blocking and lightweight
    setTimeout(() => {
      this.tick().catch(err => console.warn('⚠️ [Bot Scheduler] Initial tick notice:', err.message));
    }, 5000);
    this.intervalId = setInterval(() => {
      this.tick().catch(err => console.warn('⚠️ [Bot Scheduler] Interval tick notice:', err.message));
    }, intervalMs);
  }

  /**
   * Stop background scheduler
   */
  stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 [Bot Scheduler] Autonomous Engine paused.');
    }
  }
}

const botScheduler = new BotScheduler();
const { managerBot } = require('./botManagerBot');

module.exports = {
  botScheduler,
  managerBot,
  isContestEligibleForBots,
  buildValidCricketLineup,
  getCachedBots,
  clearCachedBots,
  getBallsRemaining,
  getRunsRemaining,
  checkIsEndGame,
  rearrangeBotsForEndGame,
  getMaxPrizeRank
};
