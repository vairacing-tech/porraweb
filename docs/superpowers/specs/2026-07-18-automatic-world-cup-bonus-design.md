# Automatic World Cup Bonus Design

## Goal

Award all tournament bonus points automatically once the final result and its goal scorers have been fully synchronized, while safely correcting the totals if OpenLigaDB changes the result or scorer data later.

## Scoring rules

- Champion prediction: 10 points.
- Runner-up prediction: 5 points.
- Top-scorer prediction: 5 points.
- If several players share the highest goal total, every tied player counts as a correct top-scorer prediction.
- Own goals do not count toward the scorer table.
- Penalty-shootout goals do not count toward the scorer table.

The three awards are evaluated and published together. The persisted `bonus_predictions.points` value is always replaced with the freshly recomputed total; it is never incremented.

## Activation gate

Bonus evaluation must not publish points until all of these conditions are true:

1. The tournament final exists and has status `finished`.
2. The final has enough decisive score data to identify champion and runner-up.
3. OpenLigaDB scorer data for the final has been synchronized into its goal timeline.
4. The final goal timeline contains no unnamed or provisional goals such as `Gol por confirmar`.

A finished 0-0 final with a complete empty goal timeline is valid. The winner must then be resolved from extra-time or penalty-shootout scores.

If any gate fails, the evaluator must leave every existing bonus total unchanged. This prevents a manual result closure from publishing partial bonus points before OpenLigaDB supplies the final scorer data.

## Winner resolution

The final winner is selected from the decisive result in this order:

1. Penalty-shootout score, when present and non-drawn.
2. Extra-time score, when present and non-drawn.
3. Regulation score, when non-drawn.

The opposite finalist is the runner-up. A finished final with no decisive winner is treated as incomplete and does not activate bonus evaluation.

## Scorer source of truth

The Bonus tab and server evaluator must use the same shared scorer-table function. The current client-only `getTopScorers()` logic will move from `src/App.tsx` into a shared domain module.

That function:

- reads the stored goal timelines for every tournament match;
- infers the scoring team from each score transition;
- ignores own goals;
- uses the canonical scorer names already normalized against `squad_players` during synchronization;
- groups by canonical player and team;
- sorts by goal total descending and player name ascending.

The evaluator takes every entry whose goal count equals the first entry's count. A participant receives the scorer bonus when the stored team and canonical player name match any of those tied leaders. The stored player ID remains useful for editing and validation, but canonical team plus name is the cross-provider scoring identity because match goal events do not contain squad player IDs.

## Execution flow

The server exposes one idempotent bonus-evaluation operation.

Automatic synchronization runs in this order:

1. Fetch and parse the latest OpenLigaDB results and goal timelines.
2. Persist the final status, decisive scores, and canonicalized final goals.
3. Recalculate ordinary match predictions.
4. Evaluate and persist every participant's complete bonus total.
5. Re-evaluate achievements against the updated leaderboard.

The admin result endpoint invokes the same evaluator after saving a final result. If scorer synchronization is incomplete, the activation gate makes this a no-op; a later automatic sync completes the evaluation.

Every subsequent synchronization invokes the evaluator again. Corrections to champion, runner-up, or scorer totals therefore replace stale bonus points without duplication.

## Failure behavior and observability

- Missing or incomplete final data is a normal no-op, not an error.
- Database failures are propagated so the sync run cannot report a successful bonus update that was not persisted.
- The evaluator returns a small result describing whether it applied points and how many bonus rows changed. Sync messages can include this information without exposing participant predictions.
- No schema migration is required because `bonus_predictions.points` already stores the aggregate bonus total.

## Testing

Tests will cover:

- no evaluation before the final is finished;
- no evaluation when final goal data is incomplete;
- a valid scoreless final resolved in extra time or penalties;
- champion resolution in regulation, extra time, and penalties;
- champion, runner-up, and scorer points being combined correctly;
- two or more tied leading scorers all counting as correct;
- own goals and shootout kicks not entering the scorer table;
- repeated evaluation producing the same totals;
- later result or scorer corrections replacing previous totals;
- the Bonus tab continuing to render the same shared scorer ordering;
- the full test suite and production build succeeding.

## Scope

This change does not alter ordinary match scoring, prediction locking, the existing bonus choices, or the visible point values. It does not introduce a separate scheduled worker or new database tables.
