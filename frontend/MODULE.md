# Module 1: Frontend Core UI & Pages

## Overview
Next.js 15 App Router web application providing the full user-facing and administrative interface for Prime Dreems. Includes real-time match tracking, 3D stadium pitch lineup builder, contest discovery, responsive leaderboards, and administrative controls.

## Owned Files & Directories
- `frontend/app/` (Next.js 15 pages and layouts)
  - `frontend/app/page.tsx` (Home page with Live / Upcoming matches carousel)
  - `frontend/app/match/[matchId]/page.tsx` (Match detail & contest browser)
  - `frontend/app/team-builder/[matchId]/page.tsx` (11-player fantasy squad creation)
  - `frontend/app/match/[matchId]/leaderboard/page.tsx` (Contest leaderboard & team comparison)
  - `frontend/app/subscription/page.tsx` (Tournament passes & referral unlock)
  - `frontend/app/wallet/page.tsx` (Deposit / Bonus / Winnings balances)
  - `frontend/app/payouts-portal/page.tsx` (Unified earnings and withdrawal gateway)
  - `frontend/app/admin/` (Tournaments wizard, Subscriptions, Dashboard)
- `frontend/app/components/` (Reusable components)
  - `frontend/app/components/ui/CricketPitchView.tsx` (Interactive pitch with 2x C / 1.5x VC)
  - `frontend/app/components/ui/TeamLimitModal.tsx` (Subscription & pass limit alerts)
  - `frontend/app/components/ui/CompareTeamModal.tsx` (Side-by-side squad comparison)
  - `frontend/app/components/ContestCard.tsx` (Battlefield, Mega, Mini, Free Pass cards)
- `frontend/app/globals.css` & `frontend/tailwind.config.ts` (Visual identity styling)

## Managed Sub-Parts
1. **Auth Pages**: Login, Register, OTP modals with session management.
2. **Home Page**: Live / Upcoming matches carousel, pass status indicator.
3. **Match Detail Page**: Filter contests by category, show spots left, prize pools.
4. **Team Builder Page**: 11-player selection with credit budget (≤ 105), max 7 per country.
5. **CricketPitchView**: Visual stadium formation, Captain (2x) and Vice-Captain (1.5x) pills.
6. **Role Normalization**: `normalizeRole` mapping across WK (1-4), BAT (3-6), AR (1-4), BOWL (3-6).
7. **Contest Cards UI**: Highlighting Contest ID, Free (Pass) badges, spots progress bar.
8. **H2H Challenge Page**: 1v1 duels against other managers.
9. **Wallet Page**: Balance breakdown with cash-free entry notices.
10. **Subscription Page**: Tiers (Bronze, Silver, Gold), daily validity, team quotas, friend referral unlock.
11. **Payouts Portal Page**: Direct earnings ledger and payout requests.
12. **Leaderboard Page**: Real-time ranks, player points, and side-by-side comparison modal.
13. **Admin Panel**: Dashboard metrics, system configurations.
14. **Admin Tournaments**: 4-step wizard for match creation, squads, and contest templates.
15. **Admin Subscriptions**: Management of tier pricing, validity, and limits.
16. **Brand Rules & Identity**: Royal Blue (`#2563EB`), Emerald Green (`#059669`), Amber (`#D97706`), Jet Black (`#000000`).
17. **Responsive & Mobile UI**: Touch-friendly navigation, mobile drawer, responsive cards.

## Isolation & Boundary Rules
- **DO NOT TOUCH**:
  - `backend/` (All backend API server and routes)
  - `backend/bot-service/` (Bot Network daemons)
  - `render.yaml` (Deployment specifications)
