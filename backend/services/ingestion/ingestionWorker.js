// 🏏 PRIME DREEMS — REAL-TIME INGESTION WORKER
// Orchestrates Ingestion, Validation, Deduplication, Verification, HotStore, and WebSocket Streaming

const { CricketMatch, CricketPlayer, MatchContest, CricketTeam, TeamPlayer, ScoreAuditLog, BotTeam } = require('../../db/models');
const cricbuzzSource = require('./sources/cricbuzzSource');
const dualSourceVerifier = require('./dualSourceVerifier');
const deduplicator = require('./deduplication');
const hotStore = require('./hotStore');
const { createNormalizedScore, validateScoreUpdate } = require('./normalizedSchema');
const { calculateFantasyPoints, auditPointsChange } = require('../scoring/scoringEngine');
const wsGateway = require('../websocket/wsGateway');
const config = require('../../config');
const { Op } = require('sequelize');
const { botScheduler, checkIsEndGame, rearrangeBotsForEndGame } = require('../botScheduler');
const { isMatchBlacklisted } = require('../deletedMatchesRegistry');
const { fetchMatchTelemetry } = require('../cricbuzzAdapter');

let workerInterval = null;
let isProcessing = false;
let lastFeedDiagnosticAt = 0;
const missingFeedPolls = new Map();
const MISSING_FEED_POLLS_BEFORE_END = 12;

function normalizeTeamName(value) {
  return String(value || '').toLowerCase().replace(/\b(women|womens|men|u\d{2})\b/g, '').replace(/[^a-z0-9]/g, '');
}

function findMatchingFeedMatch(match, feed) {
  if (match.cricbuzz_id) {
    const byId = feed.find(item => item.cricbuzz_id === match.cricbuzz_id);
    if (byId) return byId;
  }
  const teamA = normalizeTeamName(match.team_a);
  const teamB = normalizeTeamName(match.team_b);
  const teamACode = normalizeTeamName(match.team_a_code);
  const teamBCode = normalizeTeamName(match.team_b_code);
  return feed.find(item => {
    const feedA = normalizeTeamName(item.team_a);
    const feedB = normalizeTeamName(item.team_b);
    const feedACode = normalizeTeamName(item.team_a_code);
    const feedBCode = normalizeTeamName(item.team_b_code);
    return (
      (teamA === feedA && teamB === feedB) ||
      (teamA === feedB && teamB === feedA) ||
      (teamACode && teamBCode && teamACode === feedACode && teamBCode === feedBCode) ||
      (teamACode && teamBCode && teamACode === feedBCode && teamBCode === feedACode)
    );
  });
}

function getSourceLiveData(feedMatch, timestamp = new Date().toISOString()) {
  return {
    status_text: feedMatch.cricbuzz_status || 'Live score from Cricbuzz',
    commentary: [feedMatch.cricbuzz_status || 'Live score from Cricbuzz'],
    source: 'Cricbuzz',
    last_source_sync_at: timestamp,
  };
}

