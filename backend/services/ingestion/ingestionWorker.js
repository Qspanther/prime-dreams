// 🏏 PRIME DREEMS — REAL-TIME INGESTION WORKER
// Orchestrates Ingestion, Validation, Deduplication, Verification, HotStore, and WebSocket Streaming

const { CricketMatch, CricketPlayer, CricketTeam, TeamPlayer, ScoreAuditLog } = require('../../db/models');
const cricbuzzSource = require('./sources/cricbuzzSource');
const dualSourceVerifier = require('./dualSourceVerifier');
const deduplicator = require('./deduplication');
const hotStore = require('./hotStore');
const { createNormalizedScore, validateScoreUpdate } = require('./normalizedSchema');
const { calculateFantasyPoints, auditPointsChange } = require('../scoring/scoringEngine');
const wsGateway = require('../websocket/wsGateway');
const config = require('../../config');
const { Op } = require('sequelize');

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
        const confirmedLive = liveMatchesFeed.filter(item => item.status === 'live');
        console.info(`[Ingestion] Cricbuzz primary feed: ${liveMatchesFeed.length} fixtures, ${confirmedLive.length} live with scores (${confirmedLive.map(item => item.raw_id).join(',') || 'none'}).`);
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
          const lastEvidence = match.last_live_poll_at || match.updatedAt || match.createdAt;
          const lastSuccessfulPoll = lastEvidence ? new Date(lastEvidence).getTime() : 0;
          if (!sourceFeedHealthy && lastSuccessfulPoll && Date.now() - lastSuccessfulPoll >= 60000) {
            await match.update({
              status: 'upcoming',
              live_data: {
                ...(match.live_data || {}),
                status_text: 'Live status unconfirmed: Cricbuzz feed is unavailable.',
                source: 'Cricbuzz',
              },
            });
            console.warn(`⚠️ [Ingestion] Hid LIVE status for "${match.title}" because its score feed is stale.`);
            continue;
          }
        }

        if (sourceFeedHealthy && match.status === 'live') {
          const misses = (missingFeedPolls.get(match.id) || 0) + 1;
          missingFeedPolls.set(match.id, misses);
          if (misses >= MISSING_FEED_POLLS_BEFORE_END) {
            await match.update({
              status: 'upcoming',
              live_data: {
                ...(match.live_data || {}),
                status_text: 'Live status unconfirmed: Cricbuzz no longer reports this fixture as live.',
                source: 'Cricbuzz',
                last_source_sync_at: new Date().toISOString(),
              },
            });
            missingFeedPolls.delete(match.id);
            console.warn(`⏹️ [Ingestion] Hid stale LIVE status for "${match.title}" after ${misses} successful source polls without the fixture.`);
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
        if (match.status !== cricbuzzMatch.status) {
          await match.update({
            status: cricbuzzMatch.status,
            score_summary: cricbuzzMatch.score_summary || match.score_summary,
            live_data: getSourceLiveData(cricbuzzMatch),
            last_live_poll_at: match.status === 'live' ? new Date() : match.last_live_poll_at,
          });
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
        const lastGoodSnapshot = hotStore.getSnapshot(match.id)?.score || match.score_summary;

        let rawCandidateScore = null;
        let commentaryText = 'Live in-play';

        if (cricbuzzMatch && cricbuzzMatch.score_summary) {
          rawCandidateScore = {
            match_id: match.id,
            current_innings: cricbuzzMatch.score_summary.current_innings,
            team_a: cricbuzzMatch.score_summary.team_a,
            team_b: cricbuzzMatch.score_summary.team_b,
            last_ball_event: cricbuzzMatch.cricbuzz_status || 'Ball in-play',
            commentary: [cricbuzzMatch.cricbuzz_status || 'Live in-play'],
          };
          commentaryText = cricbuzzMatch.cricbuzz_status || 'Live in-play';
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
          await match.update({
            score_summary: {
              team_a: normalized.team_a,
              team_b: normalized.team_b,
              current_innings: normalized.current_innings,
            },
            live_data: {
              ...(match.live_data || {}),
              status_text: commentaryText,
              source: 'Cricbuzz',
              last_source_sync_at: new Date().toISOString(),
            },
            last_live_poll_at: new Date(),
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
          source: 'Cricbuzz Ingestion Engine',
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
            source: 'Cricbuzz',
            last_source_sync_at: new Date().toISOString(),
            last_ball_time: new Date().toISOString(),
          },
          last_live_poll_at: new Date(),
        });

        // Recalculate Fantasy Player Points & Team Totals (Section 6)
        await updatePlayerFantasyPoints(match.id, normalized, eventId);

        // Broadcast lean 200-byte DELTA to connected WebSocket clients (Section 3.2)
        wsGateway.broadcastDelta(match.id, {
          over: activeScore.overs,
          runs: activeScore.runs,
          wickets: activeScore.wickets,
          current_innings: normalized.current_innings,
          event: normalized.last_ball_event,
          commentary: normalized.commentary[0] || commentaryText,
          score_summary: {
            team_a: normalized.team_a,
            team_b: normalized.team_b,
            current_innings: normalized.current_innings,
          },
          cross_check_status: verificationResult.status,
        });
      }
    }

    // Import only source-confirmed live fixtures that the dashboard does not know yet.
    // This does not seed sample data or alter existing users, wallets, or contests.
    for (const feedMatch of liveMatchesFeed) {
      if (feedMatch.status !== 'live' || matchedFeedIds.has(feedMatch.cricbuzz_id)) continue;
      const existing = await CricketMatch.findOne({ where: { cricbuzz_id: feedMatch.cricbuzz_id } });
      if (!existing) await createDiscoveredLiveMatch(feedMatch);
    }
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
async function updatePlayerFantasyPoints(matchId, scoreData, eventId) {
  try {
    const players = await CricketPlayer.findAll({ where: { match_id: matchId } });
    if (players.length === 0) return;

    // Distribute points based on scoring weights
    for (const player of players) {
      const oldPts = Number(player.points) || 0;
      const stats = player.stats || {};
      const newPts = calculateFantasyPoints(stats, player.role, config.SCORING_WEIGHTS);

      if (Math.abs(newPts - oldPts) >= 0.5) {
        await player.update({ points: newPts });
        await auditPointsChange(matchId, player.id, player.name, 'stats_update', oldPts, newPts, eventId);
      }
    }

    // Recalculate Fantasy User Teams (Captain 2x, VC 1.5x)
    const teams = await CricketTeam.findAll({
      where: { match_id: matchId },
      include: [{ model: TeamPlayer, as: 'teamPlayers' }]
    });

    const playerMap = new Map();
    players.forEach(p => playerMap.set(p.id, Number(p.points) || 0));

    for (const team of teams) {
      let teamTotal = 0;
      for (const tp of team.teamPlayers) {
        const basePts = playerMap.get(tp.player_id) || 0;
        let earned = basePts;
        if (tp.is_captain) earned = basePts * config.CAPTAIN_MULTIPLIER;
        else if (tp.is_vice_captain) earned = basePts * config.VICE_CAPTAIN_MULTIPLIER;

        await tp.update({ points_earned: earned });
        teamTotal += earned;
      }
      await team.update({ total_points: Math.round(teamTotal * 10) / 10 });
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

