import { scorePrediction, validatePrediction } from "../domain/scoring";
import { initialMatches, initialTeams, leagueSeed } from "../shared/fixtures";
import type { BonusPrediction, LeaderboardRow, Match, MatchStatus, Prediction, SquadPlayer, Team, WorldStanding } from "../shared/types";
import { createId, hashPassword, verifyPassword } from "./crypto";
import { HttpError } from "./http";
import type { Env } from "./types";

type MatchRow = {
  id: string;
  api_fixture_id: number | null;
  stage: Match["stage"];
  round: string;
  matchday: number | null;
  group_name: string | null;
  kickoff_at: string;
  lock_at: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  extra_home_score: number | null;
  extra_away_score: number | null;
  penalty_home_score: number | null;
  penalty_away_score: number | null;
  goals_json: string | null;
  is_double_points: number;
  home_id: string;
  home_name: string;
  home_code: string;
  home_logo_url: string | null;
  away_id: string;
  away_name: string;
  away_code: string;
  away_logo_url: string | null;
  prediction_id?: string | null;
  prediction_home_score?: number | null;
  prediction_away_score?: number | null;
  prediction_points?: number | null;
  prediction_outcome?: Prediction["outcome"] | null;
};

export async function ensureSeeded(env: Env): Promise<void> {
  const now = new Date().toISOString();
  await ensureDerivedTables(env);

  await env.DB.prepare("INSERT OR IGNORE INTO leagues (id, name, slug, created_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(leagueSeed.id, leagueSeed.name, leagueSeed.slug, now)
    .run();

  await ensureAdminUser(env, now);

  const teamCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM teams").first<{ count: number }>();
  if ((teamCount?.count ?? 0) < initialTeams.length) {
    await insertRows(
      env.DB,
      "teams",
      ["id", "name", "short_code", "api_team_id", "logo_url", "created_at"],
      initialTeams.map((team) => [team.id, team.name, team.shortCode, null, null, now])
    );
  }

  const matchCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM matches").first<{ count: number }>();
  if ((matchCount?.count ?? 0) < initialMatches.length) {
    await insertRows(
      env.DB,
      "matches",
      [
        "id",
        "api_fixture_id",
        "stage",
        "round",
        "matchday",
        "group_name",
        "home_team_id",
        "away_team_id",
        "kickoff_at",
        "lock_at",
        "status",
        "is_double_points",
        "updated_at",
        "created_at"
      ],
      initialMatches.map((match) => [
        match.id,
        null,
        match.stage,
        match.round,
        match.matchday,
        match.groupName,
        match.homeTeamId,
        match.awayTeamId,
        match.kickoffAt,
        match.lockAt,
        "scheduled",
        match.isDoublePoints ? 1 : 0,
        now,
        now
      ])
    );
  }
}

async function ensureDerivedTables(env: Env): Promise<void> {
  await ensureUserAvatarColumn(env);
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS world_standings (
        team_id TEXT PRIMARY KEY,
        provider_team_id INTEGER,
        group_name TEXT NOT NULL,
        rank INTEGER NOT NULL,
        team_name TEXT NOT NULL,
        short_code TEXT,
        logo_url TEXT,
        played INTEGER NOT NULL DEFAULT 0,
        won INTEGER NOT NULL DEFAULT 0,
        drawn INTEGER NOT NULL DEFAULT 0,
        lost INTEGER NOT NULL DEFAULT 0,
        goals_for INTEGER NOT NULL DEFAULT 0,
        goals_against INTEGER NOT NULL DEFAULT 0,
        goal_diff INTEGER NOT NULL DEFAULT 0,
        points INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      )`
    ),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_world_standings_group_rank ON world_standings(group_name, rank)")
  ]);
}

async function ensureUserAvatarColumn(env: Env): Promise<void> {
  const { results } = await env.DB.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  if (results.length === 0) return;
  if (results.some((column) => column.name === "avatar_url")) return;
  await env.DB.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
}

async function ensureAdminUser(env: Env, now: string): Promise<void> {
  const existing = await env.DB.prepare("SELECT id FROM users WHERE username = 'admin'").first();
  if (existing) return;

  const { hash, salt } = await hashPassword("Porra.44");
  await env.DB.prepare(
    "INSERT INTO users (id, username, display_name, password_hash, password_salt, is_admin, created_at) VALUES (?1, 'admin', 'Admin Fortilin', ?2, ?3, 1, ?4)"
  )
    .bind("usr_admin", hash, salt, now)
    .run();
}

export async function insertRows(db: D1Database, table: string, columns: string[], rows: unknown[][]): Promise<void> {
  if (rows.length === 0) return;
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;

  for (const [index, row] of rows.entries()) {
    try {
      await db.prepare(sql).bind(...row).run();
    } catch (error) {
      console.error("D1 INSERT ERROR", { table, columns, rowIndex: index, rowCount: rows.length, error });
      throw error;
    }
  }
}

export async function getTeams(env: Env): Promise<Team[]> {
  const { results } = await env.DB.prepare(
    "SELECT id, name, short_code, api_team_id, logo_url FROM teams ORDER BY name COLLATE NOCASE"
  ).all<{ id: string; name: string; short_code: string; api_team_id: number | null; logo_url: string | null }>();
  return results.map((row) => ({
    id: row.id,
    name: row.name,
    shortCode: row.short_code,
    apiTeamId: row.api_team_id,
    logoUrl: row.logo_url
  }));
}

export async function getWorldStandings(env: Env): Promise<WorldStanding[]> {
  const { results } = await env.DB.prepare(
    `SELECT team_id, group_name, rank, team_name, short_code, logo_url,
            played, won, drawn, lost, goals_for, goals_against, goal_diff, points, updated_at
     FROM world_standings
     ORDER BY group_name COLLATE NOCASE, rank ASC, team_name COLLATE NOCASE`
  ).all<{
    team_id: string | null;
    group_name: string;
    rank: number;
    team_name: string;
    short_code: string | null;
    logo_url: string | null;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    goal_diff: number;
    points: number;
    updated_at: string;
  }>();

  return results.map((row) => ({
    groupName: row.group_name,
    rank: row.rank,
    teamId: row.team_id,
    teamName: row.team_name,
    shortCode: row.short_code,
    logoUrl: row.logo_url,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    goalDiff: row.goal_diff,
    points: row.points,
    updatedAt: row.updated_at
  }));
}

export async function getSquadPlayers(env: Env): Promise<SquadPlayer[]> {
  const { results } = await env.DB.prepare(
    "SELECT team_id, api_player_id, name, position, photo_url FROM squad_players ORDER BY team_id, name COLLATE NOCASE"
  ).all<{ team_id: string; api_player_id: number; name: string; position: string | null; photo_url: string | null }>();

  return results.map((row) => ({
    teamId: row.team_id,
    apiPlayerId: row.api_player_id,
    name: row.name,
    position: row.position,
    photoUrl: row.photo_url
  }));
}

export async function getMatches(env: Env, userId?: string | null): Promise<Array<Match & { myPrediction?: Prediction | null }>> {
  const predictionSelect = userId
    ? `p.id AS prediction_id, p.home_score AS prediction_home_score, p.away_score AS prediction_away_score,
       p.points AS prediction_points, p.outcome AS prediction_outcome`
    : `NULL AS prediction_id, NULL AS prediction_home_score, NULL AS prediction_away_score,
       NULL AS prediction_points, NULL AS prediction_outcome`;
  const predictionJoin = userId
    ? "LEFT JOIN predictions p ON p.match_id = m.id AND p.user_id = ?1 AND p.league_id = 'fortilin'"
    : "";

  const statement = env.DB.prepare(
    `SELECT m.*, ht.id AS home_id, ht.name AS home_name, ht.short_code AS home_code, ht.logo_url AS home_logo_url,
            at.id AS away_id, at.name AS away_name, at.short_code AS away_code, at.logo_url AS away_logo_url,
            ${predictionSelect}
     FROM matches m
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams at ON at.id = m.away_team_id
     ${predictionJoin}
     ORDER BY m.kickoff_at ASC`
  );
  const { results } = userId ? await statement.bind(userId).all<MatchRow>() : await statement.all<MatchRow>();
  return results.map(rowToMatch);
}

export async function getMatch(env: Env, matchId: string, userId?: string | null): Promise<Match & { myPrediction?: Prediction | null }> {
  const matches = await getMatches(env, userId);
  const match = matches.find((candidate) => candidate.id === matchId);
  if (!match) throw new HttpError(404, "Partido no encontrado.");
  return match;
}

export async function savePrediction(env: Env, userId: string, matchId: string, homeScore: number, awayScore: number): Promise<Prediction> {
  const match = await getMatch(env, matchId, userId);
  if (new Date(match.lockAt).getTime() <= Date.now() || match.status === "finished") {
    throw new HttpError(423, "Este partido ya esta bloqueado.");
  }

  const validation = validatePrediction(match.stage, { homeScore, awayScore });
  if (validation) throw new HttpError(400, validation);

  const now = new Date().toISOString();
  const existing = match.myPrediction;
  const predictionId = existing?.id ?? createId("prd");
  await env.DB.prepare(
    `INSERT INTO predictions (id, league_id, user_id, match_id, home_score, away_score, points, outcome, created_at, updated_at)
     VALUES (?1, 'fortilin', ?2, ?3, ?4, ?5, 0, 'pending', ?6, ?6)
     ON CONFLICT(league_id, user_id, match_id)
     DO UPDATE SET home_score = excluded.home_score, away_score = excluded.away_score, updated_at = excluded.updated_at`
  )
    .bind(predictionId, userId, matchId, homeScore, awayScore, now)
    .run();

  return {
    id: predictionId,
    matchId,
    userId,
    homeScore,
    awayScore,
    points: existing?.points ?? 0,
    outcome: existing?.outcome ?? "pending"
  };
}

export async function getLeaderboard(env: Env, leagueId = "fortilin"): Promise<LeaderboardRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT u.id AS user_id, u.display_name, u.avatar_url,
            COALESCE(SUM(p.points), 0) + COALESCE(MAX(b.points), 0) AS total_points,
            COALESCE(SUM(CASE WHEN p.outcome = 'exact' THEN 1 ELSE 0 END), 0) AS exacts,
            CASE WHEN COALESCE(MAX(b.points), 0) >= 10 THEN 1 ELSE 0 END AS champion_hit
     FROM league_members lm
     JOIN users u ON u.id = lm.user_id
     LEFT JOIN predictions p ON p.user_id = u.id AND p.league_id = lm.league_id
     LEFT JOIN bonus_predictions b ON b.user_id = u.id AND b.league_id = lm.league_id
     WHERE lm.league_id = ?1
     GROUP BY u.id, u.display_name, u.avatar_url
     ORDER BY total_points DESC, exacts DESC, u.display_name ASC`
  )
    .bind(leagueId)
    .all<{ user_id: string; display_name: string; avatar_url: string | null; total_points: number; exacts: number; champion_hit: number }>();

  return results.map((row, index) => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    points: row.total_points,
    exacts: row.exacts,
    championHit: row.champion_hit === 1,
    rank: index + 1
  }));
}

