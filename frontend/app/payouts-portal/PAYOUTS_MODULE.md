# Module 7: Payouts Portal & Decoupled Wallet Architecture

## Overview
Decoupled financial and winnings disbursement architecture. Separates pure fantasy gameplay (Prime Dreems main colosseum, 100% free pass-based) from prize pool distribution, withdrawal processing, and prize verification.

## Owned Files & Directories
- `frontend/app/payouts-portal/page.tsx` (Decoupled payouts dashboard & verification)
- `frontend/app/wallet/page.tsx` (Deposit, Bonus, and Winnings ledger display)
- `backend/routes/wallet.js` (Wallet balance, transaction history, withdrawal requests)

## Managed Sub-Parts
1. **Unified Authentication**: Single sign-on using the user's existing Prime Dreems account credentials without separate registration.
2. **Winnings Balance & Lifetime Earnings**: Real-time display of accumulated contest prizes, available balance, and pending payouts.
3. **UPI & IMPS Withdrawal Requests**: Secure withdrawal requests validated against minimum withdrawal thresholds (₹100) and available winnings balance.
4. **Transaction Ledger**: Complete chronological history of contest wins, entry refunds, and withdrawal disbursements.
5. **Numeric Contest ID Search**: Universal search by 4-digit contest ID to inspect total prize pool, spots, rank distribution ladder, and winners.
6. **"My Joined Contests & Prize Verification"**: Tab showing every contest entered by the user, their final rank, points, and verified prize won.
7. **Cash-Free Platform Compliance**: Complete removal of real-money contest entry fees on the main platform (`entry_fee: 0`), utilizing subscription/referral passes.
8. **Wallet Bucket Isolation**: Strict internal accounting split between Deposit, Bonus, and Winnings.

## Isolation & Boundary Rules
- **DO NOT TOUCH**:
  - `backend/bot-service/` (Bot Network)
  - `backend/ingestion/` (Cricbuzz scrapers)
  - `backend/services/scoringEngine.js` (Scoring Engine)
