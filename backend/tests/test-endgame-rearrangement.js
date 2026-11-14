const { v4: uuidv4 } = require('uuid');
const {
  User,
  CricketMatch,
  CricketPlayer,
  MatchContest,
  CricketTeam,
  TeamPlayer,
  ContestParticipant,
} = require('../db/models');
const {
  rearrangeBotsForEndGame,
  checkIsEndGame,
  getBallsRemaining,
  isContestEligibleForBots
} = require('../services/botScheduler');
const { deployPreContestCricketBots } = require('../routes/bot-manager');

async function runTest() {
  console.log('🧪 Starting End-Game Dynamic Bot Rearrangement Test...\n');

  // 1. Create a test live match
  const matchId = uuidv4();
  const testMatch = await CricketMatch.create({
    id: matchId,
    title: 'Test Live Match: Ind vs Aus — Super 8',
    category: 'T20',
    team_a: 'India',
    team_a_code: 'IND',
    team_b: 'Australia',
    team_b_code: 'AUS',
    venue: 'Melbourne Cricket Ground',
    match_date: 'Today',
    match_time: 'Live',
    start_time: new Date(Date.now() - 3600000), // started 1 hour ago
    status: 'live',
    score_summary: {
      team_a: { runs: 185, wickets: 6, overs: 20.0 },
      team_b: { runs: 178, wickets: 7, overs: 18.4 }, // 18.4 overs = 112 balls bowled -> 8 balls remaining!
      current_innings: 'team_b'
    },
    live_data: {
      status_text: 'Australia need 8 runs in 8 balls'
    }
  });

  console.log(`✅ Test Match created: "${testMatch.title}" (ID: ${matchId})`);

  // 2. Check balls remaining and death stage detection
  const remaining = getBallsRemaining(testMatch);
  const endGameState = checkIsEndGame(testMatch);
  console.log(`🎯 Balls Remaining Detected: ${remaining} balls`);
  console.log(`🚨 End-Game Trigger State: ${endGameState.isEndGame ? 'YES (DEATH STAGE)' : 'NO'} | Reason: ${endGameState.reason}`);

  if (remaining !== 8 || !endGameState.isEndGame) {
    throw new Error(`Expected 8 balls remaining and isEndGame=true, got ${remaining}, ${endGameState.isEndGame}`);
  }

  // 3. Create 22 players with varying fantasy points (some stars, some low performers)
  const players = [];
  const roles = ['WK', 'BAT', 'AR', 'BOWL'];
  for (let i = 1; i <= 22; i++) {
    const isTeamA = i <= 11;
    const role = roles[(i - 1) % 4];
    // Stars get high points (e.g. 120, 95, 80), low performers get low points (e.g. 4, 10)
    let points = 10;
    if (i === 1) points = 145; // Centurion BAT
    else if (i === 2) points = 110; // 4-wicket BOWL
    else if (i === 3) points = 85;  // 50 runs + 1 wkt AR
    else if (i === 4) points = 72;
    else if (i === 5) points = 65;
    else points = Math.floor(Math.random() * 25) + 2;

    players.push({
      id: uuidv4(),
      match_id: matchId,
      name: `Player ${isTeamA ? 'IND' : 'AUS'} ${i}`,
      team_name: isTeamA ? 'India' : 'Australia',
      role: role,
      credits: 9.0,
      points: points
    });
  }
  await CricketPlayer.bulkCreate(players);
  console.log(`✅ 22 Players created with live fantasy points.`);

  // 4. Create an eligible public contest (Battlefield 25 spots)
  const eligibleContestId = uuidv4();
  const eligibleContest = await MatchContest.create({
    id: eligibleContestId,
    match_id: matchId,
    title: 'Super Battlefield 25 Spots',
    type: 'multi_battlefield',
    total_spots: 25,
    filled_spots: 0,
    entry_fee: 50,
    prize_pool: 1000,
    is_active: true,
    is_private: false,
    status: 'open'
  });

  // 5. Create a protected H2H contest and a protected Private contest
  const h2hContestId = uuidv4();
  const h2hContest = await MatchContest.create({
    id: h2hContestId,
    match_id: matchId,
    title: 'Head-to-Head 1v1 Battle',
    type: 'h2h',
    total_spots: 2,
    filled_spots: 0,
    entry_fee: 100,
    prize_pool: 180,
    is_active: true,
    is_private: false,
    status: 'open'
  });

  const privateContestId = uuidv4();
  const privateContest = await MatchContest.create({
    id: privateContestId,
    match_id: matchId,
    title: 'My Friends Private Room',
    type: 'private',
    total_spots: 10,
    filled_spots: 0,
    entry_fee: 200,
    prize_pool: 1800,
    is_active: true,
    is_private: true,
    invite_code: 'PRIV123',
    status: 'open'
  });

  console.log(`✅ Contests created: 1 Eligible Battlefield, 1 Protected H2H, 1 Protected Private.`);

  // 6. Deploy 7 bots into eligible contest
  const deployResult = await deployPreContestCricketBots(matchId, eligibleContestId, 7);
  console.log(`🤖 Bots deployed: ${deployResult.registered} bot teams into Battlefield.`);

  // 7. Create 3 Human users and human teams with realistic high scores
  const humanUsers = [];
  const humanTeams = [];
  const humanScores = [285.5, 340.0, 210.0]; // Highest human score is 340.0

  for (let h = 0; h < 3; h++) {
    const hu = await User.create({
      id: uuidv4(),
      name: `Human User ${h + 1}`,
      email: `human_test_${h + 1}_${Date.now()}@test.com`,
      phone: `987654321${h}`,
      password_hash: 'dummy_hash_for_test',
      is_bot: false,
      role: 'user'
    });
    humanUsers.push(hu);

    const htId = uuidv4();
    const ht = await CricketTeam.create({
      id: htId,
      user_id: hu.id,
      match_id: matchId,
      contest_id: eligibleContestId,
      team_name: `Human_${hu.name}_XI`,
      captain_id: players[0].id,
      vice_captain_id: players[1].id,
      total_points: humanScores[h],
      rank: null
    });
    humanTeams.push(ht);

    await ContestParticipant.create({
      id: uuidv4(),
      contest_id: eligibleContestId,
      team_id: htId,
      user_id: hu.id,
      rank: null,
      prize_won: 0
    });
  }

  console.log(`👥 3 Human teams created. Max human score is 340.0.`);

  // Verify H2H and Private contest protection
  if (isContestEligibleForBots(h2hContest)) throw new Error('H2H contest was NOT marked protected!');
  if (isContestEligibleForBots(privateContest)) throw new Error('Private contest was NOT marked protected!');
  console.log(`🛡️  Verified: H2H and Private contests are 100% protected and excluded.`);

  // 8. TRIGGER END-GAME REARRANGEMENT
  console.log('\n⚡ EXECUTING rearrangeBotsForEndGame(matchId)...');
  const rearrangeResult = await rearrangeBotsForEndGame(matchId);
  console.log('✅ Rearrangement Output:', JSON.stringify(rearrangeResult, null, 2));

  // 9. VERIFICATION ASSERTIONS
  console.log('\n🔍 Verifying rankings and score guarantees:');

  const allTeamsAfter = await CricketTeam.findAll({
    where: { contest_id: eligibleContestId },
    order: [['rank', 'ASC']]
  });

  const allParticipantsAfter = await ContestParticipant.findAll({
    where: { contest_id: eligibleContestId },
    order: [['rank', 'ASC']]
  });

  console.log(`\n🏆 LEADERBOARD SNAPSHOT (Total ${allTeamsAfter.length} teams):`);
  for (const t of allTeamsAfter) {
    const isBot = !humanUsers.some(u => u.id === t.user_id);
    console.log(`  Rank ${t.rank}: ${t.team_name} | Points: ${t.total_points} | UserType: ${isBot ? '🤖 BOT' : '👤 HUMAN'}`);
  }

  // Assertions:
  // 1. Ranks 1 to 7 MUST be bots
  for (let r = 1; r <= 7; r++) {
    const teamAtRank = allTeamsAfter.find(t => t.rank === r);
    if (!teamAtRank) throw new Error(`Missing team at rank ${r}`);
    const isBot = !humanUsers.some(u => u.id === teamAtRank.user_id);
    if (!isBot) throw new Error(`Rank ${r} is held by a HUMAN! Expected bot at rank ${r}.`);
    if (teamAtRank.total_points <= 340.0) {
      throw new Error(`Bot at rank ${r} has points ${teamAtRank.total_points} <= max human score 340.0!`);
    }
  }
  console.log('✅ PASS: Ranks 1 to 7 are strictly bots, and all bot scores exceed max human score (340.0)!');

  // 2. Human teams MUST start at Rank 8 (B + 1)
  const humanTeamRanks = allTeamsAfter.filter(t => humanUsers.some(u => u.id === t.user_id)).map(t => t.rank).sort((a, b) => a - b);
  console.log(`Human Team Ranks: ${humanTeamRanks.join(', ')}`);
  if (humanTeamRanks[0] !== 8 || humanTeamRanks[1] !== 9 || humanTeamRanks[2] !== 10) {
    throw new Error(`Human team ranks are incorrect! Expected [8, 9, 10], got [${humanTeamRanks.join(', ')}]`);
  }
  console.log('✅ PASS: Human teams start strictly at Rank 8, 9, 10 (behind all bots)!');

  // 3. Verify ContestParticipants table has matching ranks
  for (const p of allParticipantsAfter) {
    const team = allTeamsAfter.find(t => t.id === p.team_id);
    if (p.rank !== team.rank) {
      throw new Error(`Participant rank mismatch: participant rank ${p.rank} vs team rank ${team.rank}`);
    }
  }
  console.log('✅ PASS: ContestParticipants ranks match CricketTeam ranks exactly.');

  // 4. Verify Captain & Vice-Captain for top bot
  const topBotTeam = allTeamsAfter.find(t => t.rank === 1);
  const botTeamPlayers = await TeamPlayer.findAll({ where: { team_id: topBotTeam.id } });
  if (botTeamPlayers.length !== 11) {
    throw new Error(`Top bot team has ${botTeamPlayers.length} players, expected 11.`);
  }
  const captain = botTeamPlayers.find(p => p.is_captain);
  const viceCaptain = botTeamPlayers.find(p => p.is_vice_captain);
  if (!captain || !viceCaptain) {
    throw new Error('Top bot team is missing Captain or Vice-Captain!');
  }
  console.log(`✅ PASS: Top bot team has exactly 11 players with Captain (${captain.player_id}) and Vice-Captain (${viceCaptain.player_id}).`);

  // Cleanup test data
  await TeamPlayer.destroy({ where: { team_id: allTeamsAfter.map(t => t.id) } });
  await ContestParticipant.destroy({ where: { contest_id: [eligibleContestId, h2hContestId, privateContestId] } });
  await CricketTeam.destroy({ where: { match_id: matchId } });
  await MatchContest.destroy({ where: { match_id: matchId } });
  await CricketPlayer.destroy({ where: { match_id: matchId } });
  await CricketMatch.destroy({ where: { id: matchId } });
  await User.destroy({ where: { id: humanUsers.map(u => u.id) } });

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Dynamic End-Game Rearrangement is 100% verified.');
}

runTest().catch(err => {
  console.error('\n❌ Test Failed:', err);
  process.exit(1);
});
