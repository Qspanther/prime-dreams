// ★★★ PRIME DREEMS — AUTONOMOUS MANAGER BOT & DYNAMIC PHASE COORDINATOR ★★★
// Orchestrates Dynamic Bot Phases (Phase 1, Phase 2, ...), Fair History-Weighted Rotation,
// Round-Off Rank Calculations (+/-1 or +/-2), Lineup Swaps, and Guaranteed User Isolation.

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const sequelize = require('../db/index');
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
const config = require('../config');

function getBotSchedulerHelpers() {
  const scheduler = require('./botScheduler');
  return {
    buildValidCricketLineup: scheduler.buildValidCricketLineup,
    isContestEligibleForBots: scheduler.isContestEligibleForBots
  };
}

class ManagerBot {
  constructor() {
    this.name = 'PrimeDreems_ManagerBot';
    this.version = '3.0';
  }

  /**
   * Determine batch size and total phases based on contest bot population.
   * e.g. 500 bots -> Batch size 50 (10 phases: Phase 1: 1-50, Phase 2: 51-100...)
   * e.g. 100 bots -> Batch size 25 (4 phases: Phase 1: 1-25, Phase 2: 26-50...)
   * e.g. 25-spot room (7 bots) -> Batch size 3 (Phase 1: 1-3, Phase 2: 4-7)
   */
  getPhaseConfig(totalBots) {
    let batchSize = 50;
    if (totalBots >= 200) {
      batchSize = 50;
    } else if (totalBots >= 50) {
      batchSize = 25;
    } else if (totalBots >= 20) {
      batchSize = 10;
    } else if (totalBots >= 8) {
      batchSize = 4;
    } else {
      batchSize = Math.max(2, Math.ceil(totalBots / 2));
    }

    const totalPhases = Math.ceil(totalBots / batchSize);
    return { batchSize, totalPhases };
  }

  /**
   * Decide Batches and Phases for participating bots using fair history rotation.
   * "har bot ko kabhi na kabhi har ek phase m jana padega or ye batches bhi random hone chahiye"
   */
  async decideBatchesAndPhases(botTeams, contest) {
    const totalBots = botTeams.length;
    if (totalBots === 0) return [];

    const { batchSize, totalPhases } = this.getPhaseConfig(totalBots);
    const botUserIds = [...new Set(botTeams.map(t => t.user_id))];

    // Fetch past phase history for these bots to prevent monopolies and ensure fair rotation
    const pastHistories = await BotWinHistory.findAll({
      where: { bot_user_id: { [Op.in]: botUserIds } },
      attributes: ['bot_user_id', 'rank', 'phase', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: 1000
    });

    const botStats = new Map();
    for (const id of botUserIds) {
      botStats.set(id, { phase1Count: 0, lastPhase: null, totalAppearances: 0 });
    }

    for (const h of pastHistories) {
      const s = botStats.get(h.bot_user_id);
      if (s) {
        s.totalAppearances++;
        if (h.phase === 1 || (h.rank && h.rank <= 50)) {
          s.phase1Count++;
        }
        if (s.lastPhase === null) {
          s.lastPhase = h.phase || (h.rank <= 50 ? 1 : 2);
        }
      }
    }

    // Score bots for Phase 1 priority:
    // 1. Bots with fewer Phase 1 appearances get higher priority.
    // 2. Bots that were in Phase 1 in their last match get penalized to rotate out.
    // 3. Significant random noise is added so batches are dynamic and fresh every match.
    const scoredBots = botTeams.map(team => {
      const stats = botStats.get(team.user_id) || { phase1Count: 0, lastPhase: null };
      const basePriority = 100 - (stats.phase1Count * 25);
      const lastPhasePenalty = stats.lastPhase === 1 ? 40 : 0;
      const randomJitter = Math.random() * 65; // High random factor for dynamic batches
      const priorityScore = basePriority - lastPhasePenalty + randomJitter;

      return {
        team,
        botId: team.user_id,
        teamId: team.id,
        teamName: team.team_name,
        priorityScore,
        stats
      };
    });

    // Sort by priorityScore descending
    scoredBots.sort((a, b) => b.priorityScore - a.priorityScore);

    // Assign phases and initial target ranks
    const assignedBots = [];
    for (let i = 0; i < scoredBots.length; i++) {
      const targetRank = i + 1;
      const phaseNumber = Math.min(totalPhases, Math.floor(i / batchSize) + 1);
      const phaseStartRank = (phaseNumber - 1) * batchSize + 1;
      const phaseEndRank = Math.min(totalBots, phaseNumber * batchSize);

      assignedBots.push({
        ...scoredBots[i],
        phase: phaseNumber,
        phaseName: `Phase ${phaseNumber} (Ranks ${phaseStartRank}-${phaseEndRank})`,
        baseTargetRank: targetRank,
        finalTargetRank: targetRank,
        roundOffShift: 0
      });
    }

    return assignedBots;
  }

  /**
   * Apply Round-Off Jitter to Target Ranks (+/-1 or +/-2 shift).
   * "agar koi kisi bot ki calculation fix nhi ban rhi ho toh wo round off m bhi jaa sakta h
   *  jaise 5 position lane wale ko 6 pr jaa sakta h condition ke hisab se or 4 pe bhi jaa sakta h"
   */
  applyRoundOffJitter(assignedBots, totalBots) {
    if (assignedBots.length <= 1) return assignedBots;

    // Apply natural round-off perturbations (+/- 1 or +/- 2)
    // to simulate real-world dynamic cricket point variations
    for (let i = 0; i < assignedBots.length; i++) {
      const item = assignedBots[i];
      // ~40% chance of a round-off adjustment
      if (Math.random() < 0.40) {
        // Can be -1, +1, or rarely +/-2
        const possibleShifts = [-1, 1, -2, 2];
        const shift = possibleShifts[Math.floor(Math.random() * possibleShifts.length)];
        let candidate = item.baseTargetRank + shift;

        // Clamp strictly between 1 and totalBots (never drop below bots pool!)
        if (candidate >= 1 && candidate <= totalBots) {
          item.roundOffShift = shift;
          item.finalTargetRank = candidate;
        }
      }
    }

    // Resolve any rank collisions cleanly by sorting by (finalTargetRank, priorityScore)
    // and re-indexing 1..totalBots so each bot has a unique, continuous, gapless rank.
    assignedBots.sort((a, b) => {
      if (a.finalTargetRank !== b.finalTargetRank) {
        return a.finalTargetRank - b.finalTargetRank;
      }
      return b.priorityScore - a.priorityScore;
    });

    // Re-assign exact unique rank 1..totalBots
    for (let r = 0; r < assignedBots.length; r++) {
      const newRank = r + 1;
      assignedBots[r].roundOffShift = newRank - assignedBots[r].baseTargetRank;
      assignedBots[r].finalRank = newRank;
    }

    return assignedBots;
  }

  /**
   * Calculate tactical squad lineup, captain & vice-captain for a bot to hit its assigned Phase.
   * "match ke last m apni team rearrange karni h ye calculation karni h kon se player ko replace karu
   *  or kise captain banau or kise vc banau jis se mujhe mere batch m position mil jaye"
   */
  calculateBotLineupForPhase(botAssignment, matchPlayers, topBotScore, step, maxHumanScore, totalBots) {
    const { buildValidCricketLineup } = getBotSchedulerHelpers();
    const { finalRank, phase } = botAssignment;
    const sortedPlayers = [...matchPlayers].sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0));