export async function getLeagueUsers(env: Env, leagueId = "fortilin"): Promise<Array<{
  id: string;
  username: string;
  displayName: string;
  role: string;
  isAdmin: boolean;
  bonus: BonusPrediction | null;
}>> {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.username, u.display_name, u.is_admin, lm.role,
            b.champion_team_id, b.runner_up_team_id, b.top_scorer_team_id, b.top_scorer_player_id,
            b.top_scorer, b.points AS bonus_points, b.locked_at
     FROM league_members lm
     JOIN users u ON u.id = lm.user_id
     LEFT JOIN bonus_predictions b ON b.user_id = u.id AND b.league_id = lm.league_id
     WHERE lm.league_id = ?1
     ORDER BY u.display_name COLLATE NOCASE`
  )
    .bind(leagueId)
    .all<{
      id: string;
      username: string;
      display_name: string;
      is_admin: number;
      role: string;
      champion_team_id: string | null;
      runner_up_team_id: string | null;
      top_scorer_team_id: string | null;
      top_scorer_player_id: number | null;
      top_scorer: string | null;
      bonus_points: number | null;
      locked_at: string | null;
    }>();

  return results.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isAdmin: row.is_admin === 1,
    bonus: row.locked_at
      ? {
          championTeamId: row.champion_team_id,
          runnerUpTeamId: row.runner_up_team_id,
          topScorerTeamId: row.top_scorer_team_id,
          topScorerPlayerId: row.top_scorer_player_id,
          topScorer: row.top_scorer,
          points: row.bonus_points ?? 0,
          lockedAt: row.locked_at
        }
      : null
  }));
}

export async function getLeaguePredictions(env: Env, leagueId = "fortilin"): Promise<Prediction[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, user_id, match_id, home_score, away_score, points, outcome
     FROM predictions
     WHERE league_id = ?1`
  )
    .bind(leagueId)
    .all<{
      id: string;
      user_id: string;
      match_id: string;
      home_score: number;
      away_score: number;
      points: number;
      outcome: Prediction["outcome"];
    }>();

  return results.map((row) => ({
    id: row.id,
    userId: row.user_id,
    matchId: row.match_id,
    homeScore: row.home_score,
    awayScore: row.away_score,
    points: row.points,
    outcome: row.outcome
  }));
}

