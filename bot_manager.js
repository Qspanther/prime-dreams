/**
 * ★★★ PRIME DREEMS — CRICKET BOT MANAGER & CENTRAL COMMAND NETWORK ★★★
 * 
 * Autonomous 10,000 Cricket Fantasy Bot Network, 72-Hour Organic Deployment & Fair-Rotation System
 * 
 * Architecture & Features:
 * - 10,000 Autonomous Cricket Bots with realistic Indian identities & ₹1,00,000 INR wallets
 * - New Match Ingestion Watcher: Instantly detects when any new match enters "upcoming" status
 * - 72-Hour Countdown Alert: Arms when match starts > 72h; triggers high-priority alert when <= 72h
 * - Organic Staggered Deployment: Slowly and randomly trickles bot teams across the 72-hour window
 *   to emulate real human user participation (avoids burst bot dumps)
 * - Strict Contest Isolation:
 *   ✅ Mega Grand Contests (Supported)
 *   ✅ Multi-Battlefield Rooms (Auto-clone supported)
 *   ✅ Mini / Rookie / Practice Contests (Supported)
 *   🚫 Head-to-Head (H2H) Contests — STRICTLY EXCLUDED & PROTECTED (Bots NEVER join)
 *   🚫 Private Contests / Invite Codes — STRICTLY EXCLUDED & PROTECTED (Bots NEVER join)
 * - Post-Contest Tactical Rearrangement & Anti-Monopoly Fair Winner Rotation (Tiers 1-6)
 */

const http = require('http');
const https = require('https');

// Configuration
const CONFIG = {
  API_BASE_URL: process.env.PRIME_DREEMS_API_URL || process.env.CREATOR11_API_URL || 'http://localhost:5000',
  BOT_API_KEY: process.env.BOT_API_KEY || 'c11_bot_mgr_sec_9938a7fbc21d49e',
  TOTAL_BOTS: 10000,
  DAEMON_POLL_INTERVAL_MS: 30 * 1000, // 30 seconds
  HOURLY_LOG_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
};

/**
 * Lightweight HTTP client for API communication
 */
function apiRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(`${CONFIG.API_BASE_URL}${endpoint}`);
    const isHttps = fullUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = data ? JSON.stringify(data) : null;

    const options = {
      hostname: fullUrl.hostname,
      port: fullUrl.port || (isHttps ? 443 : 80),
      path: `${fullUrl.pathname}${fullUrl.search || ''}`,
      method: method,
      headers: {
        'x-bot-api-key': CONFIG.BOT_API_KEY,
        'Content-Type': 'application/json',
      }
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(`API Error [${res.statusCode}]: ${json.error || body}`));
          }
        } catch (err) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Network error connecting to Prime Dreems API (${CONFIG.API_BASE_URL}): ${err.message}`));
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

class PrimeDreemsBotManager {
  constructor(apiKey = CONFIG.BOT_API_KEY, baseUrl = CONFIG.API_BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * 1. Get status of Cricket Bot Network and system
   */
  async getStatus() {
    return await apiRequest('/bot-manager/status', 'GET');
  }

  /**
   * 2. Real-time 72-Hour Watcher & Contest Eligibility Status
   */
  async get72hStatus() {
    return await apiRequest('/bot-manager/72h-status', 'GET');
  }

  /**
   * 3. Trigger immediate 72-hour check and organic staggered tick
   */
  async trigger72hCheck() {
    return await apiRequest('/bot-manager/trigger-72h-check', 'POST');
  }

  /**
   * 4. Real-time schedule of upcoming, live, and completed matches
   */
  async getSchedule() {
    return await apiRequest('/bot-manager/schedule', 'GET');
  }

  /**
   * 5. List registered cricket bots (up to 10,000)
   */
  async listBots(limit = 100) {
    return await apiRequest(`/bot-manager/bots?limit=${limit}`, 'GET');
  }

  /**
   * 6. Past winners history to inspect fair rotation
   */
  async getWinnersHistory() {
    return await apiRequest('/bot-manager/winners-history', 'GET');
  }

  /**
   * 7. Pre-Contest Deployment: Bots build cricket teams across eligible contests
   */
  async deployPreContest(matchId, contestId = null, botCount = null) {
    console.log(`🤖 [PrimeDreems BotManager] Deploying bot squads for match: ${matchId}...`);
    return await apiRequest('/bot-manager/deploy-pre-contest', 'POST', {
      matchId,
      contestId,
      botCount
    });
  }

  /**
   * 8. Organic Staggered Join Tick
   */
  async deployStaggered(matchId) {
    return await apiRequest('/bot-manager/deploy-staggered', 'POST', { matchId });
  }

  /**
   * 9. Batch join specific number of bots into a contest
   */
  async batchJoin(matchId, contestId = null, botCount = 10) {
    return await apiRequest('/bot-manager/batch-join', 'POST', {
      matchId,
      contestId,
      botCount
    });
  }

  /**
   * 10. Post-Contest Tactical Rearrangement with Fair Winner Rotation
   */
  async deployAutonomousRearrangement(matchId, contestId = null) {
    console.log(`🤖 [PrimeDreems BotManager] Rearranging bot lineups & applying Fair Rotation for match: ${matchId}...`);
    return await apiRequest('/bot-manager/deploy-autonomous', 'POST', {
      matchId,
      contestId
    });
  }

  /**
   * 11. Seed bots to 10,000
   */
  async seedBots(targetCount = 10000) {
    return await apiRequest('/bot-manager/seed-bots', 'POST', { targetCount });
  }

  /**
   * 12. Check End-Game Status (Balls Remaining & Death Stage Trigger)
   */
  async getEndgameStatus(matchId) {
    return await apiRequest(`/bot-manager/endgame-status/${matchId}`, 'GET');
  }

  /**
   * 13. Dynamic End-Game Tactical Rearrangement (Last 6-10 Balls Stage)
   */
  async rearrangeEndgame(matchId) {
    console.log(`⚡ [PrimeDreems BotManager] Dynamically rearranging bot lineups for death stage: ${matchId}...`);
    return await apiRequest('/bot-manager/rearrange-endgame', 'POST', { matchId });
  }

  /**
   * 14. Manager Bot Phase Breakdown & Distribution Report
   */
  async getPhases(matchId) {
    return await apiRequest(`/bot-manager/phases/${matchId}`, 'GET');
  }

  /**
   * 15. Continuous Autonomous Daemon
   * Continuously monitors upcoming fixtures, checks 72-hour triggers, and manages organic bot deployment.
   */
  async runDaemon() {
    console.log('🏏 [PrimeDreems BotManager Daemon] Started autonomous monitoring service (10,000 Cricket Bots)...');
    console.log(`⏱️   Daemon Poll Interval: ${CONFIG.DAEMON_POLL_INTERVAL_MS / 1000}s`);
    console.log(`📢  72-Hour Alert Trigger Engine: ACTIVE`);
    console.log(`🛡️  Strict Protections: H2H (100% Excluded) | Private Contests (100% Excluded)`);
    console.log('─────────────────────────────────────────────────────────────────');

    let lastHourlyCheck = 0;
    const knownMatches = new Set();
    const alerted72hMatches = new Set();
    const postContestProcessed = new Set();
    const endGameProcessed = new Set();

    const tick = async () => {
      try {
        const now = Date.now();
        const sched = await this.getSchedule();
        const h72 = await this.get72hStatus();

        if (now - lastHourlyCheck >= CONFIG.HOURLY_LOG_INTERVAL_MS || lastHourlyCheck === 0) {
          lastHourlyCheck = now;
          console.log(`\n📅 [CRICKET SCHEDULE & 72-HOUR UPDATE] — ${new Date().toLocaleTimeString()} —`);
          
          if (sched.liveMatches && sched.liveMatches.length > 0) {
            sched.liveMatches.forEach(lm => {
              console.log(`  🔴 LIVE MATCH: "${lm.title}"`);
            });
          } else {
            console.log('  ⚪ No live matches running right now.');
          }

          if (h72.matches && h72.matches.length > 0) {
            console.log(`  ⏳ UPCOMING MATCHES & 72-HOUR TRACKING:`);
            h72.matches.forEach(m => {
              const alertStatus = m.alert72hTriggered ? '🚨 72H ALERT TRIGGERED' : '⏳ STANDBY (> 72H)';
              console.log(`     - "${m.title}" in ${m.hoursUntilStart}h [${alertStatus}] | Contests: ${m.eligibleContests} eligible / ${m.excludedContests} protected`);
            });
          }
        }

        // Check live matches for End-Game (last 6-10 balls) Tactical Rearrangement
        if (sched.liveMatches && sched.liveMatches.length > 0) {
          for (const lm of sched.liveMatches) {
            if (!endGameProcessed.has(lm.id)) {
              try {
                const egStatus = await this.getEndgameStatus(lm.id);
                if (egStatus.isEndGame) {
                  console.log('\n================================================================');
                  console.log(`🚨 [DEATH STAGE TRIGGERED] Match "${lm.title}" has ${egStatus.remainingBalls} balls remaining!`);
                  console.log(`🤖 Rearranging all bot squads to guarantee top ranks across all eligible contests...`);
                  console.log('================================================================\n');
                  const res = await this.rearrangeEndgame(lm.id);
                  console.log(`🏆 [End-Game Complete] Rearranged ${res.totalBotsRearranged} bot teams across ${res.contestsProcessed} contests. Top ranks 100% locked!`);
                  endGameProcessed.add(lm.id);
                }
              } catch (egErr) {
                // Silent catch for background ticks
              }
            }
          }
        }

        // Process upcoming matches
        if (h72.matches) {
          for (const m of h72.matches) {
            // New Match Detection
            if (!knownMatches.has(m.id)) {
              knownMatches.add(m.id);
              console.log(`📢 [New Match Detected] "${m.title}" (ID: ${m.id}) | Starts in: ${m.hoursUntilStart} hours`);
            }

            // 72-Hour Threshold Check
            if (m.within72Hours && !alerted72hMatches.has(m.id)) {
              alerted72hMatches.add(m.id);
              console.log('\n================================================================');
              console.log(`🚨 [72-HOUR BOT ALERT TRIGGERED]`);
              console.log(`🏏 Match: "${m.title}"`);
              console.log(`⏰ Time Left: ${m.hoursUntilStart} hours (<= 72h window)!`);
              console.log(`🤖 10,000 Bots Network Activated for Organic Staggered Deployment!`);
              console.log(`🛡️  Strict Protection: H2H and Private Contests will NOT be touched.`);
              console.log(`⚔️  Active Contests: Mega Grand Contests, Battlefield, Mini & Practice`);
              console.log('================================================================\n');
            }

            // Organic Staggered Join Tick if within 72 hours
            if (m.within72Hours) {
              try {
                await this.deployStaggered(m.id);
              } catch (staggerErr) {
                // Silent catch for background ticks
              }
            }
          }
        }

        // Post-Contest Rearrangement for completed matches
        if (sched.completedMatches) {
          for (const cm of sched.completedMatches) {
            if (!postContestProcessed.has(cm.id)) {
              console.log(`🏁 [AutoTrigger] Match "${cm.title}" completed. Executing Autonomous Rearrangement & Fair Rotation!`);
              try {
                const res = await this.deployAutonomousRearrangement(cm.id);
                console.log(`🏆 [AutoTrigger] Winner: ${res.winnerBot || 'Bot'} | Total Rearranged: ${res.totalRearranged}`);
                postContestProcessed.add(cm.id);
              } catch (reErr) {
                console.error(`⚠️ [AutoTrigger Error] Rearrangement error for "${cm.title}":`, reErr.message);
              }
            }
          }
        }
      } catch (err) {
        console.error(`⚠️ [BotManager Daemon Polling Error]: ${err.message}`);
      }
    };

    await tick();
    setInterval(tick, CONFIG.DAEMON_POLL_INTERVAL_MS);
  }
}

// ─── CLI Execution ───
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';
  const manager = new PrimeDreemsBotManager();

  (async () => {
    try {
      switch (command) {
        case 'status': {
          console.log('📡 Querying Prime Dreems Bot Network Status...');
          const status = await manager.getStatus();
          console.log('\n📊 === PRIME DREEMS BOT NETWORK STATUS ===');
          console.log(JSON.stringify(status, null, 2));
          break;
        }

        case '72h': {
          console.log('⏱️ Querying 72-Hour Watcher & Upcoming Fixtures...');
          const status72 = await manager.get72hStatus();
          console.log('\n🚨 === 72-HOUR WATCHER & CONTEST STATUS ===');
          console.log(JSON.stringify(status72, null, 2));
          break;
        }

        case 'trigger-72h': {
          console.log('⚡ Triggering 72-hour scheduler check...');
          const res = await manager.trigger72hCheck();
          console.log('\n✅ Result:');
          console.log(JSON.stringify(res, null, 2));
          break;
        }

        case 'schedule': {
          console.log('📅 Fetching Cricket Match Schedule...');
          const sched = await manager.getSchedule();
          console.log('\n🗓️ === CRICKET MATCH SCHEDULE ===');
          console.log(JSON.stringify(sched, null, 2));
          break;
        }

        case 'bots': {
          const limit = parseInt(args[1]) || 20;
          console.log(`👥 Fetching first ${limit} registered bots...`);
          const bots = await manager.listBots(limit);
          console.log('\n🤖 === REGISTERED CRICKET BOTS ===');
          console.log(JSON.stringify(bots, null, 2));
          break;
        }

        case 'seed': {
          const target = parseInt(args[1]) || 10000;
          console.log(`🌱 Seeding bot network to ${target} bots...`);
          const res = await manager.seedBots(target);
          console.log('\n✅ Seeding Result:', JSON.stringify(res, null, 2));
          break;
        }

        case 'winners': {
          console.log('🏆 Fetching Past Winners History (Fair Rotation)...');
          const hist = await manager.getWinnersHistory();
          console.log('\n📜 === BOT WINNERS HISTORY ===');
          console.log(JSON.stringify(hist, null, 2));
          break;
        }

        case 'deploy-pre': {
          const matchId = args[1];
          const contestId = args[2] || null;
          const count = args[3] ? parseInt(args[3]) : null;
          if (!matchId) {
            console.error('❌ Usage: node bot_manager.js deploy-pre <matchId> [contestId] [count]');
            process.exit(1);
          }
          const res = await manager.deployPreContest(matchId, contestId, count);
          console.log('\n✅ === PRE-CONTEST DEPLOYMENT RESULT ===');
          console.log(JSON.stringify(res, null, 2));
          break;
        }

        case 'deploy-staggered': {
          const matchId = args[1];
          if (!matchId) {
            console.error('❌ Usage: node bot_manager.js deploy-staggered <matchId>');
            process.exit(1);
          }
          const res = await manager.deployStaggered(matchId);
          console.log('\n✅ === ORGANIC STAGGERED JOIN RESULT ===');
          console.log(JSON.stringify(res, null, 2));
          break;
        }

        case 'deploy-auto': {
          const matchId = args[1];
          const contestId = args[2] || null;
          if (!matchId) {
            console.error('❌ Usage: node bot_manager.js deploy-auto <matchId> [contestId]');
            process.exit(1);
          }
          const res = await manager.deployAutonomousRearrangement(matchId, contestId);
          console.log('\n🏆 === AUTONOMOUS REARRANGEMENT RESULT ===');
          console.log(JSON.stringify(res, null, 2));
          break;
        }

        case 'endgame': {
          const matchId = args[1];
          if (!matchId) {
            console.error('❌ Usage: node bot_manager.js endgame <matchId>');
            process.exit(1);
          }
          console.log(`⚡ Triggering Dynamic End-Game Tactical Rearrangement for match: ${matchId}...`);
          const res = await manager.rearrangeEndgame(matchId);
          console.log('\n🏆 === DYNAMIC END-GAME REARRANGEMENT RESULT ===');
          console.log(JSON.stringify(res, null, 2));
          break;
        }

        case 'endgame-status': {
          const matchId = args[1];
          if (!matchId) {
            console.error('❌ Usage: node bot_manager.js endgame-status <matchId>');
            process.exit(1);
          }
          const res = await manager.getEndgameStatus(matchId);
          console.log('\n🎯 === END-GAME STATUS ===');
          console.log(JSON.stringify(res, null, 2));
          break;
        }

        case 'phases': {
          const matchId = args[1];
          if (!matchId) {
            console.error('❌ Usage: node bot_manager.js phases <matchId>');
            process.exit(1);
          }
          const res = await manager.getPhases(matchId);
          console.log('\n🤖 === MANAGER BOT PHASE DISTRIBUTION ===');
          console.log(JSON.stringify(res, null, 2));
          break;
        }

        case 'daemon': {
          await manager.runDaemon();
          break;
        }

        default:
          console.log(`
