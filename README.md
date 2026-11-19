<!-- ================================================================= -->
<!--                       AI AGENT RULES                              -->
<!-- ================================================================= -->
<!-- STRICT RULES FOR ALL AI AGENTS & COLLABORATORS:                    -->
<!-- 1. MODULAR ISOLATION IS NON-NEGOTIABLE.                           -->
<!--    Work on ONE module at a time. Do NOT touch, edit, or refactor -->
<!--    files belonging to other modules in the same turn or commit.    -->
<!-- 2. ONE COMMIT PER MODULE:                                          -->
<!--    Every change must belong strictly to its designated module.    -->
<!--    Never mix frontend, backend, scoring, ingestion, or bot code.  -->
<!-- 3. VERIFY BEFORE ADVANCING:                                        -->
<!--    Verify each module in complete isolation before proceeding to   -->
<!--    the next module.                                               -->
<!-- 4. ZERO CASH COMPLIANCE:                                           -->
<!--    Prime Dreems is 100% free-entry/pass-based (entry_fee: 0).     -->
<!--    All winnings, payouts, and withdrawals belong exclusively to    -->
<!--    the decoupled Payouts Portal (/payouts-portal).                 -->
<!-- 5. 100% PRIZE CAPTURE BY BOTS:                                     -->
<!--    Autonomous bots must occupy Ranks 1 to B (capturing 100% of    -->
<!--    prize-paying positions). Human managers always rank B+1 onward.-->
<!-- 6. BRAND ISOLATION:                                                -->
<!--    Strictly "Prime Dreems". Zero third-party platform names.      -->
<!-- ================================================================= -->

> [!CAUTION]
> **AI AGENT RULES & MODULAR BOUNDARIES:**
> When working on any module, **do NOT modify files belonging to other modules**. Follow the designated file ownership strictly. If a cross-cutting change is required, split it into separate commits (backend first, then frontend).

# 🏏 PRIME DREEMS — CRICKET FANTASY SPORTS PLATFORM (v3.0 Enterprise Scale)
> **Brand & Architecture:** Prime Dreems (100% Brand-Isolated, Decoupled Payouts & Free-Pass System)  
> **Visual Identity:** Jet Black (`#000000`), Royal Blue (`#2563EB`), Emerald Green (`#059669`), Shiny Amber/Gold (`#D97706`) with tactile 3D interactive controls.  
> **Deployment Status:** 🟢 **Production Live** on Render Cloud & Neon Serverless PostgreSQL.

---

## 🧭 Platform Overview & Architecture

Prime Dreems is an enterprise-scale cricket fantasy sports platform re-engineered for high-concurrency traffic, free-tier cloud limits, and zero-latency user experience:

- **Decoupled Payouts & Wallet Architecture:** Prime Dreems main platform is 100% cash-free for match participation. Users create lineups and compete for free using their Subscription or Referral Pass. All cash winnings, UPI/Bank IMPS withdrawals, and transaction ledgers reside exclusively on the dedicated **Official Payouts & Winnings Portal** (`/payouts-portal`), sharing seamless unified login credentials.
- **Bot Data Isolation (`BotTeam` Architecture):** Bot lineups are isolated into a dedicated `bot_teams` table with JSON player storage. This removes 91% of row writes on Neon PostgreSQL and ensures real human queries (`teams` / `team_players`) are never slowed down by bot operations.
- **Bot Natural Pacing (1-Hour Rule & Micro-Batches):** Bot allocations lock exactly **1 hour before match start time** (`hoursUntilStart <= 1.0`). Entries enter organically one-by-one with randomized time jitter rather than bulk dumps.
- **Instant 0ms Page Loading (SWR Caching):** Client-side Stale-While-Revalidate (SWR) in-memory cache guarantees instantaneous page transitions for Contests, Teams, and Leaderboards.
- **Auto-Increment Numeric Contest IDs:** Every contest displays a clean numeric ID (e.g. `Contest #2013`). Users can enter this ID into the Payouts Portal search engine to inspect spots, prize pool, and full rank-wise prize distribution charts.
- **Dynamic Subscription Tiers (`/subscription` & `/admin/subscriptions`):** Admin configures custom subscription categories (Bronze, Silver, Gold, VIP) with validity days and team creation quotas.
- **Snapshot-Protected Referral Passes:** Dynamic promo/referral offers (e.g. invite 5 friends for 10 days of free entries). When claimed, the user's entitlement snapshot is permanently locked in for the duration of validity.
- **Frontend:** Next.js 15 (App Router, Turbopack), React 19, Tailwind CSS, Lucide Icons, WebSocket streaming client.
- **Backend:** Node.js, Express, WebSocket Gateway (`ws`), Neon PostgreSQL Serverless DB (PgBouncer connection pooling).
- **Bot Network Daemon:** Dedicated Port 5100 Microservice for autonomous contest liquidity and natural traffic simulation.

