import { createId, hashPassword, verifyPassword } from "./crypto";
import { HttpError } from "./http";
import type { AuthUser, Env } from "./types";

const cookieName = "pf_session";
const sessionDays = 30;

export function getSessionCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|; )${cookieName}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function sessionCookie(sessionId: string, expiresAt: string): string {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return `${cookieName}=${encodeURIComponent(sessionId)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${cookieName}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export async function createSession(env: Env, userId: string): Promise<{ id: string; expiresAt: string }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionDays * 24 * 60 * 60 * 1000).toISOString();
  const id = createId("sess");
  await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(id, userId, expiresAt, now.toISOString())
    .run();
  return { id, expiresAt };
}

export async function getAuthUser(env: Env, request: Request): Promise<AuthUser | null> {
  const sessionId = getSessionCookie(request);
  if (!sessionId) return null;

  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_admin, lm.league_id, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN league_members lm ON lm.user_id = u.id
     WHERE s.id = ?1
     LIMIT 1`
  )
    .bind(sessionId)
    .first<{
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
      is_admin: number;
      league_id: string | null;
      expires_at: string;
    }>();

  if (!row) return null;

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?1").bind(sessionId).run();
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isAdmin: row.is_admin === 1,
    leagueId: row.league_id ?? "fortilin"
  };
}

export async function registerUser(env: Env, input: {
  username: string;
  displayName: string;
  password: string;
}): Promise<AuthUser> {
  if (input.password.length < 6) {
    throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres.");
  }

  const username = input.username.toLowerCase();
  const exists = await env.DB.prepare("SELECT id FROM users WHERE username = ?1").bind(username).first();
  if (exists) throw new HttpError(409, "Ese usuario ya existe.");

  const now = new Date().toISOString();
  const userId = createId("usr");
  const { hash, salt } = await hashPassword(input.password);
  const isAdmin = 0;

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO users (id, username, display_name, password_hash, password_salt, is_admin, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    ).bind(userId, username, input.displayName, hash, salt, isAdmin, now),
    env.DB.prepare("INSERT INTO league_members (league_id, user_id, role, joined_at) VALUES ('fortilin', ?1, 'member', ?2)").bind(userId, now)
  ]);

  return {
    id: userId,
    username,
    displayName: input.displayName,
    avatarUrl: null,
    isAdmin: false,
    leagueId: "fortilin"
  };
}

export async function loginUser(env: Env, username: string, password: string): Promise<AuthUser> {
  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, u.password_hash, u.password_salt, u.is_admin, lm.league_id
     FROM users u
     LEFT JOIN league_members lm ON lm.user_id = u.id
     WHERE u.username = ?1
     LIMIT 1`
  )
    .bind(username.toLowerCase())
    .first<{
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
      password_hash: string;
      password_salt: string;
      is_admin: number;
      league_id: string | null;
    }>();

  if (!row || !(await verifyPassword(password, row.password_salt, row.password_hash))) {
    throw new HttpError(401, "Usuario o contraseña incorrectos.");
  }

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isAdmin: row.is_admin === 1,
    leagueId: row.league_id ?? "fortilin"
  };
}
