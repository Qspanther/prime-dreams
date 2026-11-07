// 🏏 PRIME DREEMS — EVENT DEDUPLICATION & IDEMPOTENCY ENGINE
// Section 2.2: Ensures each ball event has a unique ID and duplicate/overlapping polls are discarded

class EventDeduplicator {
  constructor(maxHistory = 5000) {
    this.maxHistory = maxHistory;
    this.processedEvents = new Set();
    this.eventQueue = [];
  }

  /**
   * Generates a deterministic unique ID for a ball event
   */
  generateEventId(matchId, innings, over, ball, runs, wickets) {
    return `${matchId}_inng${innings}_ov${over}_b${ball}_r${runs}_w${wickets}`;
  }

  /**
   * Checks if this event has already been ingested.
   * If not, records it.
   */
  isDuplicate(eventId) {
    if (!eventId) return false;

    if (this.processedEvents.has(eventId)) {
      return true;
    }

    // Add to set and queue
    this.processedEvents.add(eventId);
    this.eventQueue.push(eventId);

    // Evict oldest if exceeding maxHistory to prevent memory leak
    if (this.eventQueue.length > this.maxHistory) {
      const oldest = this.eventQueue.shift();
      this.processedEvents.delete(oldest);
    }

    return false;
  }

  /**
   * Clear cache for testing
   */
  clear() {
    this.processedEvents.clear();
    this.eventQueue = [];
  }
}

module.exports = new EventDeduplicator();

