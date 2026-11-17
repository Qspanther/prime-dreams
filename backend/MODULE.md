# Module 2: Backend API Server

## Overview
Core REST API server for Prime Dreems built with Node.js and Express. Manages user authentication, match scheduling, contest entries, team lineups, leaderboards, wallets, subscriptions, and administrative operations.

## Owned Files & Directories
- `backend/server.js` (Express entry point, route mounts, health check)
- `backend/routes/auth.js` (Authentication, OTP, sessions, cleanEmail normalization)
- `backend/routes/cricket.js` (Matches, contests, lineups, leaderboards, zero-cash join)
- `backend/routes/wallet.js` (Wallet balance, ledger transactions)
- `backend/routes/subscription.js` (Passes, tiers, team limits per match, referral passes)
- `backend/routes/admin.js` (Match/contest CRUD, verified creation, subscriptions)
- `backend/routes/notifications.js` (User notifications)
- `backend/routes/gamification.js` & `backend/routes/guru.js` (Guru predictions & rewards)
- `backend/routes/config.js` (Public configuration exposure)
- `backend/middleware/` (Auth JWT, admin checks, in-memory cache)
- `backend/db/` (Sequelize models: User, CricketMatch, MatchContest, CricketTeam, TeamPlayer, Wallet, Transaction, Subscription, ReferralLog)

## Managed Sub-Parts
1. **Server setup & /health**: Non-blocking immediate HTTP binding, health probes.
2. **Auth APIs**: Login, register, OTP verification, cleanEmail case-insensitive lookup, JWT auth.
3. **Match APIs**: Upcoming/live/completed match lists, player rosters, squad points.
4. **Contest APIs**: Mega, Multi-Battlefield, Mini, Practice, numeric 4-digit contest ID search.
5. **Team/Lineup APIs**: 11 players, max 7 per country/team, total credits ≤ 105, distinct Captain (2x) & Vice-Captain (1.5x).
6. **Leaderboard API**: Real-time ranks, player breakdowns, comparison endpoints.
7. **Wallet APIs**: INR bucket segregation (deposit, winnings, bonus).
8. **Payouts APIs**: UPI/IMPS withdrawal request endpoints and transaction audit log.
9. **Subscription APIs**: Tier passes (Bronze, Silver, Gold, etc.), validity days, max teams per match restriction.
10. **Referral Pass APIs**: Snapshot-protected promotional passes based on friend referrals.
11. **Private Contest APIs**: Invite code generation, locked on match deadline.
12. **H2H APIs**: 1v1 duels, invitation status, auto-refund on match lock.
13. **Admin APIs**: 6-step match creation wizard, player squad editor, contest manager.
14. **Database layer**: Dual-engine connection pool (Neon PostgreSQL primary, SQLite WAL fallback).
15. **Free-pass entry logic**: Strict zero-cash platform (`entry_fee: 0`), requiring valid tournament pass for team submission.

## Isolation & Boundary Rules
- **DO NOT TOUCH**:
  - `frontend/` (Frontend Core UI & Pages)
  - `backend/ingestion/` (Real-Time Ingestion Engine)
  - `backend/services/scoringEngine.js` (Fantasy Scoring Engine)
  - `backend/bot-service/` (Autonomous Bot Network)
  - `render.yaml` / deployment files