export async function getUserClosedSummary(env: Env, targetUserId: string, leagueId = "fortilin"): Promise<{
  user: { id: string; username: string; displayName: string };
  bonus: BonusPrediction | null;
  predictions: Array<Prediction & { kickoffAt: string }>;
}> {
  const user = await env.DB.prepare(
    `SELECT u.id, u.username, u.display_name
     FROM league_members lm
     JOIN users u ON u.id = lm.user_id
     WHERE lm.league_id = ?1 AND lm.user_id = ?2 AND u.is_admin = 0`
  )
    .bind(leagueId, targetUserId)
    .first<{ id: string; username: string; display_name: string }>();
  if (!user) throw new HttpError(404, "Participante no encontrado.");

  const bonus = await getBonus(env, targetUserId);
  const now = new Date().toISOString();
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.user_id, p.match_id, p.home_score, p.away_score, p.points, p.outcome, m.kickoff_at
     FROM predictions p
     JOIN matches m ON m.id = p.match_id
     WHERE p.league_id = ?1 AND p.user_id = ?2 AND m.lock_at <= ?3
     ORDER BY m.kickoff_at ASC`
  )
    .bind(leagueId, targetUserId, now)
    .all<{
      id: string;
      user_id: string;
      match_id: string;
      home_score: number;
      away_score: number;
      points: number;
      outcome: Prediction["outcome"];
      kickoff_at: string;
    }>();

  return {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name
    },
    bonus,
    predictions: results.map((row) => ({
      id: row.id,
      matchId: row.match_id,
      userId: row.user_id,
      homeScore: row.home_score,
      awayScore: row.away_score,
      points: row.points,
      outcome: row.outcome,
      kickoffAt: row.kickoff_at
    }))
  };
}

export async function getBonus(env: Env, userId: string): Promise<BonusPrediction | null> {
  const row = await env.DB.prepare(
    `SELECT champion_team_id, runner_up_team_id, top_scorer_team_id, top_scorer_player_id, top_scorer, points, locked_at
     FROM bonus_predictions
     WHERE league_id = 'fortilin' AND user_id = ?1`
  )
    .bind(userId)
    .first<{
      champion_team_id: string | null;
      runner_up_team_id: string | null;
      top_scorer_team_id: string | null;
      top_scorer_player_id: number | null;
      top_scorer: string | null;
      points: number;
      locked_at: string;
    }>();

  if (!row) return null;
  return {
    championTeamId: row.champion_team_id,
    runnerUpTeamId: row.runner_up_team_id,
    topScorerTeamId: row.top_scorer_team_id,
    topScorerPlayerId: row.top_scorer_player_id,
    topScorer: row.top_scorer,
    points: row.points,
    lockedAt: row.locked_at
  };
}

export async function updateUserProfile(env: Env, userId: string, input: { displayName: string }): Promise<void> {
  const displayName = input.displayName.trim();
  if (displayName.length < 2) throw new HttpError(400, "El nombre visible debe tener al menos 2 caracteres.");
  if (displayName.length > 40) throw new HttpError(400, "El nombre visible no puede superar 40 caracteres.");

  await env.DB.prepare("UPDATE users SET display_name = ?1 WHERE id = ?2").bind(displayName, userId).run();
}

export async function updateUserAvatar(env: Env, userId: string, avatarUrl: string | null): Promise<void> {
  if (avatarUrl !== null) validateAvatarDataUrl(avatarUrl);
  await env.DB.prepare("UPDATE users SET avatar_url = ?1 WHERE id = ?2").bind(avatarUrl, userId).run();
}

function validateAvatarDataUrl(value: string): void {
  if (value.length > 120_000) {
    throw new HttpError(400, "La foto es demasiado grande. Sube una imagen mas ligera.");
  }
  if (!/^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i.test(value)) {
    throw new HttpError(400, "La foto debe ser una imagen valida.");
  }
}

export async function updateUserOwnPassword(env: Env, userId: string, input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  if (input.newPassword.length < 6) {
    throw new HttpError(400, "La nueva contraseña debe tener al menos 6 caracteres.");
  }

  const row = await env.DB.prepare("SELECT password_hash, password_salt FROM users WHERE id = ?1")
    .bind(userId)
    .first<{ password_hash: string; password_salt: string }>();
  if (!row) throw new HttpError(404, "Usuario no encontrado.");
  if (!(await verifyPassword(input.currentPassword, row.password_salt, row.password_hash))) {
    throw new HttpError(401, "La contraseña actual no es correcta.");
  }

  const { hash, salt } = await hashPassword(input.newPassword);
  await env.DB.prepare("UPDATE users SET password_hash = ?1, password_salt = ?2 WHERE id = ?3").bind(hash, salt, userId).run();
}

export async function createBonus(env: Env, userId: string, input: {
  championTeamId: string | null;
  runnerUpTeamId: string | null;
  topScorerTeamId: string | null;
  topScorerPlayerId: number | null;
}): Promise<BonusPrediction> {
  const existing = await getBonus(env, userId);
  if (existing) throw new HttpError(409, "Los bonus ya estan bloqueados.");
  const bonus = await validateBonusInput(env, input);

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO bonus_predictions
     (league_id, user_id, champion_team_id, runner_up_team_id, top_scorer_team_id, top_scorer_player_id, top_scorer, points, locked_at, created_at, updated_at)
     VALUES ('fortilin', ?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?7, ?7)`
  )
    .bind(userId, input.championTeamId, input.runnerUpTeamId, input.topScorerTeamId, input.topScorerPlayerId, bonus.topScorer, now)
    .run();

  return {
    championTeamId: input.championTeamId,
    runnerUpTeamId: input.runnerUpTeamId,
    topScorerTeamId: input.topScorerTeamId,
    topScorerPlayerId: input.topScorerPlayerId,
    topScorer: bonus.topScorer,
    points: 0,
    lockedAt: now
  };
}

