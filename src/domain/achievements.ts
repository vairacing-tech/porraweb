import type { AchievementId, MatchStage, MatchStatus, PredictionOutcome } from "../shared/types";

export interface AchievementParticipant {
  userId: string;
  isAdmin: boolean;
  joinedAt: string;
}

export interface AchievementPrediction {
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  points: number;
  outcome: PredictionOutcome;
  createdAt: string;
  updatedAt: string;
  kickoffAt: string;
  lockAt: string;
  status: MatchStatus;
  stage: MatchStage;
  matchday: number | null;
  isDoublePoints: boolean;
  homeTeamId: string;
  awayTeamId: string;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
}

export interface AchievementMatch {
  id: string;
  kickoffAt: string;
  lockAt: string;
  status: MatchStatus;
}

export interface AchievementLeaderboardRow {
  userId: string;
  points: number;
  exacts: number;
  rank: number;
}

export interface AchievementUnlock {
  userId: string;
  achievementId: AchievementId;
  metadata: Record<string, unknown>;
}

export interface AchievementEvaluationInput {
  participants: AchievementParticipant[];
  predictions: AchievementPrediction[];
  matches: AchievementMatch[];
  leaderboard: AchievementLeaderboardRow[];
  finalFinished: boolean;
  now: Date;
}

const spainTeamId = "espana";

export function evaluateAchievementUnlocks(input: AchievementEvaluationInput): AchievementUnlock[] {
  const participants = input.participants.filter((participant) => !participant.isAdmin);
  const participantIds = new Set(participants.map((participant) => participant.userId));
  const unlocks = new Map<string, AchievementUnlock>();
  const predictionsByUser = groupPredictions(input.predictions.filter((prediction) => participantIds.has(prediction.userId)));
  const finalLeaderboard = input.leaderboard.filter((row) => participantIds.has(row.userId));
  const relevantMatches = input.matches.filter((match) => isRelevantLockedMatch(match, input.now));

  for (const participant of participants) {
    const userId = participant.userId;
    const predictions = predictionsByUser.get(userId) ?? [];
    const locked = predictions.filter((prediction) => isLockedPrediction(prediction, input.now));
    const finished = predictions
      .filter((prediction) => prediction.status === "finished")
      .sort((left, right) => new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime());

    if (hasConsecutiveMisses(finished, 5)) {
      addUnlock(unlocks, userId, "visionario_desastre", { streak: 5 });
    }

    const trendCount = finished.filter((prediction) => prediction.outcome === "trend").length;
    const exactCount = finished.filter((prediction) => prediction.outcome === "exact").length;
    if (trendCount >= 5 && exactCount === 0) {
      addUnlock(unlocks, userId, "nostradamus_aliexpress", { trends: trendCount, exacts: exactCount });
    }

    const barScoreCount = finished.filter((prediction) => isTwoOneEitherWay(prediction)).length;
    if (barScoreCount >= 6) {
      addUnlock(unlocks, userId, "analista_de_bar", { scoreCount: barScoreCount });
    }

    const zeroPointCount = finished.filter((prediction) => prediction.points === 0).length;
    if (zeroPointCount >= 3) {
      addUnlock(unlocks, userId, "cementerio_de_puntos", { zeroPointCount });
    }

    if (predictions.some((prediction) => isLockedSpainLossPrediction(prediction, input.now))) {
      addUnlock(unlocks, userId, "antipatriota_estadistico", {});
    }

    const zeroZeroCount = locked.filter((prediction) => prediction.homeScore === 0 && prediction.awayScore === 0).length;
    if (zeroZeroCount >= 4) {
      addUnlock(unlocks, userId, "arquitecto_del_cero_cero", { count: zeroZeroCount });
    }

    const drawCount = locked.filter((prediction) => prediction.homeScore === prediction.awayScore).length;
    if (drawCount >= 6) {
      addUnlock(unlocks, userId, "funcionario_del_empate", { count: drawCount });
    }

    const oneGoalMissCount = finished.filter((prediction) => isOneGoalMiss(prediction)).length;
    if (oneGoalMissCount >= 5) {
      addUnlock(unlocks, userId, "el_var_te_odia", { count: oneGoalMissCount });
    }

    const exactsByGroupMatchday = groupExactGroupPredictionsByMatchday(finished);
    for (const [matchday, count] of exactsByGroupMatchday) {
      if (count >= 3) {
        addUnlock(unlocks, userId, "mano_rota", { matchday, exacts: count });
        break;
      }
    }

    if (finished.some((prediction) => prediction.isDoublePoints && prediction.points === 0)) {
      addUnlock(unlocks, userId, "doble_o_nada_pero_nada", {});
    }

    if (locked.some((prediction) => isLastMinutePrediction(prediction))) {
      addUnlock(unlocks, userId, "ultima_hora_fc", {});
    }

    if (hasMissedSavedPrediction(participant, predictions, relevantMatches)) {
      addUnlock(unlocks, userId, "boton_de_guardar_desconocido", {});
    }
  }

  addLeaderboardUnlocks(unlocks, finalLeaderboard, input.finalFinished);

  return [...unlocks.values()];
}

