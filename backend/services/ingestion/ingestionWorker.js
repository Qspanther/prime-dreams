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

let workerInterval = null;
let isProcessing = false;

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
    } catch (err) {
      hotStore.recordSourceResult('primary', false, err.message);
      console.warn('⚠️ [Ingestion] Primary source fetch warning:', err.message);
    }

    // 2. Load all active matches from Database
    const dbMatches = await CricketMatch.findAll({
      where: { status: ['live', 'upcoming'] }
    });

    for (const match of dbMatches) {
      // Check if this specific match is paused by Admin
      if (hotStore.isMatchPaused(match.id)) {
        continue;
      }

      // Find matching Cricbuzz record by cricbuzz_id or fuzzy team match
      const cricbuzzMatch = liveMatchesFeed.find(m => {
        if (match.cricbuzz_id && m.cricbuzz_id === match.cricbuzz_id) return true;
        if (m.raw_id && match.cricbuzz_id === `cb-${m.raw_id}`) return true;
        // Fuzzy team name match
        const teamAMatch = m.team_a.toLowerCase().includes(match.team_a.toLowerCase()) || match.team_a.toLowerCase().includes(m.team_a.toLowerCase());
        const teamBMatch = m.team_b.toLowerCase().includes(match.team_b.toLowerCase()) || match.team_b.toLowerCase().includes(m.team_b.toLowerCase());
        return teamAMatch && teamBMatch;
      });

      // ─── CASE A: Upcoming Match Real-World Transition to LIVE ───
      if (match.status === 'upcoming') {
        if (cricbuzzMatch && cricbuzzMatch.status === 'live') {
          console.log(`⚡ [Ingestion] Auto-Transitioning match "${match.title}" to LIVE (Real-world in-play detected)!`);
          await match.update({
            status: 'live',
            cricbuzz_id: cricbuzzMatch.cricbuzz_id,
          });
          match.status = 'live'; // proceed to live score processing
        } else {
          continue; // Match is not yet live
        }
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
          // Already processed this exact ball state, skip duplicate DB writes
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