async function validateBonusInput(env: Env, input: {
  championTeamId: string | null;
  runnerUpTeamId: string | null;
  topScorerTeamId: string | null;
  topScorerPlayerId: number | null;
}): Promise<{ topScorer: string }> {
  if (input.championTeamId && input.runnerUpTeamId && input.championTeamId === input.runnerUpTeamId) {
    throw new HttpError(400, "El campeón y el subcampeón no pueden ser la misma selección.");
  }
  if (!input.topScorerTeamId || !input.topScorerPlayerId) {
    throw new HttpError(400, "El máximo goleador debe elegirse por selección y jugador convocado.");
  }

  const scorer = await env.DB.prepare(
    "SELECT name FROM squad_players WHERE team_id = ?1 AND api_player_id = ?2"
  )
    .bind(input.topScorerTeamId, input.topScorerPlayerId)
    .first<{ name: string }>();

  if (!scorer) {
    throw new HttpError(400, "Ese jugador no esta cargado como convocado para esa selección.");
  }

  return { topScorer: scorer.name };
}

export async function setUserBonusAsAdmin(env: Env, actorUserId: string, userId: string, input: {
  championTeamId: string | null;
  runnerUpTeamId: string | null;
  topScorerTeamId: string | null;
  topScorerPlayerId: number | null;
}): Promise<BonusPrediction> {
  const member = await env.DB.prepare("SELECT user_id FROM league_members WHERE league_id = 'fortilin' AND user_id = ?1")
    .bind(userId)
    .first();
  if (!member) throw new HttpError(404, "Usuario no encontrado en la liga.");

  const bonus = await validateBonusInput(env, input);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO bonus_predictions
       (league_id, user_id, champion_team_id, runner_up_team_id, top_scorer_team_id, top_scorer_player_id, top_scorer, points, locked_at, created_at, updated_at)
       VALUES ('fortilin', ?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?7, ?7)
       ON CONFLICT(league_id, user_id)
       DO UPDATE SET champion_team_id = excluded.champion_team_id,
                     runner_up_team_id = excluded.runner_up_team_id,
                     top_scorer_team_id = excluded.top_scorer_team_id,
                     top_scorer_player_id = excluded.top_scorer_player_id,
                     top_scorer = excluded.top_scorer,
                     updated_at = excluded.updated_at`
    ).bind(userId, input.championTeamId, input.runnerUpTeamId, input.topScorerTeamId, input.topScorerPlayerId, bonus.topScorer, now),
    env.DB.prepare(
      "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, payload, created_at) VALUES (?1, ?2, 'set_user_bonus', 'bonus', ?3, ?4, ?5)"
    ).bind(createId("aud"), actorUserId, userId, JSON.stringify(input), now)
  ]);

  return (await getBonus(env, userId))!;
}

export async function setMatchResult(env: Env, actorUserId: string, input: {
  matchId: string;
  homeScore: number;
  awayScore: number;
  status?: MatchStatus;
}): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE matches
     SET home_score = ?1, away_score = ?2, status = ?3, updated_at = ?4
     WHERE id = ?5`
  )
    .bind(input.homeScore, input.awayScore, input.status ?? "finished", now, input.matchId)
    .run();

  await recalculateMatch(env, input.matchId);
  await env.DB.prepare(
    "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, payload, created_at) VALUES (?1, ?2, 'set_result', 'match', ?3, ?4, ?5)"
  )
    .bind(createId("aud"), actorUserId, input.matchId, JSON.stringify(input), now)
    .run();
}