async function createDiscoveredLiveMatch(feedMatch) {
  if (isMatchBlacklisted(feedMatch)) {
    console.log(`🛡️ [Ingestion] Blocked recreation of admin-deleted match: "${feedMatch.title}"`);
    return null;
  }
  const startTime = feedMatch.start_time_ms ? new Date(feedMatch.start_time_ms) : new Date();
  const now = new Date();
  const match = await CricketMatch.create({
    cricbuzz_id: feedMatch.cricbuzz_id,
    title: feedMatch.title,
    category: feedMatch.category,
    team_a: feedMatch.team_a,
    team_a_code: feedMatch.team_a_code,
    team_b: feedMatch.team_b,
    team_b_code: feedMatch.team_b_code,
    venue: feedMatch.venue,
    match_date: startTime.toISOString().slice(0, 10),
    match_time: startTime.toISOString().slice(11, 16),
    start_time: startTime,
    status: 'live',
    score_summary: feedMatch.score_summary || {},
    live_data: getSourceLiveData(feedMatch),
    last_live_poll_at: now,
  });
  const normalized = createNormalizedScore({
    match_id: match.id,
    ...feedMatch.score_summary,
    last_ball_event: feedMatch.cricbuzz_status,
    commentary: [feedMatch.cricbuzz_status || 'Live score from Cricbuzz'],
  });
  hotStore.setSnapshot(match.id, normalized, {
    source: 'Cricbuzz Ingestion Engine',
    cross_check_status: 'PRIMARY_ACCEPTED',
    is_degraded: false,
  });
  console.log(`🆕 [Ingestion] Discovered live match "${match.title}" from Cricbuzz.`);

  // Auto-seed players (15 Team A + 15 Team B) immediately so roster is never empty
  try {
    const { generateSquad } = require('../cricbuzzAdapter');
    const squadA = generateSquad(match.team_a, match.team_a_code);
    const squadB = generateSquad(match.team_b, match.team_b_code);
    for (const p of squadA) {
      await CricketPlayer.create({
        match_id: match.id,
        team_name: match.team_a,
        name: p.name,
        role: p.role,
        photo_url: p.photo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.name)}`,
        credits: p.credits || 9.0,
        points: 0,
        stats: { runs: 0, balls: 0, wickets: 0, overs: 0 },
      });
    }
    for (const p of squadB) {
      await CricketPlayer.create({
        match_id: match.id,
        team_name: match.team_b,
        name: p.name,
        role: p.role,
        photo_url: p.photo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.name)}`,
        credits: p.credits || 9.0,
        points: 0,
        stats: { runs: 0, balls: 0, wickets: 0, overs: 0 },
      });
    }
  } catch (err) {
    console.warn(`[Ingestion] Could not auto-seed players for ${match.title}: ${err.message}`);
  }

  // Auto-seed standard contests for newly discovered match so contest cards always show
  try {
    const defaultTemplates = [
      { type: 'standard', title: 'Mega Contest (Grand League)', prize_pool: 10000, entry_fee: 49, total_spots: 250, filled_spots: 184, is_active: true, is_private: false, status: 'open' },
      { type: 'standard', title: 'Winner Takes All', prize_pool: 5000, entry_fee: 99, total_spots: 55, filled_spots: 41, is_active: true, is_private: false, status: 'open' },
      { type: 'h2h', title: 'Head-to-Head Duel', prize_pool: 90, entry_fee: 50, total_spots: 2, filled_spots: 1, is_active: true, is_private: false, status: 'open' },
      { type: 'practice', title: 'Practice Contest (Free)', prize_pool: 0, entry_fee: 0, total_spots: 100, filled_spots: 32, is_active: true, is_private: false, status: 'open' },
      { type: 'standard', title: 'Rookie Contest (Beginner Arena)', prize_pool: 1500, entry_fee: 19, total_spots: 100, filled_spots: 78, is_active: true, is_private: false, status: 'open' },
    ];
    for (const tmpl of defaultTemplates) {
      await MatchContest.create({ ...tmpl, match_id: match.id });
    }
  } catch (err) {
    console.warn(`[Ingestion] Could not auto-seed contests for ${match.title}: ${err.message}`);
  }

  return match;
}

/**
 * Main ingestion loop tick (runs every 6-8 seconds for live ball fidelity)
 */
