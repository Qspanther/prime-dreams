# 🏏 PRIME DREEMS — CRICKET FANTASY SPORTS PLATFORM (v2.6)
> **Original Brand & Architecture:** Prime Dreems (100% Brand-Isolated, Decoupled Payouts & Free-Pass System)  
> **Visual Identity:** Jet Black (`#000000`), Royal Blue (`#2563EB`), Emerald Green (`#059669`), Shiny Amber/Gold (`#D97706`) with tactile 3D interactive controls.

---

## 🧭 Platform Overview & Architecture

Prime Dreems is an enterprise-grade cricket fantasy sports platform re-engineered for compliance with **Zero-Cash Team Creation**, a **Decoupled Payouts & Winnings Portal**, **Numeric Contest IDs (#2013-style)**, **Admin-Configurable Dynamic Subscription Tiers**, and **Snapshot-Protected Referral Passes**:

- **Decoupled Payouts & Wallet Architecture:** Prime Dreems main platform is 100% cash-free for match participation. Users create lineups and compete for free using their Subscription or Referral Pass. All cash winnings, UPI/Bank IMPS withdrawals, and transaction ledgers reside exclusively on the dedicated **Official Payouts & Winnings Portal** (`/payouts-portal`), sharing seamless unified login credentials.
- **Auto-Increment Numeric Contest IDs:** Every contest displays a clean, memorable numeric ID (e.g. `Contest #2013`). Users can enter this ID into the Payouts Portal search engine to inspect spots, prize pool, and full rank-wise prize distribution charts.
- **Dynamic Subscription Tiers (`/subscription` & `/admin/subscriptions`):** Admin configures custom subscription categories (Bronze, Silver, Gold, VIP) with custom validity days and team creation limits per match.
- **Snapshot-Protected Referral Passes:** Dynamic promo/referral offers (e.g. invite 5 friends for 10 days of free entries). When claimed, the user's entitlement snapshot is permanently locked in for the duration of validity, protecting users even if admin alters the offer later.
- **Frontend:** Next.js 15 (App Router, Turbopack), React 19, Tailwind CSS, Lucide Icons, WebSocket streaming client.
- **Backend:** Node.js, Express, WebSocket Gateway (`ws`), Neon PostgreSQL Serverless DB (with local SQLite fallback).
- **Live Stream Engine:** Official Cricbuzz Ingestion Engine with Dual-Source Cross-Check & Monotonicity Guards.
- **Brand Rules:** Strictly **Prime Dreems** only. Zero third-party platform names in UI, code, or routes.

---

## 🏟️ 1. Cricket Stadium Pitch View (Team Builder & C/VC Selector)
- **Direct Interactive Pitch View:** Integrated inside the team builder (`CricketPitchView.tsx`).
- **Tactile Cricket Ground Layout:**
  - **Top Row (WK):** Wicket-Keepers (1 to 4 players)
  - **Second Row (BAT):** Batters (3 to 6 players)
  - **Third Row (AR):** All-Rounders (1 to 4 players)
  - **Bottom Row (BOWL):** Bowlers (3 to 6 players)
- **Interactive Captain / Vice-Captain Selector:**
  - Dedicated selection buttons at the bottom: **`Captain (2×)`** and **`Vice-Captain (1.5×)`**.
  - Tapping a mode highlights all eligible players on the pitch. Tapping any player assigns them glowing **`2× C`** (Blue) or **`1.5× VC`** (Amber) badges.
  - Full editability maintained right until contest lock time.
- **Role Normalization (`normalizeRole`):**
  - Auto-normalizes all API and Cricbuzz role variations (`BATSMAN`, `BATTER`, `Bat`, `WK-Keeper`, `Allrounder`) to canonical `WK`, `BAT`, `AR`, and `BOWL` keys.
  - Guarantees **zero empty role tabs** ("0 Players Available" eliminated across all matches).
  - Dynamic squad pool counter reflects the actual player roster size.

---

## 🔒 2. Dream11-Style Contest Lock & Match Lifecycle
- **Deadline Rule (`start_time - 15 minutes`):**
  - Contests automatically lock **15 minutes before the match start time** or as soon as the match transitions to `live`.
  - Lineups lock to preserve integrity before toss and the first ball.
- **Live Match Protection on Match Page (`/match/[matchId]`):**
  - **`[Create My XI]`** auto-disables to **`🔒 Squads Locked (Match In-Play)`**.
  - **`[H2H Duel]`** auto-disables to **`🔒 H2H Locked`**.
  - **Contest Cards:** All contest cards (Mega, Winner Takes All, Rookie, H2H) remain visible with full prize pools, spot counts, and prize breakups, but the Join button changes to **`🔒 Locked`**.
  - **Private Contests:** Creating new private contests or joining via invite code is automatically disabled once the match is locked.
- **Home Page Auto-Shift (Upcoming ➔ Live):**
  - Dual condition check: if a match has live scores on the board OR its scheduled start time has arrived (`now >= start_time`), it is immediately moved to **`⚡ Live Matches`** and removed from `Upcoming Matches`.

---

## 🎟️ 3. Free Team Creation with Pass & Decoupled Payouts Architecture
- **Free Contest Entry via Pass:**
  - Team creation and contest participation on Prime Dreems requires zero entry fee deduction (`entry_fee: 0`).
  - Access is governed purely by active **Subscription Passes** or **Referral Passes** (`max_teams_per_match` quota).
- **Decoupled Payouts & Winnings Portal (`/payouts-portal`):**
  - Dedicated portal accessed with the exact same user credentials.
  - Features real-time winnings balance, lifetime earnings, and direct UPI / IMPS bank withdrawal requests.
  - Search any contest by its numeric ID (e.g. `2013`) to inspect total spots, prize pool, and rank distribution charts.
  - Dedicated "My Joined Contests & Prize Verification" tab allows users to verify their ranks and claimed prizes.
- **Admin Subscription & Referral Controls (`/admin/subscriptions`):**
  - Full CRUD control over subscription tier pricing (₹), validity days, and max teams allowed per match.
  - Dynamic referral promo configuration with snapshot isolation guaranteeing user pass benefits even across offer updates.

---

## 🏆 4. Live Match Leaderboard & Real-Time Scoring
- **Endpoint:** `GET /matches/:id/leaderboard`
- **Zero-Error Architecture:**
  - Local client-side requests connect directly to `http://localhost:5000` to eliminate proxy socket drops (`ECONNRESET`) and avoid 500 Internal Server Errors.
  - Automated squad auto-seeding ensures player rosters and points are populated even for newly discovered fixtures.
  - Player leaderboard ranks all 22-30 match players by fantasy points earned with real-time stats (runs, wickets, overs, strike rate, economy).
  - Standings update live via WebSocket (`ws://localhost:5000/ws`).

---

## ⚡ 5. Real-Time Streaming & Ingestion Architecture

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
  (Millisecond live reads)    (SQLite WAL mode)
       │
       ▼
  WebSocket Gateway (/ws)
  (Lean 200-byte delta broadcasts: BALL_DELTA)
       │
       ▼
  Connected Clients (Zero Latency, Zero Drift)
```

### Fantasy Points System (`scoringEngine.js`)
- **Batting:** Run: +1 pt • Boundary (4): +1 pt • Six (6): +2 pts • 50+ Runs: +8 pts • 100+ Runs: +16 pts • Duck: -2 pts
- **Bowling:** Wicket: +25 pts • 4 Wickets: +8 pts • 5 Wickets: +16 pts • Maiden Over: +12 pts
- **Fielding:** Catch: +8 pts • Stumping: +12 pts • Run-out: +6 to +12 pts
- **Multipliers:** Captain: 2.0× • Vice-Captain: 1.5×

---

## 🤖 6. Autonomous 10,000 Cricket Bot Network & 72-Hour Organic Engine

Prime Dreems features a state-of-the-art **10,000 Autonomous Bot Network** designed to provide realistic contest liquidity, natural user traffic pacing, and tournament depth.

### ⏱️ 1. Instant Match Ingestion & 72-Hour Countdown Alert
- **Instant Discovery:** Whenever a new cricket match appears in `upcoming` status (via Cricbuzz sync or admin creation), the bot scheduler immediately registers the fixture.
- **Standby Mode (`> 72 Hours`):** If match start time is more than 72 hours away, the bots remain on standby without entering contests.
- **72-Hour Alert Trigger (`<= 72 Hours`):** The instant the countdown hits 72 hours (`start_time - now <= 72h`), a system-wide alert is fired:
  - 10,000 Bots network transitions from `STANDBY_WAITING_72H` to `ACTIVE_72H_DEPLOYMENT`.
  - Gradual, organic team registration starts across all eligible contests.

### 🌊 2. Organic Random Staggered Deployment (Human-Like Traffic)
- **No Instant Bot Dumps:** Bots do **not** enter all at once. They trickle into contests randomly and gradually throughout the 72-hour window.
- **Realistic Pacing Curve:** Target contest fill percentages scale smoothly as match time approaches, mimicking genuine human participation curves.
- **Micro-Batches with Jitter:** Bots join in small randomized batches (1 to 5 bots) at variable time intervals, leaving spots for real users.
- **Valid Team Compositions:** Every bot team strictly adheres to Prime Dreems / Dream11 lineup rules:
  - Exactly 11 players
  - Total credits &le; 105
  - Max 7 players from a single cricket team
  - 1-4 WK, 3-6 BAT, 1-4 AR, 3-6 BOWL
  - Distinct Captain (2.0&times;) and Vice-Captain (1.5&times;)

### 🛡️ 3. Strict Contest Protection & Guaranteed Bot Quotas
| Contest Type | Bot Participation | Allocation & Protection Rules |
| :--- | :--- | :--- |
| **Mega Grand Contests** | ✅ **Active** | Bots create up to **10,000 teams** across the 72h window |
| **Multi-Battlefield (25 spots)** | ✅ **Active** | **Minimum 7 bots guaranteed** per room. **Zero empty battlefields**; auto-clones next room when filled |
| **Mini Contests (100 spots)** | ✅ **Active** | **Minimum 25 bots guaranteed** per 100-spot pool |
| **Custom Bot Target** | ✅ **Active** | Admin specifies exact `bot_spots` (e.g. 500 teams) in Admin Panel |
| **Head-to-Head (H2H) Duels** | 🚫 **STRICTLY EXCLUDED** | **100% Protected.** Bots NEVER enter H2H contests (Locked to 0) |
| **Private Contests (Invite Code)** | 🚫 **STRICTLY EXCLUDED** | **100% Protected.** Bots NEVER touch user-created private contests (Locked to 0) |

### 🎯 4. Admin Panel Match & Contest Creation Flow (`/admin/tournaments`)
In Step 4 of the match creation wizard, the Admin can configure all available fantasy contest types with custom bot team allocations:
1. **🏆 Mega Grand Contest (`mega`):** Large prize pool, up to 10,000 bot teams.
2. **⚔️ PUBG Multi-Battlefield (`multi_battlefield`):** 25-spot rooms with minimum 7 bots guaranteed; auto-clones next room on fill.
3. **🎯 Mini Contest (`mini`):** 10 to 100 spots with minimum 25 bots per 100 spots.
4. **🆓 Practice Contest (`practice`):** Free entry (₹0 fee) public practice contests.
5. **🔒 Private Contest (`private`):** User/friends room with invite code (**0 Bots, Protected**).
6. **🥊 Head-to-Head Duel (`h2h`):** 1v1 challenge contest (**0 Bots, Protected**).
7. **📊 Standard Public Contest (`standard`):** Custom spots and fee.

- **`🤖 Bots (Teams Count)` Field:**
  - Dedicated input field on every public contest.
  - Admin can specify any custom team quota (e.g., `500` bots).
  - Multi-entry engine creates multiple teams per bot (`Aarav's XI`, `Aarav's XI (T2)`, `Aarav's XI (T3)`) as needed to satisfy any target quota without limits.
  - For Private and H2H contests, this field is automatically disabled and locked to `0`.

### 🤖 5. Autonomous Manager Bot & Dynamic Phase Coordinator
- **Master Orchestrator (`ManagerBot`):**
  - Manages and allocates all participating bot teams into **Phases / Batches**:
    - **Phase 1 (Elite Tier):** Ranks 1 to 50 (or top batch).
    - **Phase 2 (High Performers):** Ranks 51 to 100.
    - **Phase 3 (Mid Tier):** Ranks 101 to 150... and continuing across all participating bots.
  - Dynamically scales batch sizes based on contest size (e.g. 50-bot batches for Mega pools, 3 to 4-bot batches for 25-spot battlefields).
- **Anti-Monopoly Fair History Rotation:**
  - Tracks historical phase counts (`bot_win_history.phase`) for every bot across previous matches.
  - Bots that have not appeared in Phase 1 get prioritized weight for Phase 1 in upcoming matches.
  - Batches are freshly and randomly shuffled every match so **every bot eventually reaches Phase 1 and top ranks**.
- **Dynamic Lineup & C/VC Calculation per Phase:**
  - In the match's death stage (**last 6 to 10 balls remaining**), each bot calculates squad changes:
    - **Phase 1 Bots:** Secure top match heroes (centurions, 3-5 wicket bowlers) with Captain ($2.0\times$) and Vice-Captain ($1.5\times$).
    - **Phase 2+ Bots:** Receive balanced high-scoring combinations matching their phase target.
- **Dynamic Round-Off & Jitter Engine ($\pm 1$ or $\pm 2$ Rank Shift):**
  - Simulates natural cricket point fluctuations:
    - A bot targeting Rank 5 can round off to Rank 4 or Rank 6 based on point conditions and discrete scoring.
    - Round-off shifts remain strictly bounded within the bot pool ($1 \le \text{rank} \le B$).
- **Guaranteed Human Isolation:**
  - **All bots across all phases strictly finish above human users** (`topBotScore > lowestBotScore > maxHumanScore`).
  - Bots hold **Ranks $1$ through $B$** (e.g., Ranks 1 to 500).
  - Human participants start strictly at **Rank $B + 1$ onward** (e.g., Rank 501+).
  - **Private Contests** and **Head-to-Head (H2H) Duels** remain 100% untouched and protected (0 bots).

### 🎖️ 6. Post-Match Tactical Rearrangement & Anti-Monopoly Fair Rotation
- **6-Tier Tactical Placement:** Once a match completes, lineups are analyzed against real fantasy points to distribute bots across Tiers 1-6 (Top Winners, High Performers, Mid-tier, Underdogs).
- **Anti-Monopoly Winner Rotation:** Top 10 ranks rotate fairly so no single bot monopolizes victories. Every bot gets an equal chance over time.

### 💻 7. Bot Manager CLI & API Endpoints
```powershell
# Check Bot Network status & active rules
node bot_manager.js status

# Real-time 72-hour countdowns & contest eligibility per upcoming match
node bot_manager.js 72h

# Force immediate 72-hour scheduler check and organic join tick
node bot_manager.js trigger-72h

# Execute 1 organic staggered join tick for a match
node bot_manager.js deploy-staggered <matchId>

# Dynamic 6-10 balls death stage tactical rearrangement (force trigger)
node bot_manager.js endgame <matchId>

# Check balls remaining and death stage trigger state
node bot_manager.js endgame-status <matchId>

# View Manager Bot phase allocations & ranks
node bot_manager.js phases <matchId>

# Seed bot network up to 10,000 bots
node bot_manager.js seed 10000

# Run continuous autonomous monitoring daemon (72h watcher + death stage engine)
node bot_manager.js daemon
```
- **API Endpoints:**
  - `GET /bot-manager/status` — Network overview & scheduler heartbeat
  - `GET /bot-manager/72h-status` — Detailed 72h countdown, alert state & contest breakdown
  - `GET /bot-manager/endgame-status/:matchId` — Live death-stage detection & balls remaining
  - `GET /bot-manager/phases/:matchId` — Manager Bot phase distribution & sample ranks
  - `POST /bot-manager/trigger-72h-check` — Manual trigger for 72h scheduler tick
  - `POST /bot-manager/deploy-staggered` — Organic staggered join tick
  - `POST /bot-manager/deploy-pre-contest` — Mass pre-contest join (skips H2H & Private)
  - `POST /bot-manager/rearrange-endgame` — Dynamic 6-10 balls death stage bot rearrangement
  - `POST /bot-manager/deploy-autonomous` — Post-match rearrangement & Fair Rotation
  - `POST /bot-manager/seed-bots` — Seed 10,000 bots

---

## 🌐 8. Distributed Architecture (Render + External Cloud Database)

Prime Dreems is structured as an enterprise-grade 3-tier distributed system:
- **Part 1: Frontend Web Service (`frontend/`):** Deployed on **Render** (or Vercel) as a Next.js 15 Web Service.
- **Part 2: Backend API & Real-time Service (`backend/`):** Deployed on **Render** as a Node.js Web Service running API, Ingestion, and 10,000 Bots.
- **Part 3: Independent Cloud Database:** Placed on external cloud providers (**Neon.tech / Supabase / Railway / AWS RDS**) via `DATABASE_URL` with SSL. *(Falls back to local SQLite if `DATABASE_URL` is omitted).*

👉 **See the complete step-by-step setup guide:** [DEPLOYMENT.md](file:///C:/Users/abbu/Documents/Prime%20dreems/DEPLOYMENT.md)  
👉 **1-Click Render Blueprint:** [render.yaml](file:///C:/Users/abbu/Documents/Prime%20dreems/render.yaml)

---

## 🔑 9. Live Cloud Credentials & Platform API Keys

> [!IMPORTANT]
> The active production infrastructure for Prime Dreems is deployed across **Neon PostgreSQL** and **Render Cloud**. All connection secrets, API keys, and platform credentials must be managed strictly via environment variables (`.env`) and Render Dashboard environment variables. Never commit raw keys to git.

### 🐘 1. Neon Cloud Database (Active Serverless PostgreSQL)
- **Platform:** [Neon Serverless PostgreSQL](https://console.neon.tech)
- **Host Endpoint:** `ep-winter-scene-bev77yoi-pooler.c-9.us-east-2.aws.neon.tech`
- **Database:** `neondb` (Pooled with `sslmode=require`)
- **Configuration:** Set `DATABASE_URL` and `BOT_DATABASE_URL` in `.env` and Render environment settings.
- **Connection Pool:** Capped at `PG_POOL_MAX=5` on user backend and `BOT_PG_POOL_MAX=3` on bot service to strictly respect Neon connection quotas.
- **Seeded Data:** Fully migrated schema, live cricket fixtures, contests, wallets, and autonomous bots verified active.

### 🚀 2. Render Cloud Platform (Free Tier Multi-Service Blueprint)
- **Platform:** [Render Dashboard](https://dashboard.render.com)
- **Live Services:**
  - **Backend API Service:**
    - Live URL: [https://prime-dreems-backend.onrender.com](https://prime-dreems-backend.onrender.com)
    - Health Check: [https://prime-dreems-backend.onrender.com/health](https://prime-dreems-backend.onrender.com/health)
    - Root Dir: `backend` | Build: `npm install` | Start: `npm start`
  - **Frontend Web Service:**
    - Live URL: [https://prime-dreams.onrender.com](https://prime-dreams.onrender.com)
    - Health Check: [https://prime-dreams.onrender.com/api/health](https://prime-dreams.onrender.com/api/health)
    - Root Dir: `frontend` | Build: `npm install --include=dev && npm run build` | Start: `npm start`
  - **Isolated Bot Service:**
    - Root Dir: `backend/bot-service` | Build: `npm install` | Start: `npm start`
    - Health Check: `/health` (Port 5100)
- **Secrets Management:**
  - Render API Key, Neon URL, and Bot API keys are configured via Render Environment Variables and local `.env` files (ignored in `.gitignore`).

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
- Match Detail & Contests: `http://localhost:3000/match/[matchId]`
- Match Leaderboard: `http://localhost:3000/match/[matchId]/leaderboard`
- Team Builder: `http://localhost:3000/team-builder/[matchId]`
- Wallet & Add Cash: `http://localhost:3000/wallet`
- H2H Challenge: `http://localhost:3000/h2h/challenge`

### 3. Production Verification Build
```powershell
cd "frontend"
npm run build
```
- Fully compiled with 0 TypeScript/ESLint errors across all 21 dynamic & static routes.

---

## 🔒 Tested Live Login Credentials

You can log in directly at the live portal [https://prime-dreams.onrender.com/login](https://prime-dreams.onrender.com/login) using either email or username:

### 👑 1. Admin Account (Full Tournament, Match & Bot Management)
- **Email:** `admin@primedreems.com`
- **Username:** `admin`
- **Password:** `Admin@123`
- **Role:** `admin` (Access to `/admin`, `/admin/tournaments`, and match control deck)
- **Starting Wallet Balance:** ₹5,00,000 (Bonus: ₹1,00,000, Deposit: ₹3,00,000, Winnings: ₹1,00,000)
- **Status:** Verified (Zero OTP required on direct login)

### 👤 2. Regular User Account (Team Creation, Wallet & Contests)
- **Email:** `user@primedreems.com`
- **Username:** `cricket_user`
- **Password:** `User@123`
- **Role:** `user` (Access to Mega, Battlefield, Mini, and Private contests)
- **Starting Wallet Balance:** ₹50,000 (Bonus: ₹10,000, Deposit: ₹30,000, Winnings: ₹10,000)
- **Status:** Verified (Zero OTP required on direct login)

### 🏏 3. Testing Pro Player Account (Extra Testing Option)
- **Email:** `player@primedreems.com`
- **Username:** `cricket_pro`
- **Password:** `User@123`
- **Role:** `user`
- **Starting Wallet Balance:** ₹1,00,000
- **Status:** Verified
