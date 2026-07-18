import { safeEvaluateAchievements } from "./achievements";
import { evaluateTournamentBonuses, type BonusEvaluationResult } from "./bonus";
import type { Env } from "./types";

export async function runPostResultEvaluation(env: Env): Promise<BonusEvaluationResult> {
  const bonusResult = await evaluateTournamentBonuses(env);
  await safeEvaluateAchievements(env);
  return bonusResult;
}