async function processLiveIngestionTick() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // Check global pause
    if (hotStore.metrics.is_global_paused) {
      hotStore.metrics.worker_status = 'PAUSED';
      isProcessing = false;
      return;
    }

    hotStore.metrics.worker_status = 'RUNNING';

    // 1. Fetch latest live feed from Cricbuzz Primary Source
    let liveMatchesFeed = [];
    try {
      liveMatchesFeed = await cricbuzzSource.fetchLiveFeed();
      hotStore.recordSourceResult('primary', true);
      hotStore.metrics.last_sync_time = new Date().toISOString();
      if (Date.now() - lastFeedDiagnosticAt >= 60000) {
        const scoreReady = liveMatchesFeed.filter(item => item.score_data_available);
        const inProgress = liveMatchesFeed.filter(item => /in progress|innings break/i.test(item.cricbuzz_state || ''));
        console.info(`[Ingestion] Cricbuzz primary feed: ${liveMatchesFeed.length} fixtures, ${scoreReady.length} with score data, ${inProgress.length} in progress (${inProgress.map(item => `${item.raw_id}:${item.status}:${item.score_data_available ? 'score' : 'no-score'}`).join(',') || 'none'}).`);
        lastFeedDiagnosticAt = Date.now();
      }
    } catch (err) {
      hotStore.recordSourceResult('primary', false, err.message);
      console.warn('⚠️ [Ingestion] Primary source fetch warning:', err.message);
    }

    // 2. Load all active matches from Database
    const dbMatches = await CricketMatch.findAll({
      where: { status: { [Op.in]: ['live', 'upcoming'] } }
    });
    const livePlayerSnapshots = new Map();
    await Promise.all(dbMatches.map(async match => {
      const feedMatch = findMatchingFeedMatch(match, liveMatchesFeed);
      if (!feedMatch || feedMatch.status !== 'live' || !feedMatch.raw_id) return;
      try {
        const snapshot = await cricbuzzSource.fetchLivePlayerSnapshot(feedMatch.raw_id);
        if (snapshot) livePlayerSnapshots.set(match.id, snapshot);
      } catch (error) {
        console.warn(`[Ingestion] Player scorecard refresh failed for ${match.title}: ${error.message}`);
      }
    }));
    const matchedFeedIds = new Set();
    const sourceFeedHealthy = liveMatchesFeed.length > 0;

    for (const match of dbMatches) {
      // Check if this specific match is paused by Admin
      if (hotStore.isMatchPaused(match.id)) {
        continue;
      }

      const cricbuzzMatch = findMatchingFeedMatch(match, liveMatchesFeed);

      if (!cricbuzzMatch) {
        if (match.status === 'live') {
          const hasScore = (match.score_summary?.team_a?.overs > 0 || match.score_summary?.team_a?.runs > 0 || match.score_summary?.team_b?.overs > 0);
          const lastEvidence = match.last_live_poll_at || match.updatedAt || match.createdAt;
          const lastSuccessfulPoll = lastEvidence ? new Date(lastEvidence).getTime() : 0;
          if (!sourceFeedHealthy && lastSuccessfulPoll && Date.now() - lastSuccessfulPoll >= 60000) {
            // Keep status as 'live' if match has started; never demote an in-play match to 'upcoming'
            await match.update({
              status: hasScore ? 'live' : 'upcoming',
              live_data: {
                ...(match.live_data || {}),
                status_text: hasScore ? 'In-play: Live telemetry syncing...' : 'Scheduled match.',
                source: 'Cricbuzz',
              },
            });
            continue;
          }
        }

        if (sourceFeedHealthy && match.status === 'live') {
          const misses = (missingFeedPolls.get(match.id) || 0) + 1;
          missingFeedPolls.set(match.id, misses);
          if (misses >= MISSING_FEED_POLLS_BEFORE_END) {
            const hasScore = (match.score_summary?.team_a?.overs > 0 || match.score_summary?.team_a?.runs > 0 || match.score_summary?.team_b?.overs > 0);
            // In-play matches that drop from live feed are either concluded or in break; never upcoming!
            const newStatus = hasScore ? (match.live_data?.status_text?.toLowerCase().includes('won') ? 'completed' : 'live') : 'upcoming';
            await match.update({
              status: newStatus,
              live_data: {
                ...(match.live_data || {}),
                status_text: hasScore ? (match.live_data?.status_text || 'Match in break / between sessions') : 'Scheduled fixture',
                source: 'Cricbuzz',
                last_source_sync_at: new Date().toISOString(),
              },
            });
            missingFeedPolls.delete(match.id);
            console.log(`ℹ️ [Ingestion] Maintained "${match.title}" status as ${newStatus} (in-play score preserved).`);
          }
        }
        continue;
      }

      matchedFeedIds.add(cricbuzzMatch.cricbuzz_id);
      missingFeedPolls.delete(match.id);

      if (match.cricbuzz_id !== cricbuzzMatch.cricbuzz_id) {
        await match.update({ cricbuzz_id: cricbuzzMatch.cricbuzz_id });
      }
      if (cricbuzzMatch.venue && match.venue !== cricbuzzMatch.venue) {
        await match.update({ venue: cricbuzzMatch.venue });
      }

      if (cricbuzzMatch.status !== 'live') {
        const update = {};
        if (match.status !== cricbuzzMatch.status) update.status = cricbuzzMatch.status;
        if (cricbuzzMatch.score_data_available) {
          const sourceScore = createNormalizedScore({
            match_id: match.id,
            current_innings: cricbuzzMatch.score_summary?.current_innings,
            team_a: cricbuzzMatch.score_summary?.team_a,
            team_b: cricbuzzMatch.score_summary?.team_b,
          });
          const validation = validateScoreUpdate(sourceScore, match.score_summary);
          if (validation.valid) {
            update.score_summary = {
              team_a: sourceScore.team_a,
              team_b: sourceScore.team_b,
              current_innings: sourceScore.current_innings,
            };
            update.last_live_poll_at = new Date();
          } else {
            console.warn(`🛡️ [Ingestion Validation REJECTED] ${match.title}: ${validation.reason}`);
          }
        }
        if (Object.keys(update).length > 0 || match.status !== cricbuzzMatch.status || cricbuzzMatch.score_data_available) {
          update.live_data = getSourceLiveData(cricbuzzMatch);
          await match.update(update);
        }
        if (match.status !== cricbuzzMatch.status) {
          console.log(`🔄 [Ingestion] Match "${match.title}" is now ${cricbuzzMatch.status}: ${cricbuzzMatch.cricbuzz_status || cricbuzzMatch.cricbuzz_state}.`);
        }
        continue;
      }

      // ─── CASE A: Upcoming Match Real-World Transition to LIVE ───
      if (match.status === 'upcoming') {
        console.log(`⚡ [Ingestion] Auto-Transitioning match "${match.title}" to LIVE (Cricbuzz confirms in-play).`);
        await match.update({ status: 'live' });
        match.status = 'live';
      }

      // ─── CASE B: Live In-Play Match Telemetry Update ───
      if (match.status === 'live') {
        const playerSnapshot = livePlayerSnapshots.get(match.id) || null;
        const lastGoodSnapshot = hotStore.getSnapshot(match.id)?.score || match.score_summary;

        let rawCandidateScore = null;
        let commentaryText = 'Live in-play';

        // Fetch deep match telemetry (striker, non-striker, bowler, balls) from Cricbuzz web stream
        const rawMatchId = cricbuzzMatch.raw_id || (match.cricbuzz_id ? String(match.cricbuzz_id).replace(/^cb-/, '') : null);
        let liveTelemetry = null;
        if (rawMatchId) {
          liveTelemetry = await fetchMatchTelemetry(rawMatchId).catch(() => null);
        }

        if (cricbuzzMatch && cricbuzzMatch.score_summary) {
          rawCandidateScore = {
            match_id: match.id,
            current_innings: cricbuzzMatch.score_summary.current_innings,
            team_a: cricbuzzMatch.score_summary.team_a,
            team_b: cricbuzzMatch.score_summary.team_b,
            last_ball_event: liveTelemetry?.cricbuzz_status || cricbuzzMatch.cricbuzz_status || 'Ball in-play',
            commentary: [liveTelemetry?.cricbuzz_status || cricbuzzMatch.cricbuzz_status || 'Live in-play'],
            current_striker: liveTelemetry?.current_striker || match.live_data?.current_striker || null,
            non_striker: liveTelemetry?.non_striker || match.live_data?.non_striker || null,
            current_bowler: liveTelemetry?.current_bowler || match.live_data?.current_bowler || null,
            recent_balls: liveTelemetry?.recent_balls || match.live_data?.recent_balls || [],
            current_rate: liveTelemetry?.current_rate || match.live_data?.current_rate || '0.00',
            required_rate: liveTelemetry?.required_rate || match.live_data?.required_rate || '—',
          };
          commentaryText = liveTelemetry?.cricbuzz_status || cricbuzzMatch.cricbuzz_status || 'Live in-play';
        } else {
          // If no external feed available, use last good snapshot
          continue;
        }

        // Normalize candidate score
        const normalized = createNormalizedScore(rawCandidateScore);

        // Active inning score
        const activeScore = normalized.current_innings === 'team_a' ? normalized.team_a : normalized.team_b;
        const ballPart = Math.round((activeScore.overs % 1) * 10);
        const overPart = Math.floor(activeScore.overs);

        // Deduplication & Idempotency check (Section 2.2)
        const eventId = deduplicator.generateEventId(
          match.id,
          normalized.current_innings,
          overPart,
          ballPart,
          activeScore.runs,
          activeScore.wickets
        );

        if (deduplicator.isDuplicate(eventId)) {
          // The score is unchanged, but refresh source freshness and live status.
          const lastSnapshot = hotStore.getSnapshot(match.id);
          hotStore.setSnapshot(match.id, normalized, {
            source: 'Cricbuzz Ingestion Engine',
            cross_check_status: lastSnapshot?.cross_check_status || 'PRIMARY_ACCEPTED',
            is_degraded: lastSnapshot?.is_degraded || false,
          });
          const mergedLive = {
            ...(match.live_data || {}),
            current_striker: normalized.current_striker || match.live_data?.current_striker || null,
            non_striker: normalized.non_striker || match.live_data?.non_striker || null,
            current_bowler: normalized.current_bowler || match.live_data?.current_bowler || null,
            recent_balls: normalized.recent_balls || match.live_data?.recent_balls || [],
            current_rate: normalized.current_rate || match.live_data?.current_rate || '0.00',
            required_rate: normalized.required_rate || match.live_data?.required_rate || '—',
            status_text: commentaryText,
            source: 'Cricbuzz',
            last_source_sync_at: new Date().toISOString(),
          };
          await match.update({
            score_summary: {
              team_a: normalized.team_a,
              team_b: normalized.team_b,
              current_innings: normalized.current_innings,
            },
            live_data: mergedLive,
            last_live_poll_at: new Date(),
          });
          if (playerSnapshot) await updatePlayerFantasyPoints(match.id, normalized, eventId, playerSnapshot);

          // Broadcast DELTA so frontend UI updates striker/bowler even if total score hasn't ticked
          wsGateway.broadcastDelta(match.id, {
            over: activeScore.overs,
            runs: activeScore.runs,
            wickets: activeScore.wickets,
            current_innings: normalized.current_innings,
            event: normalized.last_ball_event,
            commentary: normalized.commentary[0] || commentaryText,
            current_striker: mergedLive.current_striker,
            non_striker: mergedLive.non_striker,
            current_bowler: mergedLive.current_bowler,
            recent_balls: mergedLive.recent_balls,
            current_rate: mergedLive.current_rate,
            required_rate: mergedLive.required_rate,
            score_summary: {
              team_a: normalized.team_a,
              team_b: normalized.team_b,
              current_innings: normalized.current_innings,
            },
            cross_check_status: lastSnapshot?.cross_check_status || 'PRIMARY_ACCEPTED',
          });
          continue;
        }

        // Strict Monotonicity & Data Validation (Section 2.3)
        const validation = validateScoreUpdate(normalized, lastGoodSnapshot);
        if (!validation.valid) {
          console.warn(`🛡️ [Ingestion Validation REJECTED] Match ${match.title}: ${validation.reason}`);
          hotStore.recordValidationFailure(match.id, validation.reason, normalized);

          // Log audit entry
          await ScoreAuditLog.create({
            match_id: match.id,
            action: 'validation_rejection',
            old_value: lastGoodSnapshot,
            new_value: normalized,
            reason: validation.reason,
            admin_username: 'Ingestion_Validator',
          });
          continue; // Discard invalid score
        }

        // Dual-source cross-check verification (Section 2.1)
        let verificationResult = { status: 'VERIFIED', verified: true };
        if (cricbuzzMatch?.raw_id) {
          verificationResult = await dualSourceVerifier.verifyMatchScore(cricbuzzMatch.raw_id, normalized);
        }

        // Update HotStore with verified snapshot (Section 2.4)
        hotStore.setSnapshot(match.id, normalized, {
          source: 'Prime Telemetry Engine',
          cross_check_status: verificationResult.status,
          is_degraded: !verificationResult.verified,
        });

        // Update database record
        await match.update({
          score_summary: {
            team_a: normalized.team_a,
            team_b: normalized.team_b,
            current_innings: normalized.current_innings,
          },
          live_data: {
            current_striker: normalized.current_striker,
            non_striker: normalized.non_striker,
            current_bowler: normalized.current_bowler,
            recent_balls: normalized.recent_balls,
            current_rate: normalized.current_rate,
            required_rate: normalized.required_rate,
            partnership: normalized.partnership,
            commentary: normalized.commentary,
            status_text: commentaryText,
            source: 'Prime Telemetry Gateway',
            last_source_sync_at: new Date().toISOString(),
            last_ball_time: new Date().toISOString(),
          },
          last_live_poll_at: new Date(),
        });

        // Recalculate Fantasy Player Points & Team Totals (Section 6)
        await updatePlayerFantasyPoints(match.id, normalized, eventId, playerSnapshot);

        // Dynamic End-Game Tactical Rearrangement Check (Last 6-10 Balls Stage)
        try {
          const updatedMatch = await CricketMatch.findByPk(match.id);
          const eg = checkIsEndGame(updatedMatch);
          if (eg.isEndGame && !botScheduler.endGameProcessed.has(match.id)) {
            console.log(`⚡ [Ingestion Live Hook] Match "${match.title}" reached death stage: ${eg.remainingBalls} balls remaining! Triggering bot rearrangement...`);
            await rearrangeBotsForEndGame(match.id);
            botScheduler.endGameProcessed.add(match.id);
          }
        } catch (egHookErr) {
          console.warn(`⚠️ [Ingestion EndGame Hook Warning]:`, egHookErr.message);
        }

        // Broadcast lean DELTA with striker, bowler, recent balls to connected WebSocket clients (Section 3.2)
        wsGateway.broadcastDelta(match.id, {
          over: activeScore.overs,
          runs: activeScore.runs,
          wickets: activeScore.wickets,
          current_innings: normalized.current_innings,
          event: normalized.last_ball_event,
          commentary: normalized.commentary[0] || commentaryText,
          current_striker: normalized.current_striker,
          non_striker: normalized.non_striker,
          current_bowler: normalized.current_bowler,
          recent_balls: normalized.recent_balls,
          current_rate: normalized.current_rate,
          required_rate: normalized.required_rate,
          score_summary: {
            team_a: normalized.team_a,
            team_b: normalized.team_b,
            current_innings: normalized.current_innings,
          },
          cross_check_status: verificationResult.status,
        });
      }
    }

    // NOTE: Auto-discovery/creation of new matches and contests from Cricbuzz feed
    // has been disabled per admin specification. Matches and contests must ONLY be
    // imported or generated manually by an Administrator via the Admin Panel.
  } catch (err) {
    console.error('❌ [Ingestion Worker] Error in tick:', err);
    hotStore.metrics.worker_status = 'ERROR';
  } finally {
    isProcessing = false;
  }
}