🏏 Prime Dreems Bot Manager CLI (10,000 Bots Network)
Available Commands:
  node bot_manager.js status                     - Bot network status & rules
  node bot_manager.js 72h                        - Real-time 72-hour countdowns & contest eligibility
  node bot_manager.js trigger-72h                - Trigger immediate 72h check & organic join tick
  node bot_manager.js schedule                   - Upcoming & live match schedule
  node bot_manager.js bots [limit]               - List registered bots & balances
  node bot_manager.js seed [10000]               - Seed bot network up to 10,000
  node bot_manager.js winners                    - View winners history
  node bot_manager.js deploy-pre <matchId>       - Build pre-contest bot teams (skips H2H/Private)
  node bot_manager.js deploy-staggered <matchId> - Execute 1 organic staggered join tick
  node bot_manager.js deploy-auto <matchId>      - Rearrange bots after match ends
  node bot_manager.js endgame <matchId>          - Dynamic 6-10 balls death stage rearrangement
  node bot_manager.js endgame-status <matchId>   - Check balls remaining and death stage trigger
  node bot_manager.js phases <matchId>           - View Manager Bot phase allocations & ranks
  node bot_manager.js daemon                     - Run continuous 72-hour monitoring daemon
          `);
      }
    } catch (err) {
      console.error(`\n❌ Error executing "${command}":`, err.message);
      process.exit(1);
    }
  })();
}

module.exports = { PrimeDreemsBotManager, CONFIG };
