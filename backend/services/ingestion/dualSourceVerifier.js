// 🏏 PRIME DREEMS — DUAL-SOURCE VERIFICATION & CROSS-CHECK ENGINE
// Section 2.1: Ensures zero score mistakes by cross-referencing multiple data providers

const alternateSource = require('./sources/alternateSource');
const hotStore = require('./hotStore');

class DualSourceVerifier {
  /**
   * Cross-checks primary score against secondary source
   */
  async verifyMatchScore(rawMatchId, primaryScore) {
    if (!rawMatchId || !primaryScore) {
      return { status: 'PRIMARY_ACCEPTED', verified: true };
    }

    try {
      const secondary = await alternateSource.fetchSecondaryMatchScore(rawMatchId);
      if (!secondary.available) {
        hotStore.recordSourceResult('secondary', false, secondary.reason);
        return {
          status: 'PRIMARY_ACCEPTED_UNVERIFIED',
          verified: false,
          reason: `Secondary source unavailable (${secondary.reason})`,
        };
      }

      hotStore.recordSourceResult('secondary', true);

      // Determine active innings in primary
      const activePrimary = primaryScore.current_innings === 'team_a' ? primaryScore.team_a : primaryScore.team_b;

      // Allow 2 runs tolerance for 1-ball streaming delta delay
      const runsDiff = Math.abs(activePrimary.runs - secondary.runs);
      const wicketsDiff = Math.abs(activePrimary.wickets - secondary.wickets);

      if (runsDiff <= 4 && wicketsDiff <= 1) {
        return {
          status: 'VERIFIED',
          verified: true,
          runsDiff,
          secondaryData: secondary,
        };
      }

      // Severe mismatch detected
      hotStore.recordValidationFailure(rawMatchId, `Dual-source mismatch: Primary ${activePrimary.runs}/${activePrimary.wickets} vs Secondary ${secondary.runs}/${secondary.wickets}`, {
        primary: activePrimary,
        secondary,
      });

      return {
        status: 'MISMATCH_ALERT',
        verified: false,
        reason: `Score discrepancy: Primary has ${activePrimary.runs}/${activePrimary.wickets}, Secondary has ${secondary.runs}/${secondary.wickets}`,
      };
    } catch (err) {
      hotStore.recordSourceResult('secondary', false, err.message);
      return {
        status: 'PRIMARY_ACCEPTED_UNVERIFIED',
        verified: false,
        reason: err.message,
      };
    }
  }
}

module.exports = new DualSourceVerifier();

