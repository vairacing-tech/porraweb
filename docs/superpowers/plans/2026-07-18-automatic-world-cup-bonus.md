# Automatic World Cup Bonus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically and idempotently award champion, runner-up, and all tied top-scorer bonus points after the fully synchronized World Cup final.

**Architecture:** Move the existing scorer-table calculation into a shared pure domain module used by both React and the Cloudflare backend. Add a server evaluator that gates on a finished and complete final, resolves the decisive winner, recomputes every stored bonus total, and runs after result synchronization and admin final closure. Vercel continues serving the shared Vite frontend and proxying its API to the Cloudflare Worker.

**Tech Stack:** TypeScript, React, Vitest, Cloudflare Workers, D1, Vite, Vercel rewrites.

## Global Constraints

- Do not award any bonus before the final is `finished` and its non-shootout goal timeline is complete and named.
- Resolve the winner using penalties, then extra time, then regulation.
- Award champion 10, runner-up 5, and top scorer 5 points.
- Every player tied at the highest goal count is a winning top scorer.
- Recompute and replace aggregate bonus totals on every eligible run; never increment them.
- Keep Cloudflare as the only API/backend and keep the Vercel frontend proxy pointed at it.
- Do not change ordinary prediction scoring or locking.

---

### Task 1: Shared scorer table

**Files:**
- Create: `src/domain/topScorers.ts`
- Create: `tests/topScorers.test.ts`
- Modify: `src/App.tsx:1996-2068`

**Interfaces:**
- Produces: `getTopScorers(matches: Match[], squadPlayers?: SquadPlayer[]): ScorerRow[]` where `ScorerRow` contains `player`, `teamId`, `teamName`, and `goals`.
- Consumes: existing `Match`, `SquadPlayer`, and goal timeline fields.

- [ ] **Step 1: Write failing shared scorer tests**

Cover canonical squad-name matching, score-transition team inference, own-goal exclusion, provisional-name exclusion, sorting, and tied leaders.

- [ ] **Step 2: Verify the new test fails because the module is missing**

Run: `npm test -- tests/topScorers.test.ts`

Expected: FAIL resolving `src/domain/topScorers.ts`.

- [ ] **Step 3: Implement the shared scorer module**

Move the existing pure calculation and name-normalization helpers from `App.tsx`, add `teamId` to each row, and exclude `Gol por confirmar`.

- [ ] **Step 4: Make React consume the shared module**

Import `getTopScorers` into `App.tsx`, remove its private duplicate, and preserve the current Bonus tab rendering.

- [ ] **Step 5: Verify focused tests pass**

Run: `npm test -- tests/topScorers.test.ts`

Expected: PASS.

### Task 2: Idempotent server bonus evaluation

**Files:**
- Create: `src/server/bonus.ts`
- Create: `tests/bonus.test.ts`

**Interfaces:**
- Produces: `evaluateTournamentBonuses(env: Env): Promise<BonusEvaluationResult>`.
- Produces pure helpers for final readiness, decisive finalist resolution, and per-prediction point calculation.
- Consumes: `getMatches`, `getSquadPlayers`, `getTopScorers`, and `bonus_predictions` rows.

- [ ] **Step 1: Write failing evaluator tests**

Cover scheduled/live finals, incomplete named goal timelines, valid 0-0 finals, regulation/extra-time/penalty winner resolution, combined 20-point maximum, all tied top scorers, correction replacement, and repeated idempotent evaluation.

- [ ] **Step 2: Verify failure for missing evaluator**

Run: `npm test -- tests/bonus.test.ts`

Expected: FAIL resolving `src/server/bonus.ts`.

- [ ] **Step 3: Implement readiness and winner helpers**

Require a `FINAL` match with `finished` status. Validate that goal score transitions are monotonic, end at the extra-time score when present or regulation score otherwise, contain exactly that many goals, and have a real scorer name for every goal. Resolve champion and runner-up from penalty, extra-time, or regulation scores in that order.

- [ ] **Step 4: Implement point calculation**

Use the first shared scorer row's goal count and accept every row tied at that count. Calculate each stored prediction as `(champion hit ? 10 : 0) + (runner-up hit ? 5 : 0) + (tied scorer hit ? 5 : 0)` using canonical player name plus team ID.

- [ ] **Step 5: Persist complete replacement totals**

Read all `bonus_predictions`, build D1 `UPDATE bonus_predictions SET points = ?1, updated_at = ?2 WHERE league_id = ?3 AND user_id = ?4` statements, execute them as one batch, and return applied/changed counts. If readiness fails, execute no updates.

- [ ] **Step 6: Verify evaluator tests pass**

Run: `npm test -- tests/bonus.test.ts`

Expected: PASS.

### Task 3: Cloudflare execution paths and shared frontend verification

**Files:**
- Modify: `src/server/sync.ts:236-286`
- Modify: `src/server/api.ts:245-259`
- Modify: `tests/syncDecision.test.ts` or add focused integration assertions to `tests/bonus.test.ts`
- Verify: `vercel.json`

**Interfaces:**
- Consumes: `evaluateTournamentBonuses(env)` after result persistence.
- Produces: sync messages that report applied bonus evaluation without exposing participant choices.

- [ ] **Step 1: Write failing orchestration tests**

Assert that an eligible completed final invokes bonus evaluation only after result and goal persistence and that an ineligible admin closure remains a safe no-op until a later sync.

- [ ] **Step 2: Verify orchestration test failure**

Run the focused Vitest file and confirm the evaluator is not yet connected.

- [ ] **Step 3: Connect automatic synchronization**

Call the evaluator after OpenLigaDB matches are applied and knockout resolution completes, before achievement evaluation. Include the applied/changed result in the sync message.

- [ ] **Step 4: Connect admin final closure**

Call the same evaluator after `setMatchResult` and `resolveKnockoutMatches`, then evaluate achievements. The evaluator gate prevents premature points when final scorers are unavailable.

- [ ] **Step 5: Verify Cloudflare and Vercel topology**

Confirm `wrangler.app.toml` binds the production D1 database and `vercel.json` still proxies `/api/:path*` to `https://porra-fortilin-app.vairacing.workers.dev/api/:path*`.

- [ ] **Step 6: Run complete verification**

Run: `npm test`

Expected: every test file passes with zero failures.

Run: `npm run build`

Expected: TypeScript and Vite build exit 0. This is the same frontend artifact used for Cloudflare assets and Vercel.

Run: `npx wrangler deploy --dry-run --config wrangler.app.toml`

Expected: Cloudflare Worker bundle validates without deployment.

- [ ] **Step 7: Inspect the final diff and production data read-only**

Run `git diff --check`, verify only planned files changed, and query the remote final/bonus rows without writing. Do not trigger the evaluator against production before the final is finished.
