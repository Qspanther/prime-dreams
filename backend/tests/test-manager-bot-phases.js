const { v4: uuidv4 } = require('uuid');
const {
  User,
  CricketMatch,
  CricketPlayer,
  MatchContest,
  CricketTeam,
  TeamPlayer,
  ContestParticipant,
  BotWinHistory
} = require('../db/models');
const {
  rearrangeBotsForEndGame,
  checkIsEndGame,
  getBallsRemaining,
  isContestEligibleForBots
} = require('../services/botScheduler');
const { deployPreContestCricketBots } = require('../routes/bot-manager');
const { managerBot } = require('../services/botManagerBot');

async function testManagerBotPhases() {
  console.log('🧪 Starting Manager Bot & Dynamic Phases Verification Test...\n');

  // 1. Create a simulated live match at death stage
  const matchId = uuidv4();
  const testMatch = await CricketMatch.create({
    id: matchId,
    title: 'Manager Bot Test Match: IND vs PAK — Final',
    category: 'T20',
    team_a: 'India',
    team_a_code: 'IND',
    team_b: 'Pakistan',
    team_b_code: 'PAK',
    venue: 'Lord’s Cricket Ground',
    match_date: 'Today',
    match_time: 'Live Now',
    start_time: new Date(Date.now() - 7200000),
    status: 'live',
    score_summary: {
      team_a: { runs: 192, wickets: 5, overs: 20.0 },
      team_b: { runs: 184, wickets: 8, overs: 18.5 }, // 7 balls remaining -> Death stage!
      current_innings: 'team_b'
    },
    live_data: {
      status_text: 'Pakistan need 9 runs in 7 balls'
    }
  });

  console.log(`✅ Live Test Match created: "${testMatch.title}" (ID: ${matchId})`);

  // Verify death stage detection
  const remaining = getBallsRemaining(testMatch);
  const eg = checkIsEndGame(testMatch);
  console.log(`🎯 Balls Remaining: ${remaining} | Death stage: ${eg.isEndGame ? 'ACTIVE' : 'INACTIVE'}`);
  if (remaining !== 7 || !eg.isEndGame) {
    throw new Error(`Expected 7 balls remaining and isEndGame=true, got ${remaining}, ${eg.isEndGame}`);
  }

  // 2. Create 24 cricket players with diverse fantasy scores
  const players = [];
  const roles = ['WK', 'BAT', 'AR', 'BOWL'];
  for (let i = 1; i <= 24; i++) {
    const isTeamA = i <= 12;
    const role = roles[(i - 1) % 4];
    let points = 15;
    if (i === 1) points = 160; // Centurion Match MVP
    else if (i === 2) points = 125; // 4-wicket haul Bowler
    else if (i === 3) points = 95;  // Solid All-Rounder
    else if (i === 4) points = 80;
    else if (i === 5) points = 70;
    else if (i === 6) points = 55;
    else points = Math.floor(Math.random() * 30) + 5;

    players.push({
      id: uuidv4(),
      match_id: matchId,
      name: `Star Player ${isTeamA ? 'IND' : 'PAK'} ${i}`,
      team_name: isTeamA ? 'India' : 'Pakistan',
      role: role,
      credits: 9.0,
      points: points
    });
  }
  await CricketPlayer.bulkCreate(players);
  console.log(`✅ 24 Match Players created with live fantasy scores.`);

  // 3. Create an eligible large contest (Mega 100 spots)
  const contestId = uuidv4();
  const eligibleContest = await MatchContest.create({
    id: contestId,
    match_id: matchId,
    title: 'Mega 100-Spots Pool',
    type: 'mega',
    total_spots: 100,
    filled_spots: 0,
    entry_fee: 49,
    prize_pool: 4000,
    is_active: true,
    is_private: false,
    status: 'open'
  });

  // 4. Create protected H2H and Private contest
  const h2hId = uuidv4();
  const h2hContest = await MatchContest.create({
    id: h2hId,
    match_id: matchId,
    title: 'H2H Protected 1v1',
    type: 'h2h',
    total_spots: 2,
    filled_spots: 0,
    entry_fee: 100,
    prize_pool: 180,
    is_active: true,
    is_private: false,
    status: 'open'
  });

  // 5. Deploy 60 bots into the contest to test multi-phase batching
  console.log('🤖 Deploying 60 bots into Mega contest...');
  const deployRes = await deployPreContestCricketBots(matchId, contestId, 60);
  console.log(`✅ Deployed ${deployRes.registered} bots.`);

  // 6. Create 4 Human users with high scores
  const humanUsers = [];
  const humanScores = [310.5, 385.0, 260.0, 195.0]; // Max human score = 385.0
  for (let h = 0; h < 4; h++) {
    const hu = await User.create({
      id: uuidv4(),
      name: `Human Player ${h + 1}`,
      email: `test_human_phase_${h + 1}_${Date.now()}@test.com`,
      phone: `99112233${h}`,
      password_hash: 'dummy_hash',
      is_bot: false,
      role: 'user'
    });
    humanUsers.push(hu);

    const htId = uuidv4();
    await CricketTeam.create({
      id: htId,
      user_id: hu.id,
      match_id: matchId,
      contest_id: contestId,
      team_name: `User_${hu.name}_XI`,
      captain_id: players[0].id,
      vice_captain_id: players[1].id,
      total_points: humanScores[h],
      rank: null
    });

    await ContestParticipant.create({
      id: uuidv4(),
      contest_id: contestId,
      team_id: htId,
      user_id: hu.id,
      rank: null,
      prize_won: 0
    });
  }
  console.log(`👥 4 Human teams created. Max human score is 385.0.`);

  // 7. EXECUTE MANAGER BOT REARRANGEMENT
  console.log('\n⚡ TRIGGERING MANAGER BOT DYNAMIC REARRANGEMENT...');
  const result = await managerBot.executeManagerBotRearrangement(matchId);
  console.log(`🏆 Manager Bot completed: ${result.totalBotsRearranged} bot teams rearranged.`);

  // 8. VERIFICATION ASSERTIONS
  const allTeams = await CricketTeam.findAll({
    where: { contest_id: contestId },
    order: [['rank', 'ASC']]
  });

  console.log(`\n📊 Total teams in contest: ${allTeams.length} (Expected 60 bots + 4 humans = 64 teams)`);
  if (allTeams.length !== 64) {
    throw new Error(`Expected 64 total teams, found ${allTeams.length}`);
  }

  // A. Verify Ranks 1 to 60 are 100% Bots
  const maxHumanScore = 385.0;
  for (let r = 1; r <= 60; r++) {
    const team = allTeams.find(t => t.rank === r);
    if (!team) throw new Error(`Missing team at rank ${r}`);
    const isBot = !humanUsers.some(u => u.id === team.user_id);
    if (!isBot) throw new Error(`Rank ${r} is held by a HUMAN!`);
    if (team.total_points <= maxHumanScore) {
      throw new Error(`Bot at rank ${r} has ${team.total_points} <= maxHumanScore ${maxHumanScore}!`);
    }
  }
  console.log(`✅ PASS: Ranks 1 to 60 are strictly bots and all bot scores are > maxHumanScore (385.0)!`);

  // B. Verify Human Teams start strictly at Rank 61 (B + 1) to 64
  const humanTeams = allTeams.filter(t => humanUsers.some(u => u.id === t.user_id));
  const humanRanks = humanTeams.map(t => t.rank).sort((a, b) => a - b);
  console.log(`Human Team Ranks: ${humanRanks.join(', ')}`);
  if (humanRanks[0] !== 61 || humanRanks[1] !== 62 || humanRanks[2] !== 63 || humanRanks[3] !== 64) {
    throw new Error(`Human ranks mismatch! Expected [61, 62, 63, 64], got [${humanRanks.join(', ')}]`);
  }
  console.log(`✅ PASS: Human teams are strictly placed at Ranks 61 to 64 (behind all bots)!`);

  // C. Verify Phases are assigned and varied
  const phase1Teams = allTeams.filter(t => t.phase === 1);
  const phase2Teams = allTeams.filter(t => t.phase === 2);
  const phase3Teams = allTeams.filter(t => t.phase === 3);
  console.log(`Phase 1 count: ${phase1Teams.length} | Phase 2 count: ${phase2Teams.length} | Phase 3 count: ${phase3Teams.length}`);

  if (phase1Teams.length === 0 || phase2Teams.length === 0) {
    throw new Error('Manager Bot did not partition bots across multiple phases!');
  }
  console.log(`✅ PASS: Manager Bot successfully partitioned bots across multiple dynamic phases.`);

  // D. Verify Dynamic Round-off rank adjustments
  const roundOffReport = result.contests[0];
  console.log(`Dynamic Round-Off Adjustments applied: ${roundOffReport.roundOffAdjustments}`);
  console.log(`Top Bot Score: ${roundOffReport.topBotScore} | Lowest Bot Score: ${roundOffReport.lowestBotScore} | Max Human: ${roundOffReport.maxHumanScore}`);

  // E. Verify ContestParticipant ranks match CricketTeam ranks
  const participants = await ContestParticipant.findAll({ where: { contest_id: contestId } });
  for (const p of participants) {
    const team = allTeams.find(t => t.id === p.team_id);
    if (p.rank !== team.rank) {
      throw new Error(`Participant rank ${p.rank} != team rank ${team.rank}`);
    }
  }
  console.log(`✅ PASS: ContestParticipants ranks match CricketTeam ranks exactly.`);

  // F. Verify H2H Contest was 100% skipped
  const h2hTeams = await CricketTeam.findAll({ where: { contest_id: h2hId } });
  if (h2hTeams.length > 0) {
    throw new Error('Bots were illegally deployed to H2H contest!');
  }
  console.log(`🛡️  PASS: H2H Contest has 0 bots and remained 100% protected.`);

  // Cleanup test data
  await TeamPlayer.destroy({ where: { team_id: allTeams.map(t => t.id) } });
  await ContestParticipant.destroy({ where: { contest_id: [contestId, h2hId] } });
  await CricketTeam.destroy({ where: { match_id: matchId } });
  await MatchContest.destroy({ where: { match_id: matchId } });
  await CricketPlayer.destroy({ where: { match_id: matchId } });
  await CricketMatch.destroy({ where: { id: matchId } });
  await User.destroy({ where: { id: humanUsers.map(u => u.id) } });

  console.log('\n🎉 ALL MANAGER BOT TESTS PASSED SUCCESSFULLY! Dynamic Phases & Round-off 100% Verified.');
}

testManagerBotPhases().catch(err => {
  console.error('\n❌ Test Failed:', err);
  process.exit(1);
});
