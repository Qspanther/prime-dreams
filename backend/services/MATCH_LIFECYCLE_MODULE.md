# Module 6: Match Lifecycle & Lock Logic

## Overview
Governs match status state transitions (`upcoming` ➔ `live` ➔ `completed`), strict registration deadlines, contest locking, live protection guards, and battlefield auto-scaling.

## Owned Files
- `backend/services/contestService.js` (Lock engine, H2H expiration, battlefield auto-clone)
- Match lock background interval in `backend/server.js` (`checkContestLocks`, 30-second cadence)

## Managed Sub-Parts
1. **Deadline Rule**: Automatic lock triggered exactly `start_time - lock_time_minutes` (default 15 minutes before first ball).
2. **Live Match Protection**: Lineup creation, team edits, and contest joins are strictly rejected with 403 Forbidden once locked or live.
3. **Home Page Auto-Shift**: Frontend and API sort matches into `Live Now` and `Upcoming` dynamically based on status transitions.
4. **Private Contest Lock**: Private contests and invitation codes locked at the match deadline.
5. **Match Transition**:
   - `upcoming ➔ live`: Triggered when current time reaches `start_time` or first ball is bowled.
   - `live ➔ completed`: Triggered by ingestion worker when result is finalized (e.g. innings 2 concludes, target reached, or match abandoned).

## Isolation & Boundary Rules
- **DO NOT TOUCH**:
  - `frontend/` (Frontend UI components)
  - `backend/services/scoringEngine.js` (Points calculation)
  - `backend/bot-service/` (Bot worker daemon)
