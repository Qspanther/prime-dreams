# 🐘 Prime Dreems — SQLite to Neon PostgreSQL Migration Guide

This guide explains how to migrate all existing platform tables, matches, teams, wallets, and user records from the local SQLite database (`primedreems.sqlite`) to your **Neon Free Serverless PostgreSQL** database.

---

## 📋 Overview of Migration Capabilities

The migration script (`backend/scripts/migrate-sqlite-to-neon.js`) is designed with the following safety and performance features:
1. **Dynamic Table Discovery**: Automatically scans SQLite's `sqlite_master` catalog and transfers all tables in topological foreign key dependency order.
2. **Batched Inserts**: Migrates records in batches of 500 rows to avoid memory spikes and payload timeouts.
3. **Idempotency (`ON CONFLICT DO NOTHING`)**: Safe to rerun multiple times without duplicating data or breaking primary key constraints.
4. **Index Preservation**: Reconstructs all WAL-mode performance indexes into PostgreSQL native B-Tree indexes.
5. **Data Type Normalization**: Formats SQLite integers into proper PostgreSQL booleans and JSON structures.

---

## 🚀 Step-by-Step Migration Execution

### Step 1: Set Your Neon Database Connection String
Ensure your `DATABASE_URL` is set in `backend/.env` or export it in your shell. Use the **pooled** connection string with SSL:

```bash
# Windows PowerShell:
$env:DATABASE_URL="postgresql://neondb_owner:<password>@<ep-hostname>-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"

# Linux / macOS:
export DATABASE_URL="postgresql://neondb_owner:<password>@<ep-hostname>-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
```

### Step 2: Ensure Node Dependencies are Installed
From the `backend/` directory:
```bash
cd backend
npm install
```

### Step 3: Run the Migration Script
Run the automated migration runner:
```bash
node scripts/migrate-sqlite-to-neon.js
```

### Expected Output:
```text
🚀 [Migration] Starting SQLite -> Neon PostgreSQL Migration...
📂 Source: C:\Users\abbu\Documents\Prime dreems\backend\primedreems.sqlite
🐘 Target: Neon PostgreSQL (DATABASE_URL configured)
🔌 Connected to Neon PostgreSQL!
📋 Found 19 tables in SQLite: system_settings, users, wallets, cricket_matches, cricket_players, match_contests, cricket_teams...

📦 Migrating [system_settings]: 12 rows...
✅ [system_settings] Migration step complete (12 rows processed).

📦 Migrating [users]: 10005 rows...
  ⏳ Processed 10005/10005 rows...
✅ [users] Migration step complete (10005 rows processed).

📦 Migrating [cricket_matches]: 28 rows...
✅ [cricket_matches] Migration step complete (28 rows processed).

⚡ Creating and verifying PostgreSQL indexes...
✅ All PostgreSQL performance indexes verified!

🎉 SQLite to Neon PostgreSQL migration finished successfully!
```

---

## 🔍 Step 4: Verification of PostgreSQL Data

Verify record counts on Neon PostgreSQL using `psql` or the Neon SQL Editor:

```sql
-- Check total users and realistic Indian bots
SELECT is_bot, count(*) FROM users GROUP BY is_bot;

-- Check active cricket matches
SELECT id, title, category, status FROM cricket_matches ORDER BY start_time ASC LIMIT 10;

-- Check contests & prize pools
SELECT id, title, entry_fee, prize_pool, total_spots, filled_spots FROM match_contests LIMIT 10;

-- Check wallet ledger balance
SELECT count(*) AS total_wallets, SUM(balance) AS total_user_balance FROM wallets;
```

---

## 🛡️ Tables Migrated in Order

| Order | Table Name | Purpose |
|-------|------------|---------|
| 1 | `system_settings` | Platform runtime toggles, scoring weights, uploaded media assets |
| 2 | `users` | Admin accounts, human players, and realistic bot network |
| 3 | `wallets` | Coin balances, bonus cash, deposit balances |
| 4 | `transactions` | Entry fee deductions, prize payouts, ledger history |
| 5 | `notifications` | In-app alerts, H2H challenge invite updates |
| 6 | `cricket_matches` | Fixtures, squad pools, live scores, telemetry |
| 7 | `cricket_players` | 30-man squad player profiles, credits, roles |
| 8 | `match_contests` | Mega, Battlefield, Mini, and Practice contests |
| 9 | `cricket_teams` | Fantasy 11 user lineups, captain & vice-captain selections |
| 10 | `team_players` | Player roster mapping per fantasy team |
| 11 | `h2h_challenges` | 1v1 Head-to-Head duel records & invite codes |
| 12 | `guru_teams` | Expert lineups available for 1-click copy |
| 13 | `bot_win_history` | Historical fair-rotation win records |
| 14 | `player_points_logs` | Ball-by-ball fantasy point audit trail |
| 15 | `score_audit_logs` | Scorecard verification logs |
| 16 | `user_rewards` | Daily login rewards, streaks, referrals |
| 17 | `referral_logs` | User referral invitation tree |
| 18 | `share_logs` | Social share logs and bonus credits |
| 19 | `push_subscriptions`| Web push notification subscription tokens |
