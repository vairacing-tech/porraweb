import type { MatchStage, PredictionOutcome } from "../shared/types";

export interface ScoreInput {
  homeScore: number;
  awayScore: number;
}

export interface MatchResult extends ScoreInput {
  stage: MatchStage;
  isDoublePoints?: boolean;
  penaltyHomeScore?: number | null;
  penaltyAwayScore?: number | null;
}

export interface ScoreResult {
  points: number;
  outcome: PredictionOutcome;
}

const knockoutStages: MatchStage[] = [
  "ROUND_OF_32",
  "ROUND_OF_16",
  "QUARTER_FINAL",
  "SEMI_FINAL",
  "THIRD_PLACE",
  "FINAL"
];

export function isKnockoutStage(stage: MatchStage): boolean {
  return knockoutStages.includes(stage);
}

export function isPredictionLocked(kickoffAt: string, now = new Date()): boolean {
  return now.getTime() >= new Date(kickoffAt).getTime() - 2 * 60 * 60 * 1000;
}

export function getLockAt(kickoffAt: string): string {
  return new Date(new Date(kickoffAt).getTime() - 2 * 60 * 60 * 1000).toISOString();
}

export function validatePrediction(stage: MatchStage, prediction: ScoreInput): string | null {
  if (!Number.isInteger(prediction.homeScore) || !Number.isInteger(prediction.awayScore)) {
    return "Los goles deben ser numeros enteros.";
  }

  if (prediction.homeScore < 0 || prediction.awayScore < 0 || prediction.homeScore > 20 || prediction.awayScore > 20) {
    return "El marcador debe estar entre 0 y 20 goles.";
  }

  if (isKnockoutStage(stage) && prediction.homeScore === prediction.awayScore) {
    return "En eliminatorias no se permiten empates.";
  }

  return null;
}

export function scorePrediction(prediction: ScoreInput, result: MatchResult): ScoreResult {
  const multiplier = result.isDoublePoints ? 2 : 1;

  if (prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore) {
    return { points: 3 * multiplier, outcome: "exact" };
  }

  if (getTrend(prediction) === getTrend(result)) {
    return { points: 1 * multiplier, outcome: "trend" };
  }

  return { points: 0, outcome: "miss" };
}

export function getTrend(score: ScoreInput): "home" | "away" | "draw" {
  if (score.homeScore > score.awayScore) return "home";
  if (score.homeScore < score.awayScore) return "away";
  return "draw";
}
