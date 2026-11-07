// 🏏 PRIME DREEMS — IN-MEMORY HOT STATE & LAST-KNOWN-GOOD SNAPSHOT STORE
// Section 2.4 & Section 7: Ultra-fast millisecond live reads & graceful degradation cache

class HotStore {
  constructor() {
    this.snapshots = new Map(); // matchId -> snapshot object
    this.metrics = {
      worker_status: 'RUNNING',
      last_sync_time: null,
      validation_failures_1h: 0,
      validation_logs: [], // recent 50 validation rejection entries
      source_health: {
        primary: { name: 'Cricbuzz Live Stream', status: 'OK', last_success: null, error_count: 0 },
        secondary: { name: 'Alternate Mirror / Cross-Check', status: 'OK', last_success: null, error_count: 0 },
      },
      paused_matches: new Set(),
      is_global_paused: false,
    };
  }

  /**
   * Save verified snapshot
   */
  setSnapshot(matchId, scoreData, metadata = {}) {
    const now = new Date();
    const entry = {
      match_id: matchId,
      score: scoreData,
      last_updated_at: now.toISOString(),
      updated_epoch: now.getTime(),
      is_degraded: Boolean(metadata.is_degraded),
      source: metadata.source || 'Primary (Cricbuzz)',
      cross_check_status: metadata.cross_check_status || 'VERIFIED',
    };
    this.snapshots.set(matchId, entry);
    return entry;
  }

  /**
   * Get latest snapshot with dynamic updated_seconds_ago
   */
  getSnapshot(matchId) {
    const entry = this.snapshots.get(matchId);
    if (!entry) return null;

    const secondsAgo = Math.max(0, Math.round((Date.now() - entry.updated_epoch) / 1000));
    return {
      ...entry,
      updated_seconds_ago: secondsAgo,
      is_stale: secondsAgo > 30, // Red alert threshold
    };
  }

  /**
   * Record a validation failure for admin audit and health tracking
   */
  recordValidationFailure(matchId, reason, rejectedPayload) {
    this.metrics.validation_failures_1h += 1;
    const log = {
      id: Math.random().toString(36).substring(2, 9),
      match_id: matchId,
      timestamp: new Date().toISOString(),
      reason,
      payload: rejectedPayload,
    };
    this.metrics.validation_logs.unshift(log);
    if (this.metrics.validation_logs.length > 50) {
      this.metrics.validation_logs.pop();
    }
  }

  /**
   * Record source health outcome
   */
  recordSourceResult(sourceName, success, errorMsg = null) {
    const target = sourceName === 'secondary' ? this.metrics.source_health.secondary : this.metrics.source_health.primary;
    if (success) {
      target.status = 'OK';
      target.last_success = new Date().toISOString();
      target.error_count = 0;
    } else {
      target.error_count += 1;
      target.status = target.error_count > 3 ? 'ERROR' : 'DEGRADED';
      target.last_error = errorMsg;
    }
  }

  /**
   * Ingestion pause / resume toggles
   */
  pauseMatch(matchId) {
    this.metrics.paused_matches.add(matchId);
  }

  resumeMatch(matchId) {
    this.metrics.paused_matches.delete(matchId);
  }

  isMatchPaused(matchId) {
    return this.metrics.is_global_paused || this.metrics.paused_matches.has(matchId);
  }

  setGlobalPause(paused) {
    this.metrics.is_global_paused = Boolean(paused);
  }

  /**
   * Admin Health Snapshot
   */
  getHealthReport() {
    const now = Date.now();
    const liveMatchesStatus = [];
    let hasDelayedMatches = false;

    for (const [matchId, entry] of this.snapshots.entries()) {
      const secondsAgo = Math.max(0, Math.round((now - entry.updated_epoch) / 1000));
      const isDelayed = secondsAgo > 30;
      if (isDelayed) hasDelayedMatches = true;

      liveMatchesStatus.push({
        match_id: matchId,
        last_updated_at: entry.last_updated_at,
        updated_seconds_ago: secondsAgo,
        is_delayed: isDelayed,
        is_degraded: entry.is_degraded,
        is_paused: this.isMatchPaused(matchId),
        source: entry.source,
        cross_check_status: entry.cross_check_status,
      });
    }

    return {
      worker_status: this.metrics.worker_status,
      is_global_paused: this.metrics.is_global_paused,
      last_sync_time: this.metrics.last_sync_time,
      validation_failures_count_1h: this.metrics.validation_failures_1h,
      has_delayed_matches: hasDelayedMatches,
      source_health: this.metrics.source_health,
      live_matches: liveMatchesStatus,
      recent_validation_errors: this.metrics.validation_logs.slice(0, 10),
    };
  }
  cleanupMatch(matchId) {
    this.snapshots.delete(matchId);
    this.metrics.paused_matches.delete(matchId);
  }
}

module.exports = new HotStore();

