# Achievement Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a clickable achievement ranking below the full pool leaderboard with competition-style shared positions, counts, and up to three achievement marks per participant.

**Architecture:** Add a safe D1 read in the Cloudflare achievement service, rank its rows with a shared pure function, and expose the result through the existing bootstrap payload. Render a second mobile-friendly card in the full Classification tab while reusing the current participant-summary modal. Vercel continues to build the same Vite frontend and proxy API calls to Cloudflare.

**Tech Stack:** TypeScript, React 18, Vitest, Cloudflare Workers, D1, Vite, Vercel rewrites.

## Global Constraints

- Include every league participant, including participants with zero achievements.
- Exclude the admin because the admin is not a league member.
- Use achievement count descending as the only ranking score.
- Equal counts share competition rank such as `1, 1, 3`.
- Use pool position and then display name only as stable row ordering inside ties.
- Show the ranking only on the full Classification tab, not the home mini-card.
- Show at most three achievement marks per row and open the existing participant summary when selected.
- Keep Cloudflare as the only API/backend and keep Vercel proxying `/api/*` to it.
- Do not modify achievement unlock rules, pool scoring, bonus scoring, or main leaderboard order.

---

### Task 1: Shared achievement ranking rules

**Files:**
- Create: `src/domain/achievementRanking.ts`
- Create: `tests/achievementRanking.test.ts`
- Modify: `src/shared/types.ts`

**Interfaces:**
- Produces: `AchievementLeaderboardRow` with `userId`, `displayName`, `avatarUrl`, `achievementIds`, `achievementCount`, and `rank`.
- Produces: `rankAchievementRows(rows, poolRanks): AchievementLeaderboardRow[]`.
- Consumes: raw participant achievement rows and `Map<string, number>` of current pool positions.

- [ ] **Step 1: Write the failing ranking tests**

Create inputs for counts `[4, 4, 1, 0, 0]`. Assert output ranks `[1, 1, 3, 4, 4]`, zero-count inclusion, deduplicated achievement IDs, and stable ordering by pool rank then display name.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/achievementRanking.test.ts`

Expected: FAIL because `src/domain/achievementRanking.ts` does not exist.

- [ ] **Step 3: Add the shared API type**

Add this interface to `src/shared/types.ts`:

```ts
export interface AchievementLeaderboardRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  achievementIds: AchievementId[];
  achievementCount: number;
  rank: number;
}
```

- [ ] **Step 4: Implement the pure ranker**

Group rows by user, deduplicate non-null achievement IDs, sort by count descending then `poolRanks.get(userId) ?? Number.MAX_SAFE_INTEGER` then Spanish display name, and assign `index + 1` only when the count changes.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- tests/achievementRanking.test.ts`

Expected: PASS with all shared-ranker cases.

- [ ] **Step 6: Commit Task 1**

```powershell
git add src/domain/achievementRanking.ts src/shared/types.ts tests/achievementRanking.test.ts
git commit -m "feat: rank participant achievements"
```

### Task 2: Cloudflare D1 and bootstrap payload

**Files:**
- Modify: `src/server/achievements.ts:20-76`
- Modify: `src/server/api.ts:76-124`
- Modify: `src/client/api.ts:1-24`
- Create: `tests/achievementLeaderboard.test.ts`

**Interfaces:**
- Produces: `safeGetAchievementLeaderboard(env, leagueId?): Promise<AchievementLeaderboardRow[]>`.
- Consumes: `getLeaderboard(env, leagueId)` for stable tie ordering and D1 rows from league members left joined to `user_achievements`.
- Adds: `achievementLeaderboard` to `BootstrapData` and `/api/bootstrap`.

- [ ] **Step 1: Write failing server tests**

Use a fake D1 database to return participant rows with and without achievement IDs and a known pool leaderboard. Assert the safe function returns zero-count participants, correct IDs/counts, and shared ranks; assert a D1 error returns `[]` rather than breaking bootstrap.

- [ ] **Step 2: Verify server test RED**

Run: `npm test -- tests/achievementLeaderboard.test.ts`

Expected: FAIL because `safeGetAchievementLeaderboard` is not exported.

