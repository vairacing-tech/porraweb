import { clearSessionCookie, createSession, getAuthUser, loginUser, sessionCookie } from "./auth";
import { safeEvaluateAchievements, safeGetUserAchievements } from "./achievements";
import {
  createBonus,
  deleteUserAsAdmin,
  ensureSeeded,
  getBonus,
  getLeaderboard,
  getLeaguePredictions,
  getLeagueUsers,
  getMatches,
  getSquadPlayers,
  getTeams,
  getUserClosedSummary,
  getWorldStandings,
  resetUserPassword,
  savePrediction,
  setDoublePoints,
  setMatchResult,
  setUserBonusAsAdmin,
  setUserPredictionAsAdmin,
  updateUserAvatar,
  updateUserOwnPassword,
  updateUserProfile
} from "./db";
import { HttpError, json, readJson, requireInt, requireString, toErrorResponse } from "./http";
import { resolveKnockoutMatches } from "./knockout";
import { runResultSync, runSquadSync } from "./sync";
import type { Env } from "./types";

interface RegisterBody {
  username?: string;
  displayName?: string;
  password?: string;
  bonus?: {
    championTeamId?: string | null;
    runnerUpTeamId?: string | null;
    topScorerTeamId?: string | null;
    topScorerPlayerId?: number | null;
  };
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  try {
    await ensureSeeded(env);
    const user = await getAuthUser(env, request);
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/?/, "");
    const segments = path.split("/").filter(Boolean);
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") return new Response(null, { status: 204 });

    if (segments[0] === "auth" && segments[1] === "register" && method === "POST") {
      throw new HttpError(403, "El registro de nuevos usuarios esta cerrado.");
    }

    if (segments[0] === "auth" && segments[1] === "login" && method === "POST") {
      const body = await readJson<{ username?: string; password?: string }>(request);
      const loggedIn = await loginUser(env, requireString(body.username, "username"), requireString(body.password, "password"));
      const session = await createSession(env, loggedIn.id);
      return withSession(json({ user: loggedIn }), session.id, session.expiresAt);
    }

    if (segments[0] === "auth" && segments[1] === "logout" && method === "POST") {
      const response = json({ ok: true });
      response.headers.append("set-cookie", clearSessionCookie());
      return response;
    }

    if (segments[0] === "session" && method === "GET") {
      return json({ user });
    }

    if (segments[0] === "bootstrap" && method === "GET") {
      const [
        matches,
        leaderboard,
        teams,
        squadPlayers,
        worldStandings,
        bonus,
        achievements,
        adminUsers,
        adminPredictions
      ] = await Promise.all([
        getMatches(env, user?.id),
        getLeaderboard(env),
        getTeams(env),
        getSquadPlayers(env),
        getWorldStandings(env),
        user ? getBonus(env, user.id) : Promise.resolve(null),
        user ? safeGetUserAchievements(env, user.id) : Promise.resolve([]),
        user?.isAdmin ? getLeagueUsers(env) : Promise.resolve(undefined),
        user?.isAdmin ? getLeaguePredictions(env) : Promise.resolve(undefined)
      ]);
      const now = new Date().toISOString();
      const nowMs = Date.now();
      const currentWindowMs = 3 * 60 * 60 * 1000;
      const currentMatch =
        matches.find((match) => {
          const kickoffMs = new Date(match.kickoffAt).getTime();
          return (
            match.status === "live" ||
            (match.status !== "finished" && kickoffMs <= nowMs && nowMs - kickoffMs <= currentWindowMs)
          );
        }) ?? null;
      const nextMatch = currentMatch ?? matches.find((match) => new Date(match.kickoffAt).getTime() >= nowMs) ?? matches.at(-1) ?? null;
      return json({
        appName: env.APP_NAME || "Porra Fortilin",
        league: { id: "fortilin", name: env.LEAGUE_NAME || "Fortilin" },
        user,
        teams,
        squadPlayers,
        worldStandings,
        matches,
        nextMatch,
        leaderboard,
        bonus,
        achievements,
        adminUsers,
        adminPredictions,
        now
      });
    }