export async function setDoublePoints(env: Env, actorUserId: string, matchId: string, isDoublePoints: boolean): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE matches SET is_double_points = ?1, updated_at = ?2 WHERE id = ?3")
    .bind(isDoublePoints ? 1 : 0, now, matchId)
    .run();
  await recalculateMatch(env, matchId);
  await env.DB.prepare(
    "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, payload, created_at) VALUES (?1, ?2, 'set_double_points', 'match', ?3, ?4, ?5)"
  )
    .bind(createId("aud"), actorUserId, matchId, JSON.stringify({ isDoublePoints }), now)
    .run();
}

export async function resetUserPassword(env: Env, actorUserId: string, targetUserId: string, newPassword: string): Promise<void> {
  if (newPassword.length < 6) {
    throw new HttpError(400, "La nueva contraseña debe tener al menos 6 caracteres.");
  }

  const target = await env.DB.prepare("SELECT id FROM users WHERE id = ?1").bind(targetUserId).first();
  if (!target) throw new HttpError(404, "Usuario no encontrado.");

  const { hash, salt } = await hashPassword(newPassword);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ?1, password_salt = ?2 WHERE id = ?3").bind(hash, salt, targetUserId),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(targetUserId),
    env.DB.prepare(
      "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, payload, created_at) VALUES (?1, ?2, 'reset_password', 'user', ?3, '{}', ?4)"
    ).bind(createId("aud"), actorUserId, targetUserId, now)
  ]);
}