---

## 🔑 Live Cloud Credentials & Platform API Keys

> [!IMPORTANT]
> The active production infrastructure for Prime Dreems is deployed across **Neon PostgreSQL** and **Render Cloud**. Below are the registered API keys, database connection strings, and service IDs for reference and management.

### 🐘 1. Neon Cloud Database (Active Serverless PostgreSQL)
- **Neon API Key:** `napi_2wp8yga0zm1r93mjpnrb007d8rekib20oswop7ltd382v8byavyujqm6re86ghft`
- **Active Project ID:** `old-credit-65332354` (`prime-dreems-prod`)
- **Region:** `aws-us-east-2` (Ohio)
- **Database Engine:** PostgreSQL 16
- **Connection Mode:** **Transaction Connection Pooling (PgBouncer)** active on port `5432`
- **Pooled Production URL (`DATABASE_URL`):**
  ```text
  postgresql://neondb_owner:npg_vPAEDW8Nsap4@ep-odd-math-bdqn584b-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require
  ```
- **Connection Pooling Limits:**
  - `PG_POOL_MAX=5` on User Backend API (`prime-dreems-backend`)
  - `BOT_PG_POOL_MAX=3` on Bot Microservice (`prime-dreems-bot-service`)
  - Idle timeout: `10000ms` (Allows Neon compute to auto-suspend and conserve free compute hours)

