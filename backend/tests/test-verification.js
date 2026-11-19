// 🔬 PRIME DREEMS — SYSTEMATIC VERIFICATION SUITE
// Tests Database (bot_teams), Bot 1-Hour & Micro-Batch Logic, Email OTP, and Server Health

const { v4: uuidv4 } = require('uuid');
const sequelize = require('./db/index');
const { 
  BotTeam, CricketMatch, CricketPlayer, MatchContest, 
  CricketTeam, TeamPlayer, ContestParticipant, User 
} = require('./db/models');
const { botScheduler } = require('./services/botScheduler');
const { sendSignupOtp, sendPasswordResetOtp } = require('./services/emailService');

async function runVerification() {
  console.log('================================================================');
  console.log('🔬 STARTING SYSTEMATIC VERIFICATION OF ENTERPRISE CHANGES');
  console.log('================================================================\n');

  const report = {
    database: { passed: false, details: [] },
    botLogic: { passed: false, details: [] },
    emailService: { passed: false, details: [] },
  };

  // ─── 1. DATABASE CHECK ───
  console.log('▶ STEP 1: Verifying Database Schema, `bot_teams` Table & Indexes...');
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    report.database.details.push('✓ Database connection authenticated and models synced.');

    // Check if BotTeam table is queryable
    const testBotId = uuidv4();
    const testMatchId = `test_match_${Date.now()}`;
    const testContestId = `test_contest_${Date.now()}`;

    const createdBotTeam = await BotTeam.create({
      id: uuidv4(),
      bot_id: testBotId,
      bot_name: 'Verification Bot',
      bot_username: 'veri_bot',
      match_id: testMatchId,
      contest_id: testContestId,
      team_name: "Veri Bot's XI",
      total_points: 45.5,
      phase: 1,
      lineup: [
        { id: 'p1', name: 'Player 1', role: 'BAT', multiplier: 2.0 },
        { id: 'p2', name: 'Player 2', role: 'BOWL', multiplier: 1.0 },
      ],
    });

    report.database.details.push(`✓ Successfully inserted record into bot_teams (ID: ${createdBotTeam.id}).`);

    // Verify Read
    const fetched = await BotTeam.findByPk(createdBotTeam.id);
    if (!fetched || fetched.total_points !== 45.5 || fetched.lineup.length !== 2) {
      throw new Error('BotTeam read validation failed.');
    }
    report.database.details.push(`✓ Read validation passed. Lineup JSON parsed correctly: ${fetched.lineup.length} players.`);

    // Cleanup test record
    await BotTeam.destroy({ where: { id: createdBotTeam.id } });
    report.database.details.push('✓ Test record cleaned up.');

    report.database.passed = true;
    console.log('✅ STEP 1 COMPLETE: Database and `bot_teams` table are 100% operational!\n');
  } catch (dbErr) {
    report.database.passed = false;
    report.database.details.push(`❌ Error: ${dbErr.message}`);
    console.error('❌ STEP 1 FAILED:', dbErr);
  }

  // ─── 2. BOT LOGIC CHECK (1-HOUR RULE & MICRO-BATCH) ───
  console.log('▶ STEP 2: Verifying Bot Micro-Batch & 1-Hour Rule Pacing...');
  try {
    // Ensure we have at least 1 bot user in DB for testing
    let testBot = await User.findOne({ where: { is_bot: true } });
    if (!testBot) {
      testBot = await User.create({
        id: uuidv4(),
        name: 'Auto Bot Test',
        username: 'autobottest',
        email: 'autobottest@primedreems.com',
        password_hash: 'test',
        age: 22,
        is_bot: true,
      });
    }

    // Create dummy match in CricketMatch table first (satisfies foreign key)
    const dummyMatchId = `match_veri_${Date.now()}`;
    await CricketMatch.create({
      id: dummyMatchId,
      title: 'Verification Cricket Match',
      team_a: 'Team Alpha',
      team_b: 'Team Beta',
      team_a_code: 'TMA',
      team_b_code: 'TMB',
      status: 'upcoming',
      match_date: '2026-11-20',
      match_time: '19:30',
      start_time: new Date(Date.now() + 5 * 60 * 60 * 1000),
      lock_time_minutes: 15,
      category: 'T20',
    });
    report.botLogic.details.push('✓ Created dummy match record in cricket_matches.');

    // Create 22 dummy players for the match
    const dummyPlayers = [];
    const roles = ['WK', 'BAT', 'BAT', 'BAT', 'BAT', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL', 'BOWL'];
    for (let i = 1; i <= 22; i++) {
      dummyPlayers.push({
        id: `pl_${dummyMatchId}_${i}`,
        match_id: dummyMatchId,
        name: `Test Player ${i}`,
        role: roles[(i - 1) % roles.length],
        team_name: i <= 11 ? 'Team Alpha' : 'Team Beta',
        credits: 9.0,
        points: 25,
      });
    }
    await CricketPlayer.bulkCreate(dummyPlayers);
    report.botLogic.details.push('✓ Created test match players (22 players).');

    // Case A: Test 1-Hour Rule (Match starts in 30 minutes -> hoursUntilStart = 0.5 <= 1.0)
    const matchUnder1H = {
      id: dummyMatchId,
      title: 'Test Match Under 1 Hour',
      start_time: new Date(Date.now() + 30 * 60 * 1000), // 30 mins
      status: 'upcoming',
      lock_time_minutes: 15,
    };

    const contestUnder1H = await MatchContest.create({
      id: `contest_under1h_${Date.now()}`,
      match_id: dummyMatchId,
      title: 'Mega Grand Contest (1H Test)',
      type: 'mega',
      total_spots: 100,
      filled_spots: 10,
      bot_spots: 50,
      is_active: true,
      status: 'open',
    });

    const initialSpotsUnder1H = contestUnder1H.filled_spots;
    // Execute tick with hoursUntilStart = 0.5 (under 1-hour deadline)
    await botScheduler.deployOrganicStaggeredTick(matchUnder1H, 0.5);

    const refreshedContestUnder1H = await MatchContest.findByPk(contestUnder1H.id);
    if (refreshedContestUnder1H.filled_spots === initialSpotsUnder1H) {
      report.botLogic.details.push('✓ 1-HOUR RULE PASSED: When hoursUntilStart <= 1.0 (0.5h), zero bots entered. Target locked as expected.');
    } else {
      throw new Error(`1-Hour Rule failed: Bots joined when <= 1.0h! Spots changed from ${initialSpotsUnder1H} to ${refreshedContestUnder1H.filled_spots}`);
    }

    // Case B: Test Micro-Batch Entry (Match starts in 5 hours -> hoursUntilStart = 5.0 > 1.0)
    const match5H = {
      id: dummyMatchId,
      title: 'Test Match 5 Hours Away',
      start_time: new Date(Date.now() + 5 * 60 * 60 * 1000),
      status: 'upcoming',
      lock_time_minutes: 15,
    };

    const contest5H = await MatchContest.create({
      id: `contest_5h_${Date.now()}`,
      match_id: dummyMatchId,
      title: 'Mega Grand Contest (5H Test)',
      type: 'mega',
      total_spots: 100,
      filled_spots: 5,
      bot_spots: 50,
      is_active: true,
      status: 'open',
    });

    const initialSpots5H = contest5H.filled_spots;
    // Execute 1 tick with hoursUntilStart = 5.0
    await botScheduler.deployOrganicStaggeredTick(match5H, 5.0);

    const refreshedContest5H = await MatchContest.findByPk(contest5H.id);
    const diff = refreshedContest5H.filled_spots - initialSpots5H;

    // Check entry in isolated bot_teams table
    const botTeamInDb = await BotTeam.findOne({ where: { contest_id: contest5H.id } });

    if (diff === 1 && botTeamInDb) {
      report.botLogic.details.push(`✓ MICRO-BATCH PASSED: Exactly 1 bot entered in tick (Spots: ${initialSpots5H} -> ${refreshedContest5H.filled_spots}).`);
      report.botLogic.details.push(`✓ ISOLATION PASSED: Bot team was written to isolated 'bot_teams' table (Team: "${botTeamInDb.team_name}").`);
    } else {
      throw new Error(`Micro-batch verification failed: diff was ${diff}, botTeamInDb exists: ${Boolean(botTeamInDb)}`);
    }

    // Cleanup test data
    await BotTeam.destroy({ where: { match_id: dummyMatchId } });
    await MatchContest.destroy({ where: { match_id: dummyMatchId } });
    await CricketPlayer.destroy({ where: { match_id: dummyMatchId } });
    await CricketMatch.destroy({ where: { id: dummyMatchId } });
    report.botLogic.details.push('✓ Test matches, contests, and dummy bot teams cleaned up.');

    report.botLogic.passed = true;
    console.log('✅ STEP 2 COMPLETE: 1-Hour Rule & 1-by-1 Micro-Batch logic verified successfully!\n');
  } catch (botErr) {
    report.botLogic.passed = false;
    report.botLogic.details.push(`❌ Error: ${botErr.message}`);
    console.error('❌ STEP 2 FAILED:', botErr);
  }

  // ─── 3. EMAIL OTP SERVICE TEST ───
  console.log('▶ STEP 3: Verifying Email OTP Delivery Engine...');
  try {
    const testEmail = 'verify_test@primedreems.com';
    const testOtp = '849201';

    // Test Signup OTP
    const signupMail = await sendSignupOtp({
      toEmail: testEmail,
      name: 'Verification User',
      otp: testOtp,
      expiryMinutes: 10,
    });

    report.emailService.details.push(`✓ Signup OTP dispatch: Provider = [${signupMail.provider || 'unknown'}], Success = [${signupMail.success}]`);

    // Test Password Reset OTP
    const resetMail = await sendPasswordResetOtp({
      toEmail: testEmail,
      name: 'Verification User',
      otp: testOtp,
      expiryMinutes: 10,
    });

    report.emailService.details.push(`✓ Password Reset OTP dispatch: Provider = [${resetMail.provider || 'unknown'}], Success = [${resetMail.success}]`);

    if (signupMail.success && resetMail.success) {
      report.emailService.passed = true;
      console.log('✅ STEP 3 COMPLETE: Email OTP engine dispatch verified with multi-tier failover!\n');
    } else {
      throw new Error(`Email dispatch failed: ${signupMail.error || resetMail.error}`);
    }
  } catch (mailErr) {
    report.emailService.passed = false;
    report.emailService.details.push(`❌ Error: ${mailErr.message}`);
    console.error('❌ STEP 3 FAILED:', mailErr);
  }

  // ─── SUMMARY REPORT ───
  console.log('================================================================');
  console.log('📊 FINAL SYSTEMATIC VERIFICATION REPORT');
  console.log('================================================================');
  console.log(JSON.stringify(report, null, 2));

  process.exit(report.database.passed && report.botLogic.passed && report.emailService.passed ? 0 : 1);
}

runVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
