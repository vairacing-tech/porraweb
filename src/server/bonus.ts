import { getTopScorers, type ScorerRow } from "../domain/topScorers";
import type { Match } from "../shared/types";
import { getMatches, getSquadPlayers } from "./db";
import type { Env } from "./types";

export interface BonusEvaluationResult {
  applied: boolean;
  changed: number;
  evaluated: number;
}

export interface StoredBonusPrediction {
  leagueId: string;
  userId: string;
  championTeamId: string | null;
  runnerUpTeamId: string | null;
  topScorerTeamId: string | null;
  topScorer: string | null;
  points: number;
}

export interface Finalists {
  championTeamId: string;
  runnerUpTeamId: string;
}

export function resolveFinalists(final: Match): Finalists | null {
  if (final.stage !== "FINAL" || final.status !== "finished") return null;

  const winnerSide =
    winnerFromScore(final.penaltyHomeScore, final.penaltyAwayScore) ??
    winnerFromScore(final.extraHomeScore, final.extraAwayScore) ??
    winnerFromScore(final.homeScore, final.awayScore);
  if (!winnerSide) return null;

  return winnerSide === "home"
    ? { championTeamId: final.homeTeam.id, runnerUpTeamId: final.awayTeam.id }
    : { championTeamId: final.awayTeam.id, runnerUpTeamId: final.homeTeam.id };
}

export function isFinalGoalDataComplete(final: Match): boolean {
  const expectedScore = scorePair(final.extraHomeScore, final.extraAwayScore) ?? scorePair(final.homeScore, final.awayScore);
  if (!expectedScore) return false;

  const goals = final.goals || [];
  if (goals.length !== expectedScore.home + expectedScore.away) return false;

  let previousHome = 0;
  let previousAway = 0;
  for (const goal of goals) {
    if (!goal.scorerName || goal.scorerName === "Gol por confirmar") return false;
    const homeDelta = goal.homeScore - previousHome;
    const awayDelta = goal.awayScore - previousAway;
    if (homeDelta < 0 || awayDelta < 0 || homeDelta + awayDelta !== 1) return false;
    previousHome = goal.homeScore;
    previousAway = goal.awayScore;
  }

  return previousHome === expectedScore.home && previousAway === expectedScore.away;
}

export function calculateBonusPoints(
  prediction: StoredBonusPrediction,
  championTeamId: string,
  runnerUpTeamId: string,
  scorerTable: ScorerRow[]
): number {
  const leadingGoals = scorerTable[0]?.goals ?? 0;
  const scorerHit =
    leadingGoals > 0 &&
    scorerTable.some(
      (scorer) =>
        scorer.goals === leadingGoals &&
        scorer.teamId === prediction.topScorerTeamId &&
        scorer.player === prediction.topScorer
    );

  return (
    (prediction.championTeamId === championTeamId ? 10 : 0) +
    (prediction.runnerUpTeamId === runnerUpTeamId ? 5 : 0) +
    (scorerHit ? 5 : 0)
  );
}

export async function evaluateTournamentBonuses(env: Env): Promise<BonusEvaluationResult> {
  const [matches, squadPlayers] = await Promise.all([getMatches(env), getSquadPlayers(env)]);
  const final = matches.find((match) => match.stage === "FINAL");
  if (!final || !isFinalGoalDataComplete(final)) return notApplied();

  const finalists = resolveFinalists(final);
  if (!finalists) return notApplied();

  const scorerTable = getTopScorers(matches, squadPlayers);
  if (scorerTable.length === 0) return notApplied();

  const { results } = await env.DB.prepare(
    `SELECT league_id, user_id, champion_team_id, runner_up_team_id, top_scorer_team_id, top_scorer, points
     FROM bonus_predictions`
  ).all<{
    league_id: string;
    user_id: string;
    champion_team_id: string | null;
    runner_up_team_id: string | null;
    top_scorer_team_id: string | null;
    top_scorer: string | null;
    points: number;
  }>();

  const predictions = results.map<StoredBonusPrediction>((row) => ({
    leagueId: row.league_id,
    userId: row.user_id,
    championTeamId: row.champion_team_id,
    runnerUpTeamId: row.runner_up_team_id,
    topScorerTeamId: row.top_scorer_team_id,
    topScorer: row.top_scorer,
    points: row.points
  }));
  const now = new Date().toISOString();
  const updates = predictions.flatMap((prediction) => {
    const points = calculateBonusPoints(
      prediction,
      finalists.championTeamId,
      finalists.runnerUpTeamId,
      scorerTable
    );
    if (points === prediction.points) return [];
    return [
      env.DB.prepare(
        "UPDATE bonus_predictions SET points = ?1, updated_at = ?2 WHERE league_id = ?3 AND user_id = ?4"
      ).bind(points, now, prediction.leagueId, prediction.userId)
    ];
  });

  if (updates.length > 0) await env.DB.batch(updates);
  return { applied: true, changed: updates.length, evaluated: predictions.length };
}

function winnerFromScore(home: number | null | undefined, away: number | null | undefined): "home" | "away" | null {
  if (home === null || home === undefined || away === null || away === undefined || home === away) return null;
  return home > away ? "home" : "away";
}

function scorePair(home: number | null | undefined, away: number | null | undefined): { home: number; away: number } | null {
  if (home === null || home === undefined || away === null || away === undefined || home < 0 || away < 0) return null;
  return { home, away };
}

function notApplied(): BonusEvaluationResult {
  return { applied: false, changed: 0, evaluated: 0 };
}
