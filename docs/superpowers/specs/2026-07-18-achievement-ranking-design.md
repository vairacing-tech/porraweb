# Achievement Ranking Design

## Goal

Add a compact achievement ranking below the main pool leaderboard so every participant can compare how many achievements they have unlocked and open the existing participant summary for full details.

## Data source

Cloudflare remains the only backend for both the Cloudflare-hosted app and the Vercel frontend replica. The bootstrap response will include a new `achievementLeaderboard` collection generated from D1.

The query must:

- start from the fixed league membership so every participant appears;
- exclude the admin because the admin is not a league member;
- left join `user_achievements` so participants with zero achievements remain visible;
- return user ID, display name, avatar, unlocked achievement IDs, and total count;
- use the current pool leaderboard order as the stable secondary ordering inside achievement-count ties, followed by display name.

Achievement definitions, names, and icons remain frontend/shared catalog data. The API only needs to return achievement IDs rather than duplicating descriptions or metadata.

## Ranking rules

- Primary score: number of unlocked achievements, descending.
- Equal counts share competition rank: `1, 1, 3` rather than `1, 2, 3` or dense `1, 1, 2`.
- Pool position and display name only stabilize row order inside a tie; they never break the shared achievement rank.
- Participants with zero achievements are included and share the corresponding rank.

## API shape

Each bootstrap row will expose:

```ts
interface AchievementLeaderboardRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  achievementIds: AchievementId[];
  achievementCount: number;
  rank: number;
}
```

The backend will provide a safe read wrapper consistent with existing achievement reads. If achievement ranking retrieval fails, bootstrap remains available and returns an empty ranking while logging the error.

## User interface

The full Classification tab keeps the existing pool leaderboard first. Directly below it, a second card titled `Ranking de logros` displays the achievement ranking.

Each row contains:

- shared achievement rank;
- participant avatar;
- display name;
- up to three compact achievement marks resolved from the shared catalog;
- total achievement count.

Rows are buttons and reuse the existing participant-summary action. Selecting a row opens the same modal that already shows the participant's complete achievement list and recent closed predictions.

When a participant has no unlocked achievements, the icon area shows a muted placeholder while the total displays `0`. If the whole ranking cannot be loaded, the card shows a concise unavailable/empty state without affecting the main leaderboard.

The compact home-screen leaderboard is unchanged; the achievement ranking appears only on the full Classification tab.

## Styling and responsiveness

The ranking will follow the existing card, avatar, rank, and button-row visual language. Achievement marks must remain compact enough for narrow mobile screens. The row grid will reserve space for three icons and collapse gracefully without horizontal scrolling.

## Testing

Tests will cover:

- participants with zero achievements;
- unlocked achievement IDs and totals;
- competition ranks such as `1, 1, 3`;
- stable tie ordering by current pool position and name;
- safe behavior when the achievement query fails;
- bootstrap serialization of `achievementLeaderboard`;
- frontend rendering of count, up to three marks, zero state, and click-through behavior;
- full Vitest suite and Vite/Cloudflare builds.

## Deployment topology

The Cloudflare app Worker and sync-independent API code are deployed from the same repository. Vercel builds the same Vite frontend and proxies `/api/*` to `https://porra-fortilin-app.vairacing.workers.dev`. No Vercel server function or additional database is introduced.

## Scope

This change does not modify achievement unlock conditions, pool scoring, bonus scoring, the main leaderboard order, participant summaries, or the home-screen compact leaderboard.
