# Module 5: Autonomous Bot Network & Tactical Coordinator

## Overview
Autonomous, fair-rotating bot network managing 10,000 synthetic cricket managers. Simulates organic human join behavior over a 72-hour window, enforces valid Dream11 squad constraints, isolates private/H2H duels, executes death-stage tactical lineup swaps, and guarantees 100% prize position capture.

## Owned Files & Directories
- `backend/services/botScheduler.js` (72-hour organic joins, poll intervals, match discovery)
- `backend/services/botManagerBot.js` (ManagerBot phase coordinator, round-off jitter, squad replacer)
- `backend/services/seed-10000-bots.js` (10,000 bot generator & seeder)
- `backend/routes/bot-manager.js` (Bot management API endpoints and CLI functions)
- `backend/bot-service/` (Isolated Render service runner on port 5100)

## Managed Sub-Parts
1. **Bot Seeding**: Pre-seeded database of 10,000 realistic cricket fantasy users with unique usernames and avatars.
2. **Standby Mode (> 72h)**: Matches more than 72 hours away remain in standby without artificial activity.
3. **72-Hour Alert Trigger**: System fires activation alert when an upcoming match crosses into the 72-hour window.
4. **Organic Staggered Deployment**: Micro-batch joins (with natural jitter) scaling from 0% up to 100% of requested target spots before match start.
5. **Valid Team Composition**: 11 players, 1-4 WK, 3-6 BAT, 1-4 AR, 3-6 BOWL, max 7 per country, credits ≤ 105.
6. **Contest Protection**:
   - Private contests & H2H duels: Strictly 0 bots (100% human-only).
   - Mega, Multi-Battlefield, Mini: Guaranteed quotas with automatic room clone fill.
7. **Multi-Entry Engine**: Allows bots to generate multiple teams (`T2`, `T3`...) with distinct valid lineups to meet large contest quotas (e.g. 10,000 spots).
8. **ManagerBot Phase Coordinator**: Dynamic phases (Phase 1: Rank 1-50, Phase 2: Rank 51-100...).
9. **Anti-Monopoly Fair History Rotation**: Weighted historical rotation via `bot_win_histories` so every bot cycles through phases.
10. **Death-Stage Lineup Swap (Last 6-10 Balls)**: Tactical rearrangement replacing underperformers with top scorers of the match, assigning top earners as Captain (2x) and Vice-Captain (1.5x).
11. **Round-Off Jitter Engine**: ±1 or ±2 rank shifts to emulate authentic fantasy point margins.
12. **Guaranteed Human Isolation & 100% Prize Capture**:
   $$\text{Human Rank} = \max(\text{Total Bots}, \text{Max Prize Rank}) + 1 + \text{index}$$
   Guarantees no human manager ever captures a prize in public contests.
13. **Post-Match 6-Tier Placement**: Post-match finalization and leaderboard lockdown.
14. **Anti-Monopoly Winner Rotation**: Ensures rotation across top ranks across tournaments.
15. **Bot Manager CLI**: Admin CLI commands to seed, trigger, or query bot stats.
16. **Bot API Endpoints**: Protected `/bot-manager/` endpoints with timing-safe API keys.

## Isolation & Boundary Rules
- **DO NOT TOUCH**:
  - `frontend/` (Frontend UI)
  - `backend/ingestion/` (Cricbuzz scrapers)
  - `render.yaml` (Deployment blueprints)
