# 🏏 PRIME DREEMS — CRICKET FANTASY SPORTS PLATFORM (v2.1)
> **Original Brand & Architecture:** Prime Dreems (100% Brand-Isolated, Dream11-style cricket mechanics)  
> **Visual Identity:** Jet Black (`#000000`), Crimson Red (`#FF1744`), Shiny Gold (`#FFD700`) with tactile 3D interactive controls.

---

## 🧭 Platform Overview & Core Features

Prime Dreems is an enterprise-grade cricket fantasy sports platform powered by a **Zero-Mistake Ingestion Pipeline**, **Real-Time WebSocket Gateway**, and **Dual-Source Verification**.

- **Frontend:** Next.js 15 (App Router), React, Tailwind CSS, Lucide Icons, WebSocket client with 0-3s reconnection jitter.
- **Backend:** Node.js, Express, WebSocket Gateway (`ws`), SQLite with WAL mode & high-concurrency indexes.
- **Live Stream Engine:** Official Cricbuzz Ingestion Engine with Dual-Source Cross-Check & Monotonicity Guards.
- **Brand Rules:** Strictly **Prime Dreems** only. Zero third-party platform names in UI, code, or routes.

---

## ⚡ Zero-Mistake Live Ingestion & Streaming Architecture

```
Cricbuzz Real-Time Stream (Primary)      Alternate Mirror (Secondary)
               │                                      │
               ▼                                      ▼
     Ingestion Worker ◄─── Dual-Source Cross-Check ───┘
               │
               ▼
     Normalized Schema & Monotonicity Guard
     (Runs/Wickets/Overs can NEVER decrease)
               │
               ▼
     Event Deduplication & Idempotency Layer
     (Unique Event ID: match_innings_over_ball_runs_wickets)
               │
       ┌───────┴───────────────────────┐
       ▼                               ▼
  HotStore Cache              Persistent Database
  (Millisecond live reads)    (PostgreSQL / SQLite)
       │
       ▼
  WebSocket Gateway (/ws)
  (Lean 200-byte delta broadcasts: BALL_DELTA)
       │
       ▼
  Connected Clients (Zero Latency, Zero Drift)
```

---

## 🛡️ Key Architectural Layers

### 1. Ingestion Worker & Normalized Schema
- **Wrapper Architecture:** Ingestion runs as an independent worker in `backend/services/ingestion/ingestionWorker.js`. If external network APIs experience jitter, the main app never crashes; the worker handles retries with exponential backoff (2s, 4s, 8s).
- **Normalized Schema (`normalizedSchema.js`):**
  - **Match:** `match_id`, `cricbuzz_id`, `team_a`, `team_b`, `category` (World Cup / T20 / League / Women's), `status`, `format`.
  - **Player:** `player_id`, `match_id`, `name`, `team`, `role` (WK / BAT / AR / BOWL), `credits`, `points`.
  - **Live Score:** `team_a`, `team_b`, `current_innings`, `current_striker`, `non_striker`, `current_bowler`, `recent_balls`, `commentary`.

### 2. Accuracy & Zero-Mistake Safeguards
- **Dual-Source Verification (`dualSourceVerifier.js`):** Primary Cricbuzz readings are cross-checked against secondary endpoints. Minor 1-ball differences are absorbed; major discrepancies trigger an alert and fallback to the last verified state.
- **Event Deduplication (`deduplication.js`):** Unique deterministic ball event ID `${match_id}_inng${innings}_ov${over}_b${ball}_r${runs}_w${wickets}`. Duplicated or overlapping polling requests are discarded before database writes.
- **Strict Monotonicity:** Runs, wickets, and overs can **never** decrease. Any corrupt or backwards data is instantly rejected and recorded in the audit log.
- **Last Known Good Snapshot (`hotStore.js`):** Millisecond in-memory cache with dynamic `updated_seconds_ago` tags. If an upstream stream drops, clients seamlessly receive the last good snapshot with an "Updated Xs ago" badge.

### 3. Real-Time WebSocket Gateway (`wsGateway.js`)
- **Connection Endpoint:** `ws://localhost:5000/ws`
- **Lean Delta Streaming:** Only changed events are broadcast (`BALL_DELTA`, ~200 bytes per message) instead of full 4KB snapshots.
- **Slow Client Backpressure Handling:** If a client's socket buffer exceeds 64KB (e.g. 2G cellular network), lagging deltas are dropped and a `RESYNC_REQUIRED` signal is delivered for a clean REST refresh.
- **Reconnection Jitter:** Clients automatically reconnect with randomized 0-3 second backoff jitter to prevent self-DDoS during network reconnects.

### 4. Admin Control Deck (`/admin`)
- **🌐 Cricbuzz Live Database Feed:**
  - Table 1: Live In-Play matches directly from Cricbuzz with scores, balls, and commentary.
  - Table 2: Upcoming fixtures with 15+15 squad rosters (30 total players per match).
  - 1-Click Import: Generates match, 30 players, and 3 standard fantasy contests.
- **🛡️ Data Health & Ingestion Monitor:**
  - Worker Status (`RUNNING` / `HEALTHY`).
  - Source Status (Primary `OK` • Secondary `OK`).
  - Monotonicity Validation Failures counter (last 1 hour).
  - Red Alert Banner if any match is delayed > 30s.
  - Per-match Ingestion Pause / Resume toggle.
  - **Manual Score Override Tool:** Allows admins to adjust runs, wickets, or overs with a **mandatory audit reason** logged to `ScoreAuditLog`.
- **🏆 Prime Dreems Contests Database:** Overview of all active matches, registered users, wallets, and contests.

### 5. Pure Scoring Engine (`scoringEngine.js`)
- Isolated, pure function `calculateFantasyPoints(stats, role, rules)` guaranteeing deterministic output.
- **Scoring Rules:**
  - Run: +1 pt • Boundary (4): +1 pt • Six (6): +2 pts
  - Half-Century (50+): +8 pts • Century (100+): +16 pts
  - Wicket: +25 pts • 4 Wickets: +8 pts • 5 Wickets: +16 pts
  - Maiden Over: +12 pts • Catch: +8 pts • Stumping: +12 pts
  - Duck: -2 pts • Economy & Strike Rate bonuses applied dynamically.
  - Captain: 2.0× • Vice-Captain: 1.5×
- Every points change is logged in `PlayerPointsLog` with before/after values and ball event IDs.

### 6. Real-World Auto-Transition
- Upcoming matches display accurate scheduled dates and times from the Cricbuzz schedule.
- When an upcoming fixture starts in the real world (Cricbuzz status becomes `In Progress`), the ingestion worker automatically updates the platform match to `status: 'live'`, and the client UI seamlessly switches from schedule preview to live ball-by-ball telemetry.

---

## 🚀 Running the Platform Locally

### 1. Backend Server
```powershell
cd "backend"
npm install
node server.js
```
- API Endpoint: `http://localhost:5000`
- WebSocket Gateway: `ws://localhost:5000/ws`
- Health Check: `http://localhost:5000/health`

### 2. Frontend Web App
```powershell
cd "frontend"
npm install
npm run dev
```
- Web Application: `http://localhost:3000`
- Admin Deck: `http://localhost:3000/admin`
- Match Telemetry: `http://localhost:3000/match/[matchId]`

### 3. Run Ingestion & Scoring Test Suite
```powershell
node backend/test/replay_test.js
```

---

## 🔒 Default Accounts

- **Admin Account:** `admin@primedreems.com` / `Admin@123`
- **User Account:** `user@primedreems.com` / `User@123`