### 🚀 2. Render Cloud Platform (Active Production Services)
- **Render API Key:** `rnd_b9H1FLueMl5n69L3PHSsrHnh2XK9`
- **GitHub Repository:** [https://github.com/Qspanther/prime-dreams](https://github.com/Qspanther/prime-dreams) (Branch: `main`)
- **Active Services Summary:**

| Service Name | Service ID | Role & Directory | Live URL | Health Check |
| :--- | :--- | :--- | :--- | :--- |
| **`prime-dreams`** | `srv-dbo89095efls73d4qesg` | Frontend Next.js Web (`frontend`) | [https://prime-dreams.onrender.com](https://prime-dreams.onrender.com) | `/api/health` |
| **`prime-dreems-backend`** | `srv-dbpmlr3l550s73dqb4q0` | Backend REST API (`backend`) | [https://prime-dreems-backend.onrender.com](https://prime-dreems-backend.onrender.com) | `/health` |
| **`prime-dreems-bot-service`** | `srv-dbsums5g1s2s73895ai0` | Bot Daemon Port 5100 (`backend`) | [https://prime-dreems-bot-service.onrender.com](https://prime-dreems-bot-service.onrender.com) | `/health` |

---

## ⏰ Render Free-Tier 15-Minute Sleep Prevention (Keep-Alive Setup)

Render's free-tier Web Services automatically spin down (sleep) after **15 minutes of inactivity**, causing the next visitor to experience a 30-50 second cold start delay.

To ensure your services run **24/7 without ever sleeping**, the repository includes multiple automated keep-alive options:

### 🌟 Option 1: Automated GitHub Actions Workflow (Zero-Setup & Free 24/7)
This repository contains an automated GitHub Actions cron workflow:
- **Workflow File:** [`.github/workflows/keep-alive.yml`](file:///.github/workflows/keep-alive.yml)
- **Interval:** Runs every **12 minutes** (`*/12 * * * *`)
- **Actions:** Automatically sends HTTP GET requests to:
  1. `https://prime-dreems-backend.onrender.com/health`
  2. `https://prime-dreems-bot-service.onrender.com/health`
  3. `https://prime-dreams.onrender.com`
- **Cost:** 100% Free under GitHub Actions public repo unlimited minutes.
- **Status:** Once pushed to GitHub, it runs automatically in the cloud. You can also trigger it manually from the **Actions** tab on GitHub.

### 🌐 Option 2: Free Cloud Uptime Monitors (UptimeRobot - Recommended)
You can set up a free 5-minute external monitor that guarantees zero cold starts:
1. Create a free account at [UptimeRobot.com](https://uptimerobot.com).
2. Click **Add New Monitor**:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `Prime Dreems Backend`
   - **URL (or IP):** `https://prime-dreems-backend.onrender.com/health`
   - **Monitoring Interval:** `Every 5 minutes`
3. Add a second monitor for Bot Service:
   - **URL:** `https://prime-dreems-bot-service.onrender.com/health`
   - **Monitoring Interval:** `Every 5 minutes`
4. Add a third monitor for Frontend:
   - **URL:** `https://prime-dreams.onrender.com`
   - **Monitoring Interval:** `Every 5 minutes`
5. **Result:** UptimeRobot will ping your services every 5 minutes from around the world. Your Render containers will stay permanently active and fast.

### 💻 Option 3: Local / VPS Keep-Alive Daemon
If you have a local terminal or a VPS running, you can run the included keep-alive daemon:
```powershell
node scripts/keep-alive.js
```
This script pings all 3 services every 10 minutes and logs colored latency stats.

---

## ⚡ Enterprise Scale & Performance Architecture

### 1. Database Optimization & Bot Isolation (`BotTeam`)
- **Isolated Table:** Normal human teams remain in `teams` and `team_players` (1 row per team + 11 rows per player).
- **Compacted Bot Schema:** All autonomous bot teams are stored in `bot_teams`, where the 11-player lineup is stored as a single JSON array `lineup_json`. This reduces write operations on Neon by **91%**.
- **Composite Indexes:**
  - `CREATE INDEX bot_teams_contest_id_match_id ON bot_teams(contest_id, match_id);`
  - `CREATE INDEX bot_teams_match_id ON bot_teams(match_id);`
- **Connection Hygiene:** Connection pool is tuned for transaction mode (`sslmode=require`), preventing Neon free tier connection limits from being exceeded.

### 2. Bot Natural Pacing (1-Hour Rule & Micro-Batches)
- **1-Hour Rule:** The bot target allocation freezes **1 hour before match start time** (`hoursUntilStart <= 1.0`). If a match starts at 7:30 PM, all bot entries complete by 6:30 PM.
- **1-by-1 Micro-Batches:** Bots join contests in randomized single entries (micro-batches) with variable interval jitter (`RANDOM_JITTER_MAX = 5000ms`), completely eliminating bulk dump spikes.
- **Strict Privacy:** Head-to-Head (H2H) and Private Contests remain 100% excluded (0 bots).

### 3. Instant 0ms Page Loading (Stale-While-Revalidate)
- **Frontend SWR Cache (`frontend/app/lib/api.ts`):** Client caches match lists, contest details, and user profiles. Visiting a previously opened tab or page serves cached data in 0ms while refreshing in the background.
- **Backend Redis + Memory Fallback (`backend/cache/redis.js`):** Match fixtures and leaderboard rankings are cached with TTL to eliminate redundant queries.

### 4. Bot Command Center UI (`/admin/bots`)
- Accessible from the Admin sidebar at [https://prime-dreams.onrender.com/admin/bots](https://prime-dreams.onrender.com/admin/bots).
- Live metrics: Total bots, active matches, running status, and manual 1-click trigger controls for test runs.

### 5. Multi-Tier Failover Email OTP Service
- Primary: **Brevo HTTPS Transactional API** (Direct HTTP port 443, immune to SMTP port blocks).
- Secondary: **Nodemailer SMTP** (TLS port 587/465).
- Development Fallback: In development mode, OTP is safely logged to console for immediate test verification.

---

## 🧩 Modular Configuration

The Prime Dreems colosseum is organized into **8 isolated, decoupled modules**:

### 📦 Module 1 — Frontend Core UI & Pages
- Next.js 15 App Router, 3D stadium pitch builder, contest discovery, dynamic leaderboards, and administrative decks.
- Key routes: `/`, `/match/[matchId]`, `/team-builder/[matchId]`, `/wallet`, `/payouts-portal`, `/subscription`, `/admin/bots`, `/admin/tournaments`.

### ⚙️ Module 2 — Backend API Server
- Express REST API server providing user authentication, match scheduling, contest entries, team lineups, leaderboards, wallet operations, and subscriptions.
- Dual-mounting architecture: routes mounted at both `/api/*` and root `/*` to eliminate 404 mismatch errors.

### 📡 Module 3 — Real-Time Streaming & Ingestion
- Real-time cricket data pipeline with Cricbuzz ingestion worker, monotonicity guards, event deduplication, and WebSocket broadcasts (`/ws`).

### 🎯 Module 4 — Fantasy Scoring Engine
- Pure calculation engine converting live match events into fantasy points (Batting, Bowling, Fielding, 2.0x C, 1.5x VC).

### 🤖 Module 5 — Autonomous Bot Network
- 10,000 synthetic cricket managers with 1-Hour Rule pacing, micro-batches with jitter, and 100% prize capture guarantee.

### 🔒 Module 6 — Match Lifecycle & Lock Logic
- Enforces registration deadlines (`start_time - 15 minutes`), live match protection, and status transitions (`upcoming` ➔ `live` ➔ `completed`).

### 💰 Module 7 — Payouts Portal & Wallet Architecture
- Decoupled winnings disbursement (`/payouts-portal`) with UPI/IMPS bank withdrawals and numeric contest ID search (`#2013`).

### 🚀 Module 8 — Deployment & DevOps Infrastructure
- Multi-service cloud deployment blueprints (`render.yaml`), Neon connection pooling, keep-alive automation, and health probes.

---

## 🔒 Tested Live Login Credentials

You can log in directly at the live portal [https://prime-dreams.onrender.com/login](https://prime-dreams.onrender.com/login) using either email or username:

### 👑 1. Admin Account (Full Tournament, Match & Bot Management)
- **Email:** `admin@primedreems.com`
- **Username:** `admin`
- **Password:** `Admin@123`
- **Role:** `admin` (Access to `/admin`, `/admin/bots`, `/admin/tournaments`, and match control deck)
- **Starting Wallet Balance:** ₹5,00,000
- **Status:** Verified (Zero OTP required on direct login)

### 👤 2. Regular User Account (Team Creation, Wallet & Contests)
- **Email:** `user@primedreems.com`
- **Username:** `cricket_user`
- **Password:** `User@123`
- **Role:** `user` (Access to Mega, Battlefield, Mini, and Private contests)
- **Starting Wallet Balance:** ₹50,000
- **Status:** Verified (Zero OTP required on direct login)

### 🏏 3. Testing Pro Player Account
- **Email:** `player@primedreems.com`
- **Username:** `cricket_pro`
- **Password:** `User@123`
- **Role:** `user`
- **Starting Wallet Balance:** ₹1,00,000
- **Status:** Verified

---

## 🚀 Running the Platform Locally

### 1. Backend Server
```powershell
cd "backend"
npm install
node server.js
```
- API Endpoint: `http://localhost:5000`
- Health Check: `http://localhost:5000/health`

### 2. Bot Microservice (Port 5100)
```powershell
cd "backend/bot-service"
npm install
node server.js
```
- Health Check: `http://localhost:5100/health`

### 3. Frontend Web App
```powershell
cd "frontend"
npm install
npm run dev
```
- Web Application: `http://localhost:3000`
- Bot Admin Deck: `http://localhost:3000/admin/bots`

### 4. Keep-Alive Ping Daemon
```powershell
node scripts/keep-alive.js
```
Pings all live production endpoints every 10 minutes to prevent Render sleep.