function addLeaderboardUnlocks(unlocks: Map<string, AchievementUnlock>, leaderboard: AchievementLeaderboardRow[], finalFinished: boolean): void {
  if (leaderboard.length === 0) return;

  const sorted = [...leaderboard].sort((left, right) => right.points - left.points || right.exacts - left.exacts || left.rank - right.rank);
  const maxPoints = sorted[0]?.points ?? 0;
  if (maxPoints > 0) {
    for (const row of sorted.filter((candidate) => candidate.points === maxPoints)) {
      addUnlock(unlocks, row.userId, "rey_del_barro", { points: row.points });
    }
  }

  const second = sorted[1];
  if (sorted.length >= 2 && maxPoints > 0 && second && sorted[0].points >= second.points + 5) {
    addUnlock(unlocks, sorted[0].userId, "dictador_de_la_tabla", { points: sorted[0].points, gap: sorted[0].points - second.points });
  }

  if (!finalFinished) return;

  const minPoints = sorted[sorted.length - 1]?.points ?? 0;
  for (const row of sorted.filter((candidate) => candidate.points === maxPoints)) {
    addUnlock(unlocks, row.userId, "campeon_con_asterisco", { points: row.points });
  }
  for (const row of sorted.filter((candidate) => candidate.points === minPoints)) {
    addUnlock(unlocks, row.userId, "zurullo_de_oro", { points: row.points });
  }
}

function hasConsecutiveMisses(predictions: AchievementPrediction[], target: number): boolean {
  let streak = 0;
  for (const prediction of predictions) {
    if (prediction.outcome === "miss") {
      streak += 1;
      if (streak >= target) return true;
    } else {
      streak = 0;
    }
  }
  return false;
}

function isTwoOneEitherWay(prediction: AchievementPrediction): boolean {
  return (
    (prediction.homeScore === 2 && prediction.awayScore === 1) ||
    (prediction.homeScore === 1 && prediction.awayScore === 2)
  );
}

function isLockedSpainLossPrediction(prediction: AchievementPrediction, now: Date): boolean {
  if (new Date(prediction.lockAt).getTime() > now.getTime()) return false;
  if (prediction.homeTeamId === spainTeamId) return prediction.homeScore < prediction.awayScore;
  if (prediction.awayTeamId === spainTeamId) return prediction.awayScore < prediction.homeScore;
  return false;
}

function isLockedPrediction(prediction: AchievementPrediction, now: Date): boolean {
  return prediction.status === "finished" || prediction.status === "live" || new Date(prediction.lockAt).getTime() <= now.getTime();
}

function isRelevantLockedMatch(match: AchievementMatch, now: Date): boolean {
  if (match.status === "cancelled" || match.status === "postponed") return false;
  return match.status === "finished" || match.status === "live" || new Date(match.lockAt).getTime() <= now.getTime();
}

function isOneGoalMiss(prediction: AchievementPrediction): boolean {
  if (prediction.outcome !== "miss") return false;
  if (prediction.actualHomeScore === null || prediction.actualAwayScore === null) return false;
  return Math.abs(prediction.homeScore - prediction.actualHomeScore) + Math.abs(prediction.awayScore - prediction.actualAwayScore) === 1;
}

function groupExactGroupPredictionsByMatchday(predictions: AchievementPrediction[]): Map<number, number> {
  const grouped = new Map<number, number>();
  for (const prediction of predictions) {
    if (prediction.stage !== "GROUP" || prediction.outcome !== "exact" || prediction.matchday === null) continue;
    grouped.set(prediction.matchday, (grouped.get(prediction.matchday) ?? 0) + 1);
  }
  return grouped;
}

function isLastMinutePrediction(prediction: AchievementPrediction): boolean {
  const lockTime = new Date(prediction.lockAt).getTime();
  const createdDistance = lockTime - new Date(prediction.createdAt).getTime();
  const updatedDistance = lockTime - new Date(prediction.updatedAt).getTime();
  const thresholdMs = 15 * 60 * 1000;
  return (createdDistance >= 0 && createdDistance <= thresholdMs) || (updatedDistance >= 0 && updatedDistance <= thresholdMs);
}

function hasMissedSavedPrediction(
  participant: AchievementParticipant,
  predictions: AchievementPrediction[],
  matches: AchievementMatch[]
): boolean {
  const joinedAt = new Date(participant.joinedAt).getTime();
  const predictedMatchIds = new Set(predictions.map((prediction) => prediction.matchId));
  return matches.some((match) => new Date(match.lockAt).getTime() >= joinedAt && !predictedMatchIds.has(match.id));
}

function groupPredictions(predictions: AchievementPrediction[]): Map<string, AchievementPrediction[]> {
  const grouped = new Map<string, AchievementPrediction[]>();
  for (const prediction of predictions) {
    const list = grouped.get(prediction.userId) ?? [];
    list.push(prediction);
    grouped.set(prediction.userId, list);
  }
  return grouped;
}

function addUnlock(
  unlocks: Map<string, AchievementUnlock>,
  userId: string,
  achievementId: AchievementId,
  metadata: Record<string, unknown>
): void {
  unlocks.set(`${userId}:${achievementId}`, { userId, achievementId, metadata });
}