    if (segments[0] === "users" && segments[2] === "summary" && method === "GET") {
      requireUser(user);
      await safeEvaluateAchievements(env);
      const summary = await getUserClosedSummary(env, segments[1]);
      const achievements = await safeGetUserAchievements(env, segments[1]);
      return json({ ...summary, achievements });
    }

    if (segments[0] === "matches" && method === "GET" && segments.length === 1) {
      return json({ matches: await getMatches(env, user?.id) });
    }

    if (segments[0] === "matches" && segments[2] === "predictions" && method === "GET") {
      requireUser(user);
      const matchId = requireString(segments[1], "matchId");
      const predictions = await getVisiblePredictions(env, matchId, user!.isAdmin);
      return json({ predictions });
    }

    if (segments[0] === "predictions" && segments[1] && method === "PUT") {
      requireUser(user);
      const body = await readJson<{ homeScore?: number; awayScore?: number }>(request);
      const prediction = await savePrediction(
        env,
        user!.id,
        segments[1],
        requireInt(body.homeScore, "homeScore"),
        requireInt(body.awayScore, "awayScore")
      );
      await safeEvaluateAchievements(env);
      return json({ prediction });
    }

    if (segments[0] === "leaderboard" && method === "GET") {
      return json({ leaderboard: await getLeaderboard(env) });
    }

    if (segments[0] === "bonus" && method === "GET") {
      requireUser(user);
      return json({ bonus: await getBonus(env, user!.id), teams: await getTeams(env), squadPlayers: await getSquadPlayers(env) });
    }

    if (segments[0] === "bonus" && method === "PUT") {
      requireUser(user);
      const body = await readJson<RegisterBody["bonus"]>(request);
      const bonus = await createBonus(env, user!.id, {
        championTeamId: body?.championTeamId ?? null,
        runnerUpTeamId: body?.runnerUpTeamId ?? null,
        topScorerTeamId: body?.topScorerTeamId ?? null,
        topScorerPlayerId: body?.topScorerPlayerId ?? null
      });
      await safeEvaluateAchievements(env);
      return json({ bonus });
    }

    if (segments[0] === "profile" && segments.length === 1 && method === "PUT") {
      requireUser(user);
      const body = await readJson<{ displayName?: string }>(request);
      await updateUserProfile(env, user!.id, { displayName: requireString(body.displayName, "displayName") });
      return json({ ok: true });
    }

    if (segments[0] === "profile" && segments[1] === "avatar" && method === "PUT") {
      requireUser(user);
      const body = await readJson<{ avatarUrl?: string | null }>(request);
      await updateUserAvatar(env, user!.id, typeof body.avatarUrl === "string" ? body.avatarUrl : null);
      return json({ ok: true });
    }

    if (segments[0] === "profile" && segments[1] === "password" && method === "PUT") {
      requireUser(user);
      const body = await readJson<{ currentPassword?: string; newPassword?: string }>(request);
      await updateUserOwnPassword(env, user!.id, {
        currentPassword: requireString(body.currentPassword, "currentPassword"),
        newPassword: requireString(body.newPassword, "newPassword")
      });
      return json({ ok: true });
    }

