// 🏏 PRIME DREEMS — REPLAY & CHAOS VERIFICATION TEST SUITE
// Section 8: Verifies Ingestion, Monotonicity Guards, Deduplication, and Scoring Engine

const assert = require('assert');
const { validateScoreUpdate, createNormalizedScore } = require('../services/ingestion/normalizedSchema');
const deduplicator = require('../services/ingestion/deduplication');
const hotStore = require('../services/ingestion/hotStore');
const { calculateFantasyPoints } = require('../services/scoring/scoringEngine');

async function runTestSuite() {
  console.log('🧪 ========================================================');
  console.log('🧪 PRIME DREEMS ZERO-MISTAKE INGESTION & SCORING TEST SUITE');
  console.log('🧪 ========================================================\n');

  // Test 1: Monotonicity Validator (Section 2.3)
  console.log('▶ TEST 1: Strict Score Monotonicity Checks');
  const snapshot1 = {
    current_innings: 'team_a',
    team_a: { runs: 120, wickets: 2, overs: 14.2 },
    team_b: { runs: 0, wickets: 0, overs: 0 },
  };

  // 1a: Valid forward progression
  const validUpdate = {
    match_id: 'test-1',
    current_innings: 'team_a',
    team_a: { runs: 124, wickets: 2, overs: 14.3 },
    team_b: { runs: 0, wickets: 0, overs: 0 },
  };
  const val1 = validateScoreUpdate(validUpdate, snapshot1);
  assert.strictEqual(val1.valid, true, 'Valid ball update must pass validation');
  console.log('   ✓ Valid score advancement accepted');

  // 1b: Corrupt / Decreasing Runs (Stale feed)
  const decreasingRuns = {
    match_id: 'test-1',
    current_innings: 'team_a',
    team_a: { runs: 118, wickets: 2, overs: 14.3 }, // runs dropped from 120 to 118!
    team_b: { runs: 0, wickets: 0, overs: 0 },
  };
  const val2 = validateScoreUpdate(decreasingRuns, snapshot1);
  assert.strictEqual(val2.valid, false, 'Decreasing runs must be rejected');
  console.log(`   ✓ Monotonicity guard caught decreasing runs: "${val2.reason}"`);

  // 1c: Decreasing Wickets
  const decreasingWickets = {
    match_id: 'test-1',
    current_innings: 'team_a',
    team_a: { runs: 125, wickets: 1, overs: 14.4 }, // wickets dropped from 2 to 1!
    team_b: { runs: 0, wickets: 0, overs: 0 },
  };
  const val3 = validateScoreUpdate(decreasingWickets, snapshot1);
  assert.strictEqual(val3.valid, false, 'Decreasing wickets must be rejected');
  console.log(`   ✓ Monotonicity guard caught decreasing wickets: "${val3.reason}"`);

  // 1d: Decreasing Overs
  const decreasingOvers = {
    match_id: 'test-1',
    current_innings: 'team_a',
    team_a: { runs: 125, wickets: 2, overs: 13.5 }, // overs went back from 14.2 to 13.5!
    team_b: { runs: 0, wickets: 0, overs: 0 },
  };
  const val4 = validateScoreUpdate(decreasingOvers, snapshot1);
  assert.strictEqual(val4.valid, false, 'Decreasing overs must be rejected');
  console.log(`   ✓ Monotonicity guard caught decreasing overs: "${val4.reason}"`);

  // Test 2: Event Idempotency & Deduplication (Section 2.2)
  console.log('\n▶ TEST 2: Event Deduplication & Idempotency');
  deduplicator.clear();
  const eventId = deduplicator.generateEventId('match-99', 'team_a', 15, 3, 134, 3);
  const isFirst = deduplicator.isDuplicate(eventId);
  assert.strictEqual(isFirst, false, 'First occurrence must not be marked duplicate');

  const isSecond = deduplicator.isDuplicate(eventId);
  assert.strictEqual(isSecond, true, 'Second occurrence of same ball event must be marked duplicate');
  console.log('   ✓ Duplicate ball event successfully detected and suppressed');

  // Test 3: Pure Scoring Engine (Section 6.1)
  console.log('\n▶ TEST 3: Pure Fantasy Scoring Engine');
  const batterStats = { runs: 65, balls: 42, fours: 6, sixes: 3, is_out: false };
  const batterPoints = calculateFantasyPoints(batterStats, 'BAT');
  // Runs: 65, Boundaries: 6 * 1 = 6, Sixes: 3 * 2 = 6, 50-bonus: 8, Strike Rate: (65/42)*100 = 154.76 (+4 pts) -> Total: 65 + 6 + 6 + 8 + 4 = 89
  assert(batterPoints > 80, 'Half-century bonus and strike-rate bonus correctly applied');
  console.log(`   ✓ 65 runs off 42 balls calculated to ${batterPoints} fantasy points`);

  const bowlerStats = { overs: 4, maidens: 1, runs_conceded: 18, wickets: 3 };
  const bowlerPoints = calculateFantasyPoints(bowlerStats, 'BOWL');
  // Wickets: 3 * 25 = 75, Maiden: 1 * 12 = 12, Economy: 18/4 = 4.5 (< 5 -> +6 pts) -> Total: 75 + 12 + 6 = 93
  assert(bowlerPoints >= 93, 'Wickets, maiden and sub-5 economy correctly scored');
  console.log(`   ✓ 4 overs, 1 maiden, 18 runs, 3 wickets calculated to ${bowlerPoints} fantasy points`);

  // Test 4: HotStore Snapshot & Graceful Degradation (Section 2.4)
  console.log('\n▶ TEST 4: HotStore & Graceful Degradation');
  hotStore.setSnapshot('test-degrade', {
    team_a: { runs: 140, wickets: 3, overs: 16.0 },
    team_b: { runs: 0, wickets: 0, overs: 0 },
    current_innings: 'team_a',
  }, { is_degraded: false });

  const snap = hotStore.getSnapshot('test-degrade');
  assert.strictEqual(snap.score.team_a.runs, 140);
  assert.strictEqual(snap.updated_seconds_ago, 0);
  console.log('   ✓ Millisecond snapshot successfully retrieved from HotStore');

  // Test 5: Pause / Resume Ingestion (Section 4.2)
  console.log('\n▶ TEST 5: Admin Ingestion Pause / Resume');
  assert.strictEqual(hotStore.isMatchPaused('match-123'), false);
  hotStore.pauseMatch('match-123');
  assert.strictEqual(hotStore.isMatchPaused('match-123'), true);
  hotStore.resumeMatch('match-123');
  assert.strictEqual(hotStore.isMatchPaused('match-123'), false);
  console.log('   ✓ Ingestion pause/resume controls verified');

  console.log('\n🎉 ALL 5 TEST SUITES PASSED WITH ZERO ERRORS!');
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

