# Final achievement-ranking fixes

## Delivered

- `fetchBootstrap` now defaults a missing `achievementLeaderboard` response field to `[]`.
- The achievement ranking shows `El ranking de logros no está disponible todavía.` when the main leaderboard has participants but the achievement leaderboard is unavailable.
- When both leaderboards are empty, the existing `Aún no hay participantes.` state remains.
- Added bootstrap client normalization coverage, `handleApi` bootstrap serialization coverage, and a JSDOM click test that verifies the selected participant id.

## TDD evidence

The new focused tests were run before the implementation. They failed because the client returned no fallback and `LeaderboardView` did not expose the required behavior. After the minimal implementation, the focused command passed: 6 tests in 3 files.

## Verification

- `npm test`: 15 files, 69 tests passed.
- `npm run build`: TypeScript and Vite production build passed.

## Notes

- JSDOM was added as a development dependency to run a real mounted-DOM click test.
- The existing OpenLigaDB configuration-warning test logs its expected diagnostic during the full suite.