    if (segments[0] === "admin") {
      requireAdmin(user);

      if (segments[1] === "users" && segments.length === 2 && method === "GET") {
        return json({ users: await getLeagueUsers(env) });
      }

      if (segments[1] === "users" && segments.length === 3 && method === "DELETE") {
        await deleteUserAsAdmin(env, user!.id, segments[2]);
        return json({ ok: true });
      }

      if (segments[1] === "users" && segments[3] === "password" && method === "PUT") {
        const body = await readJson<{ newPassword?: string }>(request);
        await resetUserPassword(env, user!.id, segments[2], requireString(body.newPassword, "newPassword"));
        return json({ ok: true });
      }

      if (segments[1] === "users" && segments[3] === "bonus" && method === "PUT") {
        const body = await readJson<RegisterBody["bonus"]>(request);
        const bonus = await setUserBonusAsAdmin(env, user!.id, segments[2], {
          championTeamId: body?.championTeamId ?? null,
          runnerUpTeamId: body?.runnerUpTeamId ?? null,
          topScorerTeamId: body?.topScorerTeamId ?? null,
          topScorerPlayerId: body?.topScorerPlayerId ?? null
        });
        await safeEvaluateAchievements(env);
        return json({ bonus });
      }

      if (segments[1] === "users" && segments[3] === "predictions" && segments[4] && method === "PUT") {
        const body = await readJson<{ homeScore?: number; awayScore?: number }>(request);
        const prediction = await setUserPredictionAsAdmin(env, user!.id, {
          userId: segments[2],
          matchId: segments[4],
          homeScore: requireInt(body.homeScore, "homeScore"),
          awayScore: requireInt(body.awayScore, "awayScore")
        });
        await safeEvaluateAchievements(env);
        return json({ prediction });
      }

      if (segments[1] === "matches" && segments[3] === "result" && method === "PUT") {
        const body = await readJson<{ homeScore?: number; awayScore?: number; status?: string }>(request);
        await setMatchResult(env, user!.id, {
          matchId: segments[2],
          homeScore: requireInt(body.homeScore, "homeScore"),
          awayScore: requireInt(body.awayScore, "awayScore"),
          status: body.status === "live" || body.status === "scheduled" ? body.status : "finished"
        });
        await resolveKnockoutMatches(env);
        await safeEvaluateAchievements(env);
        return json({ ok: true });
      }

      if (segments[1] === "matches" && segments[3] === "double-points" && method === "PUT") {
        const body = await readJson<{ isDoublePoints?: boolean }>(request);
        await setDoublePoints(env, user!.id, segments[2], body.isDoublePoints === true);
        await safeEvaluateAchievements(env);
        return json({ ok: true });
      }

      if (segments[1] === "sync-results" && method === "POST") {
        const result = await runResultSync(env);
        await safeEvaluateAchievements(env);
        return json(result);
      }

      if (segments[1] === "sync-squads" && method === "POST") {
        const result = await runSquadSync(env);
        return json(result);
      }
    }

    throw new HttpError(404, "Ruta no encontrada.");
  } catch (error) {
    try {
      if (new URL(request.url).pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean)[0] === "bootstrap") {
        console.error("BOOTSTRAP ERROR", error);
      }
    } catch {
      console.error("BOOTSTRAP ERROR", error);
    }
    return toErrorResponse(error);
  }
}

function withSession(response: Response, sessionId: string, expiresAt: string): Response {
  response.headers.append("set-cookie", sessionCookie(sessionId, expiresAt));
  return response;
}

function requireUser(user: unknown): void {
  if (!user) throw new HttpError(401, "Necesitas iniciar sesion.");
}

function requireAdmin(user: { isAdmin: boolean } | null): void {
  if (!user) throw new HttpError(401, "Necesitas iniciar sesion.");
  if (!user.isAdmin) throw new HttpError(403, "Solo admin.");
}

async function getVisiblePredictions(env: Env, matchId: string, isAdmin: boolean): Promise<Array<{
  displayName: string;
  homeScore: number;
  awayScore: number;
  points: number;
  outcome: string;
}>> {
  const match = await env.DB.prepare("SELECT lock_at FROM matches WHERE id = ?1").bind(matchId).first<{ lock_at: string }>();
  if (!match) throw new HttpError(404, "Partido no encontrado.");
  if (!isAdmin && new Date(match.lock_at).getTime() > Date.now()) {
    throw new HttpError(403, "Los pronósticos se muestran tras el bloqueo.");
  }

  const { results } = await env.DB.prepare(
    `SELECT u.display_name, p.home_score, p.away_score, p.points, p.outcome
     FROM predictions p
     JOIN users u ON u.id = p.user_id
     WHERE p.match_id = ?1 AND p.league_id = 'fortilin'
     ORDER BY u.display_name`
  )
    .bind(matchId)
    .all<{ display_name: string; home_score: number; away_score: number; points: number; outcome: string }>();

  return results.map((row) => ({
    displayName: row.display_name,
    homeScore: row.home_score,
    awayScore: row.away_score,
    points: row.points,
    outcome: row.outcome
  }));
}