- [ ] **Step 3: Implement the safe D1 read**

Query:

```sql
SELECT u.id AS user_id, u.display_name, u.avatar_url, ua.achievement_id
FROM league_members lm
JOIN users u ON u.id = lm.user_id
LEFT JOIN user_achievements ua
  ON ua.league_id = lm.league_id AND ua.user_id = u.id
WHERE lm.league_id = ?1
ORDER BY u.display_name COLLATE NOCASE, ua.unlocked_at DESC
```

Combine the query with `getLeaderboard`, pass its rank map into `rankAchievementRows`, log failures as `ACHIEVEMENT LEADERBOARD READ ERROR`, and return `[]` on failure.

- [ ] **Step 4: Add the bootstrap field**

Load `safeGetAchievementLeaderboard(env)` in the existing bootstrap `Promise.all`, return it as `achievementLeaderboard`, and add the matching typed field to `BootstrapData`.

- [ ] **Step 5: Verify server tests and TypeScript**

Run: `npm test -- tests/achievementRanking.test.ts tests/achievementLeaderboard.test.ts`

Run: `npm run build`

Expected: tests PASS and TypeScript/Vite exit 0.

- [ ] **Step 6: Commit Task 2**

```powershell
git add src/server/achievements.ts src/server/api.ts src/client/api.ts tests/achievementLeaderboard.test.ts
git commit -m "feat: expose achievement leaderboard"
```

### Task 3: Classification ranking card and deployment verification

**Files:**
- Modify: `src/App.tsx:711-720`
- Modify: `src/App.tsx:1538-1582`
- Modify: `src/styles.css:802-840`
- Modify: `src/styles.css:1682-1715`
- Create: `tests/achievementRankingView.test.tsx`

**Interfaces:**
- Consumes: `data.achievementLeaderboard` and `achievementDefinitionById`.
- Reuses: `UserAvatar` and the existing `onSelectUser(userId)` modal action.
- Produces: `AchievementLeaderboardRows` rendered only below the full Classification leaderboard.

- [ ] **Step 1: Write a failing static-render test**

Render the ranking component with `react-dom/server`. Assert the markup contains `Ranking de logros`, the shared positions, participant names, `4 logros`, `0 logros`, at most three `achievement-mini-mark` elements per row, and button rows carrying the participant IDs.

- [ ] **Step 2: Verify view test RED**

Run: `npm test -- tests/achievementRankingView.test.tsx`

Expected: FAIL because the ranking component is not exported.

- [ ] **Step 3: Implement the ranking card**

Render a second card after the existing full leaderboard. Each button row contains rank, avatar, display name, the first three IDs resolved through `achievementDefinitionById`, and the total. Use `onSelectUser` for clicks. Keep `LeaderboardCard` on the home screen unchanged.

- [ ] **Step 4: Add responsive styles**

Add `.achievement-ranking-card`, `.achievement-board-row`, `.achievement-mini-marks`, `.achievement-mini-mark`, and `.achievement-zero-mark`. Use a grid that fits 320px-wide screens without horizontal scrolling and truncate long names.

- [ ] **Step 5: Verify focused and full tests**

Run: `npm test -- tests/achievementRankingView.test.tsx`

Run: `npm test`

Expected: focused test PASS and complete suite has zero failures.

- [ ] **Step 6: Verify both deployment artifacts**

Run: `npm run build`

Run: `npx wrangler deploy --dry-run --config wrangler.app.toml`

Confirm `vercel.json` still uses `npm run build`, outputs `dist`, and proxies `/api/:path*` to the Cloudflare app Worker.

- [ ] **Step 7: Validate production data read-only before deploy**

Query remote D1 for participant achievement counts and compare them with the locally recomputed ranking. Do not alter achievement rows.

- [ ] **Step 8: Commit Task 3**

```powershell
git add src/App.tsx src/styles.css tests/achievementRankingView.test.tsx
git commit -m "feat: show achievement ranking"
```

- [ ] **Step 9: Deploy and verify both hosts after approval**

Deploy `wrangler.app.toml`, push `main` to trigger Vercel, verify the Cloudflare API returns `achievementLeaderboard`, and wait for the Vercel commit status to reach `success`.