export async function deleteUserAsAdmin(env: Env, actorUserId: string, targetUserId: string): Promise<void> {
  if (actorUserId === targetUserId) {
    throw new HttpError(400, "El admin no puede eliminarse a si mismo.");
  }

  const target = await env.DB.prepare("SELECT id, display_name, username, is_admin FROM users WHERE id = ?1")
    .bind(targetUserId)
    .first<{ id: string; display_name: string; username: string; is_admin: number }>();
  if (!target) throw new HttpError(404, "Usuario no encontrado.");
  if (target.is_admin === 1) throw new HttpError(400, "No se puede eliminar un usuario admin.");

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(targetUserId),
    env.DB.prepare("DELETE FROM bonus_predictions WHERE user_id = ?1").bind(targetUserId),
    env.DB.prepare("DELETE FROM predictions WHERE user_id = ?1").bind(targetUserId),
    env.DB.prepare("DELETE FROM league_members WHERE user_id = ?1").bind(targetUserId),
    env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(targetUserId),
    env.DB.prepare(
      "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, payload, created_at) VALUES (?1, ?2, 'delete_user', 'user', ?3, ?4, ?5)"
    ).bind(
      createId("aud"),
      actorUserId,
      targetUserId,
      JSON.stringify({ username: target.username, displayName: target.display_name }),
      now
    )
  ]);
}

