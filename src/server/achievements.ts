import { evaluateAchievementUnlocks, type AchievementLeaderboardRow, type AchievementMatch, type AchievementParticipant, type AchievementPrediction } from "../domain/achievements";
import { getAchievementDefinition } from "../shared/achievements";
import type { AchievementId, PredictionOutcome, UserAchievement } from "../shared/types";
import type { Env } from "./types";

type AchievementRow = {
  achievement_id: AchievementId;
  unlocked_at: string;
  metadata_json: string | null;
};

export async function safeEvaluateAchievements(env: Env, leagueId = "fortilin"): Promise<void> {
  try {
    await evaluateAndPersistAchievements(env, leagueId);
  } catch (error) {
    console.error("ACHIEVEMENT EVALUATION ERROR", error);
  }
}

export async function safeGetUserAchievements(env: Env, userId: string, leagueId = "fortilin"): Promise<UserAchievement[]> {
  try {
    return await getUserAchievements(env, userId, leagueId);
  } catch (error) {
    console.error("ACHIEVEMENT READ ERROR", { userId, error });
    return [];
  }
}

async function evaluateAndPersistAchievements(env: Env, leagueId: string): Promise<void> {
  const [participants, predictions, matches, leaderboard, finalFinished] = await Promise.all([
    getParticipants(env, leagueId),
    getAchievementPredictions(env, leagueId),
    getAchievementMatches(env),
    getAchievementLeaderboard(env, leagueId),
    isFinalFinished(env)
  ]);

  const unlocks = evaluateAchievementUnlocks({
    participants,
    predictions,
    matches,
    leaderboard,
    finalFinished,
    now: new Date()
  });

  const now = new Date().toISOString();
  for (const unlock of unlocks) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO user_achievements (league_id, user_id, achievement_id, unlocked_at, metadata_json)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    )
      .bind(leagueId, unlock.userId, unlock.achievementId, now, JSON.stringify(unlock.metadata))
      .run();
  }
}

async function getUserAchievements(env: Env, userId: string, leagueId: string): Promise<UserAchievement[]> {
  const { results } = await env.DB.prepare(
    `SELECT achievement_id, unlocked_at, metadata_json
     FROM user_achievements
     WHERE league_id = ?1 AND user_id = ?2
     ORDER BY unlocked_at DESC`
  )
    .bind(leagueId, userId)
    .all<AchievementRow>();

  return results.map((row) => {
    const definition = getAchievementDefinition(row.achievement_id);
    return {
      ...definition,
      unlockedAt: row.unlocked_at,
      metadata: parseMetadata(row.metadata_json)
    };
  });
}

async function getParticipants(env: Env, leagueId: string): Promise<AchievementParticipant[]> {
  const { results } = await env.DB.prepare(
    `SELECT u.id AS user_id, u.is_admin, lm.joined_at
     FROM league_members lm
     JOIN users u ON u.id = lm.user_id
     WHERE lm.league_id = ?1`
  )
    .bind(leagueId)
    .all<{ user_id: string; is_admin: number; joined_at: string }>();

  return results.map((row) => ({
    userId: row.user_id,
    isAdmin: row.is_admin === 1,
    joinedAt: row.joined_at
  }));
}

async function getAchievementPredictions(env: Env, leagueId: string): Promise<AchievementPrediction[]> {
  const { results } = await env.DB.prepare(
    `SELECT p.user_id, p.match_id, p.home_score, p.away_score, p.points, p.outcome,
            p.created_at, p.updated_at,
            m.kickoff_at, m.lock_at, m.status, m.stage, m.matchday, m.is_double_points,
            m.home_team_id, m.away_team_id, m.home_score AS actual_home_score, m.away_score AS actual_away_score
     FROM predictions p
     JOIN matches m ON m.id = p.match_id
     WHERE p.league_id = ?1
     ORDER BY m.kickoff_at ASC`
  )
    .bind(leagueId)
    .all<{
      user_id: string;
      match_id: string;
      home_score: number;
      away_score: number;
      points: number;
      outcome: PredictionOutcome;
      created_at: string;
      updated_at: string;
      kickoff_at: string;
      lock_at: string;
      status: AchievementPrediction["status"];
      stage: AchievementPrediction["stage"];
      matchday: number | null;
      is_double_points: number;
      home_team_id: string;
      away_team_id: string;
      actual_home_score: number | null;
      actual_away_score: number | null;
    }>();

  return results.map((row) => ({
    userId: row.user_id,
    matchId: row.match_id,
    homeScore: row.home_score,
    awayScore: row.away_score,
    points: row.points,
    outcome: row.outcome,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    kickoffAt: row.kickoff_at,
    lockAt: row.lock_at,
    status: row.status,
    stage: row.stage,
    matchday: row.matchday,
    isDoublePoints: row.is_double_points === 1,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    actualHomeScore: row.actual_home_score,
    actualAwayScore: row.actual_away_score
  }));
}

async function getAchievementMatches(env: Env): Promise<AchievementMatch[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, kickoff_at, lock_at, status
     FROM matches
     ORDER BY kickoff_at ASC`
  ).all<{ id: string; kickoff_at: string; lock_at: string; status: AchievementMatch["status"] }>();

  return results.map((row) => ({
    id: row.id,
    kickoffAt: row.kickoff_at,
    lockAt: row.lock_at,
    status: row.status
  }));
}

async function getAchievementLeaderboard(env: Env, leagueId: string): Promise<AchievementLeaderboardRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT u.id AS user_id,
            COALESCE(SUM(p.points), 0) + COALESCE(MAX(b.points), 0) AS total_points,
            COALESCE(SUM(CASE WHEN p.outcome = 'exact' THEN 1 ELSE 0 END), 0) AS exacts
     FROM league_members lm
     JOIN users u ON u.id = lm.user_id
     LEFT JOIN predictions p ON p.user_id = u.id AND p.league_id = lm.league_id
     LEFT JOIN bonus_predictions b ON b.user_id = u.id AND b.league_id = lm.league_id
     WHERE lm.league_id = ?1 AND u.is_admin = 0
     GROUP BY u.id, u.display_name
     ORDER BY total_points DESC, exacts DESC, u.display_name ASC`
  )
    .bind(leagueId)
    .all<{ user_id: string; total_points: number; exacts: number }>();

  return results.map((row, index) => ({
    userId: row.user_id,
    points: row.total_points,
    exacts: row.exacts,
    rank: index + 1
  }));
}

async function isFinalFinished(env: Env): Promise<boolean> {
  const row = await env.DB.prepare("SELECT id FROM matches WHERE stage = 'FINAL' AND status = 'finished' LIMIT 1")
    .first<{ id: string }>();
  return Boolean(row);
}

function parseMetadata(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
