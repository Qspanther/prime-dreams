# Module 4: Fantasy Scoring Engine

## Overview
Pure calculation engine for converting live cricket events and ball-by-ball statistics into fantasy points. Ensures deterministic calculations, captain/vice-captain multipliers, audit logging, and leaderboard points sync.

## Owned Files
- `backend/services/scoring/scoringEngine.js` (Pure points formulas, audit logger, multiplier engine)

## Managed Sub-Parts
1. **Batting Points**:
   - Run: +1 pt
   - Boundary (Four): +1 bonus pt
   - Six: +2 bonus pts
   - Half-Century (50+ runs): +8 pts
   - Century (100+ runs): +16 pts
   - Duck: -2 pts (for BAT, WK, AR)
   - Strike Rate Bonuses: (SR > 170: +6, 150-170: +4, 60-70: -2, < 60: -4)
2. **Bowling Points**:
   - Wicket: +25 pts
   - 4-Wicket Haul: +8 pts
   - 5-Wicket Haul: +16 pts
   - Maiden Over: +12 pts
   - Economy Rate Bonuses: (< 5: +6, 5-6: +4, 9-10: -2, > 10: -4)
3. **Fielding Points**:
   - Catch: +8 pts (3+ catches bonus: +4 pts)
   - Stumping: +12 pts
   - Run-out (Direct hit): +12 pts
   - Run-out (Thrower/Catcher): +6 pts
4. **Multipliers**:
   - Captain (C): 2.0x total points
   - Vice-Captain (VC): 1.5x total points
5. **Live Points Update**: Ingestion pipeline emits `POINTS_UPDATE` events over WebSocket gateway whenever ball actions modify player totals.

## Isolation & Boundary Rules
- **DO NOT TOUCH**:
  - `frontend/` (Frontend UI)
  - `backend/bot-service/` (Bot Network)
  - `backend/ingestion/` (Cricbuzz scrapers)