    // Calculate score: strictly descending per finalRank so bots hold Ranks 1 to totalBots.
    // Guaranteed: lowestBotScore = topBotScore - (totalBots - 1) * step > maxHumanScore
    const botScore = Math.round((topBotScore - ((finalRank - 1) * step)) * 10) / 10;

    let lineup;
    let captain;
    let viceCaptain;

    if (phase === 1) {
      // Phase 1 (Top Elite Tier): Absolute best match heroes
      lineup = buildValidCricketLineup(matchPlayers, { rankByScore: true, invertScore: false });
      // C is top fantasy earner (Centurion / Multi-wicket bowler)
      captain = sortedPlayers[0];
      // VC is second top fantasy earner
      viceCaptain = sortedPlayers[1] || sortedPlayers[0];

      // Small organic rotation between top 3 for Phase 1 bots to avoid identical teams
      if (finalRank % 3 === 0 && sortedPlayers.length >= 3) {
        captain = sortedPlayers[1];
        viceCaptain = sortedPlayers[0];
      } else if (finalRank % 5 === 0 && sortedPlayers.length >= 3) {
        captain = sortedPlayers[0];
        viceCaptain = sortedPlayers[2];
      }
    } else if (phase === 2) {
      // Phase 2 (High Performers): High scoring mix
      lineup = buildValidCricketLineup(matchPlayers, { rankByScore: true, invertScore: false });
      captain = sortedPlayers[Math.min(finalRank % 3 + 1, sortedPlayers.length - 1)];
      viceCaptain = sortedPlayers[Math.min(finalRank % 4, sortedPlayers.length - 1)];
    } else {
      // Phase 3+ (Mid & Supporting Tiers): Varied combinations
      lineup = buildValidCricketLineup(matchPlayers, { rankByScore: true, invertScore: false });
      captain = sortedPlayers[Math.min(finalRank % 5, sortedPlayers.length - 1)];
      viceCaptain = sortedPlayers[Math.min(finalRank % 6 + 1, sortedPlayers.length - 1)];
    }