/**
 * Updates fantasy player points and recalculates contest team totals
 */
async function updatePlayerFantasyPoints(matchId, scoreData, eventId, playerSnapshot = null) {
  try {
    if (Array.isArray(playerSnapshot?.players) && playerSnapshot.players.length > 0) {
      const existingPlayers = await CricketPlayer.findAll({ where: { match_id: matchId } });
      const norm = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const keyFor = (name, teamName) => `${norm(teamName)}|${norm(name)}`;

      const playerByKey = new Map();
      const existingByTeam = new Map();
      for (const p of existingPlayers) {
        playerByKey.set(keyFor(p.name, p.team_name), p);
        const tKey = norm(p.team_name);
        if (!existingByTeam.has(tKey)) existingByTeam.set(tKey, []);
        existingByTeam.get(tKey).push(p);
      }

      const matchedPlayerIds = new Set();

      for (const sourcePlayer of playerSnapshot.players) {
        const name = String(sourcePlayer.name || '').trim();
        const teamName = String(sourcePlayer.team_name || '').trim();
        if (!name || !teamName) continue;

        const k = keyFor(name, teamName);
        let existing = playerByKey.get(k);

        // If not found by exact name, look for placeholder player in the same team
        if (!existing) {
          const teamPool = existingByTeam.get(norm(teamName)) || [];
          const placeholder = teamPool.find(p =>
            !matchedPlayerIds.has(p.id) &&
            (/(\b(arab|test|player|xi)\b|\d+)/i.test(p.name) || !p.stats || Object.keys(p.stats).length === 0 || Number(p.points || 0) === 0)
          );

          if (placeholder) {
            existing = placeholder;
            await existing.update({
              name,
              role: sourcePlayer.role || existing.role || 'BAT',
              stats: sourcePlayer.stats || existing.stats || {},
              credits: sourcePlayer.credits || existing.credits || 9,
            });
            playerByKey.set(k, existing);
          }
        }

        if (existing) {
          matchedPlayerIds.add(existing.id);
          const stats = sourcePlayer.stats || existing.stats || {};
          if (JSON.stringify(existing.stats || {}) !== JSON.stringify(stats || {})) {
            await existing.update({ stats, role: sourcePlayer.role || existing.role });
          }
        } else {
          const created = await CricketPlayer.create({
            match_id: matchId,
            name,
            team_name: teamName,
            role: sourcePlayer.role || 'BAT',
            credits: sourcePlayer.credits || 9,
            points: 0,
            stats: sourcePlayer.stats || {},
          });
          matchedPlayerIds.add(created.id);
          playerByKey.set(k, created);
        }
      }
    }

    const players = await CricketPlayer.findAll({ where: { match_id: matchId } });
    if (players.length === 0) return;

    // Distribute points based on scoring weights
    for (const player of players) {
      const oldPts = Number(player.points) || 0;
      const stats = player.stats || {};
      const newPts = calculateFantasyPoints(stats, player.role, config.SCORING_WEIGHTS);

      if (Math.abs(newPts - oldPts) >= 0.5) {
        await player.update({ points: newPts });
        player.points = newPts;
        await auditPointsChange(matchId, player.id, player.name, 'stats_update', oldPts, newPts, eventId);
      }
    }

    // Build lookup maps
    const playerMap = new Map();
    const playerNameMap = new Map();
    players.forEach(p => {
      playerMap.set(p.id, Number(p.points) || 0);
      playerNameMap.set(p.id, p.name);
    });

    // 1. Recalculate Fantasy User Teams (Captain 2x, VC 1.5x)
    const teams = await CricketTeam.findAll({
      where: { match_id: matchId },
      include: [{ model: TeamPlayer, as: 'teamPlayers' }]
    });

    for (const team of teams) {
      let teamTotal = 0;
      for (const tp of (team.teamPlayers || [])) {
        const basePts = playerMap.get(tp.player_id) || 0;
        let earned = basePts;
        if (tp.is_captain) earned = basePts * (config.CAPTAIN_MULTIPLIER || 2.0);
        else if (tp.is_vice_captain) earned = basePts * (config.VICE_CAPTAIN_MULTIPLIER || 1.5);
        earned = Math.round(earned * 10) / 10;

        await tp.update({ points_earned: earned });
        teamTotal += earned;
      }
      teamTotal = Math.round(teamTotal * 10) / 10;
      await team.update({ total_points: teamTotal });
    }

    // 2. Recalculate Bot Teams (Captain 2x, VC 1.5x)
    const botTeams = await BotTeam.findAll({ where: { match_id: matchId } });
    for (const bt of botTeams) {
      let botTotal = 0;
      const rawLineup = Array.isArray(bt.lineup) ? bt.lineup : (typeof bt.lineup === 'string' ? JSON.parse(bt.lineup || '[]') : []);
      const updatedLineup = rawLineup.map(p => {
        const basePts = playerMap.get(p.id) || 0;
        const isCap = Boolean(p.is_captain || p.id === bt.captain_id);
        const isVc = Boolean(p.is_vice_captain || p.id === bt.vice_captain_id);
        let earned = basePts;
        if (isCap) earned = basePts * (config.CAPTAIN_MULTIPLIER || 2.0);
        else if (isVc) earned = basePts * (config.VICE_CAPTAIN_MULTIPLIER || 1.5);
        earned = Math.round(earned * 10) / 10;
        botTotal += earned;
        return {
          ...p,
          name: playerNameMap.get(p.id) || p.name,
          points: basePts,
          points_earned: earned,
        };
      });
      botTotal = Math.round(botTotal * 10) / 10;
      await bt.update({
        total_points: botTotal,
        lineup: updatedLineup,
      });
    }

    // 3. Keep every contest rank synchronized across ALL teams (human + bot)
    const contests = await MatchContest.findAll({ where: { match_id: matchId } });
    for (const contest of contests) {
      const [contestTeams, contestBots] = await Promise.all([
        CricketTeam.findAll({ where: { contest_id: contest.id } }),
        BotTeam.findAll({ where: { contest_id: contest.id } }),
      ]);

      const allEntries = [
        ...contestTeams.map(t => ({ entity: t, total_points: Number(t.total_points) || 0, created_at: t.created_at })),
        ...contestBots.map(b => ({ entity: b, total_points: Number(b.total_points) || 0, created_at: b.created_at })),
      ];

      allEntries.sort((a, b) => (b.total_points - a.total_points) || (new Date(a.created_at) - new Date(b.created_at)));

      for (let index = 0; index < allEntries.length; index++) {
        const targetRank = index + 1;
        const entry = allEntries[index];
        if (entry.entity.rank !== targetRank) {
          await entry.entity.update({ rank: targetRank });
        }
      }
    }
  } catch (err) {
    console.error(`⚠️ [Ingestion] Points calculation error for match ${matchId}:`, err.message);
  }
}

/**
 * Starts the resilient ingestion service
 */
function startIngestionService() {
  if (workerInterval) return;
  console.log('⚡ [Ingestion Service] Initializing Live Cricket Ingestion Worker (7s cadence)...');
  processLiveIngestionTick();
  workerInterval = setInterval(processLiveIngestionTick, 7000); // 7s tick for real-time ball precision
}

module.exports = {
  startIngestionService,
  processLiveIngestionTick,
};