export async function setUserPredictionAsAdmin(env: Env, actorUserId: string, input: {
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
}): Promise<Prediction> {
  const member = await env.DB.prepare("SELECT user_id FROM league_members WHERE league_id = 'fortilin' AND user_id = ?1")
    .bind(input.userId)
    .first();
  if (!member) throw new HttpError(404, "Usuario no encontrado en la liga.");

  const match = await getMatch(env, input.matchId);
  const validation = validatePrediction(match.stage, { homeScore: input.homeScore, awayScore: input.awayScore });
  if (validation) throw new HttpError(400, validation);

  const scored =
    match.homeScore !== null && match.homeScore !== undefined && match.awayScore !== null && match.awayScore !== undefined
      ? scorePrediction(
          { homeScore: input.homeScore, awayScore: input.awayScore },
          {
            stage: match.stage,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            isDoublePoints: match.isDoublePoints,
            penaltyHomeScore: match.penaltyHomeScore,
            penaltyAwayScore: match.penaltyAwayScore
          }
        )
      : { points: 0, outcome: "pending" as const };

  const now = new Date().toISOString();
  const predictionId = createId("prd");
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO predictions (id, league_id, user_id, match_id, home_score, away_score, points, outcome, created_at, updated_at)
       VALUES (?1, 'fortilin', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
       ON CONFLICT(league_id, user_id, match_id)
       DO UPDATE SET home_score = excluded.home_score, away_score = excluded.away_score,
                     points = excluded.points, outcome = excluded.outcome, updated_at = excluded.updated_at`
    ).bind(predictionId, input.userId, input.matchId, input.homeScore, input.awayScore, scored.points, scored.outcome, now),
    env.DB.prepare(
      "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, payload, created_at) VALUES (?1, ?2, 'set_user_prediction', 'prediction', ?3, ?4, ?5)"
    ).bind(createId("aud"), actorUserId, input.userId, JSON.stringify(input), now)
  ]);

  return {
    id: predictionId,
    matchId: input.matchId,
    userId: input.userId,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    points: scored.points,
    outcome: scored.outcome
  };
}

export async function recalculateMatch(env: Env, matchId: string): Promise<void> {
  const match = await getMatch(env, matchId);
  if (match.homeScore === null || match.homeScore === undefined || match.awayScore === null || match.awayScore === undefined) {
    return;
  }

  const { results } = await env.DB.prepare("SELECT id, home_score, away_score FROM predictions WHERE match_id = ?1")
    .bind(matchId)
    .all<{ id: string; home_score: number; away_score: number }>();

  const statements = results.map((prediction) => {
    const scored = scorePrediction(
      { homeScore: prediction.home_score, awayScore: prediction.away_score },
      {
        stage: match.stage,
        homeScore: match.homeScore ?? 0,
        awayScore: match.awayScore ?? 0,
        isDoublePoints: match.isDoublePoints,
        penaltyHomeScore: match.penaltyHomeScore,
        penaltyAwayScore: match.penaltyAwayScore
      }
    );
    return env.DB.prepare("UPDATE predictions SET points = ?1, outcome = ?2, updated_at = ?3 WHERE id = ?4").bind(
      scored.points,
      scored.outcome,
      new Date().toISOString(),
      prediction.id
    );
  });

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }
}

export function rowToMatch(row: MatchRow): Match & { myPrediction?: Prediction | null } {
  const match: Match & { myPrediction?: Prediction | null } = {
    id: row.id,
    apiFixtureId: row.api_fixture_id,
    stage: row.stage,
    round: row.round,
    matchday: row.matchday,
    groupName: row.group_name,
    homeTeam: {
      id: row.home_id,
      name: row.home_name,
      shortCode: row.home_code,
      logoUrl: row.home_logo_url
    },
    awayTeam: {
      id: row.away_id,
      name: row.away_name,
      shortCode: row.away_code,
      logoUrl: row.away_logo_url
    },
    kickoffAt: row.kickoff_at,
    lockAt: row.lock_at,
    status: row.status,
    homeScore: row.home_score,
    awayScore: row.away_score,
    extraHomeScore: row.extra_home_score,
    extraAwayScore: row.extra_away_score,
    penaltyHomeScore: row.penalty_home_score,
    penaltyAwayScore: row.penalty_away_score,
    goals: parseGoalsJson(row.goals_json),
    isDoublePoints: row.is_double_points === 1,
    myPrediction: null
  };

  if (row.prediction_id) {
    match.myPrediction = {
      id: row.prediction_id,
      matchId: row.id,
      userId: "",
      homeScore: row.prediction_home_score ?? 0,
      awayScore: row.prediction_away_score ?? 0,
      points: row.prediction_points ?? 0,
      outcome: row.prediction_outcome ?? "pending"
    };
  }

  return match;
}

function parseGoalsJson(value: string | null): Match["goals"] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as Match["goals"];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((goal) => typeof goal.homeScore === "number" && typeof goal.awayScore === "number");
  } catch {
    return [];
  }
}
