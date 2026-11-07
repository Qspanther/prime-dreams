const express = require('express');
const appConfig = require('../config');

const router = express.Router();

// GET /api/config — Public config values for frontend
router.get('/', (req, res) => {
  res.json({
    platformName: appConfig.PLATFORM_NAME,
    validCategories: appConfig.VALID_CATEGORIES,
    totalTeamSize: appConfig.TOTAL_TEAM_SIZE,
    totalCredits: appConfig.TOTAL_CREDITS,
    maxPlayersPerTeam: appConfig.MAX_PLAYERS_PER_TEAM,
    roleConstraints: appConfig.ROLE_CONSTRAINTS,
    captainMultiplier: appConfig.CAPTAIN_MULTIPLIER,
    viceCaptainMultiplier: appConfig.VICE_CAPTAIN_MULTIPLIER,
    scoringWeights: appConfig.SCORING_WEIGHTS,
    defaultLockMinutes: appConfig.DEFAULT_LOCK_MINUTES,
    h2hCommissionPercent: appConfig.H2H_COMMISSION_PERCENT,
  });
});

module.exports = router;