    if (!captain) captain = lineup.captain;
    if (!viceCaptain) viceCaptain = lineup.viceCaptain;

    // Distribute points among players proportionally to targetScore
    const newTeamPlayers = [];
    const totalLineupRaw = lineup.players.reduce((sum, p) => sum + (Number(p.points) || 1), 0) || 1;

    lineup.players.forEach(p => {
      const isCap = p.id === captain.id;
      const isVc = p.id === viceCaptain.id;
      const rawPt = Number(p.points) || 1;
      const playerShare = Math.round(((rawPt / totalLineupRaw) * botScore / (isCap ? 2.0 : isVc ? 1.5 : 1.0)) * 10) / 10;

      newTeamPlayers.push({
        id: uuidv4(),
        team_id: botAssignment.teamId,
        player_id: p.id,
        is_captain: isCap,
        is_vice_captain: isVc,
        points_earned: Math.max(0.5, playerShare)
      });
    });

    return {
      captainId: captain.id,
      viceCaptainId: viceCaptain.id,
      totalPoints: botScore,
      rank: finalRank,
      phase: phase,
      teamPlayers: newTeamPlayers
    };
  }

  /**
   * Main Rearrangement Orchestration by Manager Bot across all eligible contests of a match.
   */
  async executeManagerBotRearrangement(matchId) {
    const { buildValidCricketLineup, isContestEligibleForBots } = getBotSchedulerHelpers();
    const match = await CricketMatch.findByPk(matchId);
    if (!match) throw new Error(`Cricket match not found: ${matchId}`);

    const matchPlayers = await CricketPlayer.findAll({ where: { match_id: matchId } });
    if (matchPlayers.length < 22) {
      throw new Error(`Match squad too small: found ${matchPlayers.length} players, expected at least 22.`);
    }

    // Fetch all active contests for this match
    const allContests = await MatchContest.findAll({
      where: { match_id: matchId, is_active: true }
    });

    // 100% Strict Exclusion: Skip Private & Head-to-Head (H2H) contests
    const eligibleContests = allContests.filter(c => isContestEligibleForBots(c));

    console.log(`\n🤖 [Manager Bot] Coordinating ${eligibleContests.length} eligible contests for "${match.title}"`);

    const contestReports = [];
    let totalBotsRearranged = 0;

    for (const contest of eligibleContests) {
      const contestTeams = await CricketTeam.findAll({
        where: { contest_id: contest.id }
      });

      if (contestTeams.length === 0) continue;

      // Identify bot teams vs human teams
      const allUserIds = [...new Set(contestTeams.map(t => t.user_id))];
      const botUsers = await User.findAll({
        where: { id: { [Op.in]: allUserIds }, is_bot: true },
        attributes: ['id']
      });
      const botIdSet = new Set(botUsers.map(u => u.id));

      const botTeams = contestTeams.filter(t => botIdSet.has(t.user_id));
      const humanTeams = contestTeams.filter(t => !botIdSet.has(t.user_id));

      if (botTeams.length === 0) continue;

      const B = botTeams.length;

      // Find highest human score in this contest
      let maxHumanScore = 0;
      for (const ht of humanTeams) {
        const s = Number(ht.total_points) || 0;
        if (s > maxHumanScore) maxHumanScore = s;
      }

      // 1. Manager Bot decides Batches & Phases
      const assignedBots = await this.decideBatchesAndPhases(botTeams, contest);

      // 2. Apply Dynamic Round-Off Jitter (+/-1 or +/-2 rank shifts)
      const finalizedBots = this.applyRoundOffJitter(assignedBots, B);

      // 3. Compute optimal base score target:
      // Even the lowest bot (Rank B) is strictly > maxHumanScore
      const step = 0.5;
      const optimalLineup = buildValidCricketLineup(matchPlayers, { rankByScore: true, invertScore: false });
      let optimalPoints = 0;
      optimalLineup.players.forEach(p => {
        let earned = Number(p.points) || 0;
        if (p.id === optimalLineup.captain.id) earned *= (config.CAPTAIN_MULTIPLIER || 2.0);
        else if (p.id === optimalLineup.viceCaptain.id) earned *= (config.VICE_CAPTAIN_MULTIPLIER || 1.5);
        optimalPoints += earned;
      });

      const topBotScore = Math.max(optimalPoints, maxHumanScore + (B * step) + 12);

      // 4. Calculate squad replacements for each bot
      const teamUpdates = [];
      const teamPlayerDeletions = finalizedBots.map(b => b.teamId);
      const allNewTeamPlayers = [];
      const participantUpdates = [];
      const historyRecords = [];

      for (const b of finalizedBots) {
        const lineupCalc = this.calculateBotLineupForPhase(b, matchPlayers, topBotScore, step, maxHumanScore, B);

        teamUpdates.push({
          id: b.teamId,
          captain_id: lineupCalc.captainId,
          vice_captain_id: lineupCalc.viceCaptainId,
          total_points: lineupCalc.totalPoints,
          rank: lineupCalc.rank,
          phase: lineupCalc.phase
        });

        allNewTeamPlayers.push(...lineupCalc.teamPlayers);

        participantUpdates.push({
          team_id: b.teamId,
          contest_id: contest.id,
          rank: lineupCalc.rank
        });

        historyRecords.push({
          id: uuidv4(),
          bot_user_id: b.botId,
          tournament_id: matchId,
          rank: lineupCalc.rank,
          phase: lineupCalc.phase,
          points: lineupCalc.totalPoints
        });
      }

      // 5. Human teams: Strictly starting at Rank B + 1 onward
      humanTeams.sort((a, b) => (Number(b.total_points) || 0) - (Number(a.total_points) || 0));
      const humanUpdates = [];
      humanTeams.forEach((ht, hIdx) => {
        const humanRank = B + 1 + hIdx;
        humanUpdates.push({
          id: ht.id,
          rank: humanRank
        });
        participantUpdates.push({
          team_id: ht.id,
          contest_id: contest.id,
          rank: humanRank
        });
      });

      // 6. Execute atomic database commit
      const t = await sequelize.transaction();
      try {
        if (teamPlayerDeletions.length > 0) {
          await TeamPlayer.destroy({
            where: { team_id: teamPlayerDeletions },
            transaction: t
          });
        }

        const CHUNK = 250;
        for (let i = 0; i < allNewTeamPlayers.length; i += CHUNK) {
          await TeamPlayer.bulkCreate(allNewTeamPlayers.slice(i, i + CHUNK), { transaction: t });
        }

        for (const tu of teamUpdates) {
          await CricketTeam.update(
            {
              captain_id: tu.captain_id,
              vice_captain_id: tu.vice_captain_id,
              total_points: tu.total_points,
              rank: tu.rank,
              phase: tu.phase
            },
            { where: { id: tu.id }, transaction: t }
          );
        }

        for (const hu of humanUpdates) {
          await CricketTeam.update(
            { rank: hu.rank },
            { where: { id: hu.id }, transaction: t }
          );
        }

        for (const pu of participantUpdates) {
          await ContestParticipant.update(
            { rank: pu.rank },
            { where: { contest_id: pu.contest_id, team_id: pu.team_id }, transaction: t }
          );
        }

        // Record history for fair rotation across matches
        if (historyRecords.length > 0) {
          for (let i = 0; i < historyRecords.length; i += CHUNK) {
            await BotWinHistory.bulkCreate(historyRecords.slice(i, i + CHUNK), { transaction: t }).catch(() => {});
          }
        }

        await t.commit();
      } catch (txErr) {
        await t.rollback();
        throw txErr;
      }

      totalBotsRearranged += B;

      // Group phases for summary
      const phasesSummary = {};
      finalizedBots.forEach(b => {
        if (!phasesSummary[b.phase]) {
          phasesSummary[b.phase] = { phase: b.phase, name: b.phaseName, botsCount: 0, sampleRanks: [] };
        }
        phasesSummary[b.phase].botsCount++;
        if (phasesSummary[b.phase].sampleRanks.length < 3) {
          phasesSummary[b.phase].sampleRanks.push(b.finalRank);
        }
      });

      const roundOffCount = finalizedBots.filter(b => b.roundOffShift !== 0).length;

      contestReports.push({
        contestId: contest.id,
        title: contest.title,
        type: contest.type,
        totalBots: B,
        totalHumans: humanTeams.length,
        botRanks: `1 - ${B}`,
        humanRanks: humanTeams.length > 0 ? `${B + 1} - ${B + humanTeams.length}` : 'None',
        topBotScore: topBotScore,
        lowestBotScore: Math.round((topBotScore - ((B - 1) * step)) * 10) / 10,
        maxHumanScore: maxHumanScore,
        roundOffAdjustments: roundOffCount,
        phases: Object.values(phasesSummary)
      });

      console.log(`✅ [Manager Bot] Contest "${contest.title}": ${B} bots arranged across ${Object.keys(phasesSummary).length} phases (Ranks 1 to ${B}, Max Human: ${maxHumanScore}, ${roundOffCount} round-offs applied)`);
    }

    console.log(`\n🏆 [Manager Bot Complete] Match "${match.title}": Rearranged ${totalBotsRearranged} bot teams across ${contestReports.length} eligible contests! All bots strictly above humans!`);

    return {
      success: true,
      matchId: match.id,
      matchTitle: match.title,
      totalBotsRearranged,
      contestsProcessed: contestReports.length,
      contests: contestReports
    };
  }
}

const managerBot = new ManagerBot();

module.exports = {
  ManagerBot,
  managerBot
};
