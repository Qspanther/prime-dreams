# Module 3: Real-Time Streaming & Ingestion

## Overview
High-performance live cricket data ingestion and streaming engine. Consumes ball-by-ball scorecards, validates monotonic increments, applies deduplication, caches delta events, and broadcasts lightweight payloads via WebSockets.

## Owned Files & Directories
- `backend/ingestion/worker.js` (Cricbuzz polling worker, fallback mirror, monotonic guard)
- `backend/services/websocket/wsGateway.js` (WebSocket gateway attached on `/ws`)
- `backend/ws/redisPubSub.js` (In-memory and Redis-compatible event broadcaster)

## Managed Sub-Parts
1. **Cricbuzz Ingestion Worker**: Primary automated polling worker fetching live matches at configurable intervals (default: 30s).
2. **Alternate Mirror**: Secondary source fallback if primary Cricbuzz endpoint fails or encounters rate-limiting.
3. **Normalization Schema**: Normalizes team names, overs (`14.2`), wickets, runs, and ball-by-ball commentary into a standard internal JSON format.
4. **Monotonicity Guard**: Strict validation preventing score regressions (runs, wickets, and overs never decrease).
5. **Event Deduplication & Idempotency**: Ball hashes to prevent duplicate processing of identical balls.
6. **HotStore Cache**: In-memory score summary cache for instant sub-millisecond retrieval without database hits.
7. **Persistent DB (SQLite WAL mode)**: Local atomic persistence of raw ball events and historical match scores.
8. **WebSocket Gateway (`/ws`)**: High-concurrency gateway broadcasting compact 200-byte `BALL_DELTA` payloads.
9. **Client-Side Direct Connection**: Direct WebSocket connection over standard ports without intermediate buffering proxies.

## Isolation & Boundary Rules
- **DO NOT TOUCH**:
  - `frontend/` (Frontend UI)
  - `backend/routes/` (Backend REST API endpoints)
  - `backend/bot-service/` (Bot Network daemons)
