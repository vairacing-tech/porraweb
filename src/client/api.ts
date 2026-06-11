import { initialMatches, initialTeams } from "../shared/fixtures";
import type { BonusPrediction, LeaderboardRow, Match, SquadPlayer, Team } from "../shared/types";

export interface BootstrapData {
  appName: string;
  league: { id: string; name: string };
  user: { id: string; username: string; displayName: string; isAdmin: boolean; leagueId: string } | null;
  teams: Team[];
  squadPlayers: SquadPlayer[];
  matches: Array<Match & { myPrediction?: { id: string; homeScore: number; awayScore: number; points: number; outcome: string } | null }>;
  nextMatch: (Match & { myPrediction?: { id: string; homeScore: number; awayScore: number; points: number; outcome: string } | null }) | null;
  leaderboard: LeaderboardRow[];
  bonus: BonusPrediction | null;
  adminUsers?: AdminUser[];
  now: string;
  isDemo?: boolean;
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isAdmin: boolean;
}

export interface RegisterInput {
  username: string;
  displayName: string;
  password: string;
  bonus: {
    championTeamId: string | null;
    runnerUpTeamId: string | null;
    topScorerTeamId: string | null;
    topScorerPlayerId: number | null;
  };
}

export async function fetchBootstrap(): Promise<BootstrapData> {
  try {
    return await request<BootstrapData>("/api/bootstrap");
  } catch {
    return demoBootstrap();
  }
}

export async function login(username: string, password: string): Promise<void> {
  await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export async function register(input: RegisterInput): Promise<void> {
  await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function logout(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
}

export function setDemoSession(input: { username: string; displayName: string; isAdmin: boolean }): void {
  localStorage.setItem("pf_demo_user", JSON.stringify(input));
}

export function clearDemoSession(): void {
  localStorage.removeItem("pf_demo_user");
}

export async function savePrediction(matchId: string, homeScore: number, awayScore: number): Promise<void> {
  await request(`/api/predictions/${matchId}`, {
    method: "PUT",
    body: JSON.stringify({ homeScore, awayScore })
  });
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  await request(`/api/admin/users/${userId}/password`, {
    method: "PUT",
    body: JSON.stringify({ newPassword })
  });
}

export async function setUserPrediction(userId: string, matchId: string, homeScore: number, awayScore: number): Promise<void> {
  await request(`/api/admin/users/${userId}/predictions/${matchId}`, {
    method: "PUT",
    body: JSON.stringify({ homeScore, awayScore })
  });
}

export async function syncSquads(): Promise<{ message: string; requestsUsed: number }> {
  return await request<{ message: string; requestsUsed: number }>("/api/admin/sync-squads", { method: "POST" });
}

export async function syncResults(): Promise<{ message: string; requestsUsed: number }> {
  return await request<{ message: string; requestsUsed: number }>("/api/admin/sync-results", { method: "POST" });
}

export async function setMatchResult(matchId: string, homeScore: number, awayScore: number): Promise<void> {
  await request(`/api/admin/matches/${matchId}/result`, {
    method: "PUT",
    body: JSON.stringify({ homeScore, awayScore, status: "finished" })
  });
}

export async function setDoublePoints(matchId: string, isDoublePoints: boolean): Promise<void> {
  await request(`/api/admin/matches/${matchId}/double-points`, {
    method: "PUT",
    body: JSON.stringify({ isDoublePoints })
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init.headers || {})
    },
    ...init
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("La API no devolvio JSON.");
  }

  const data = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Error de red.");
  }
  return data as T;
}

function demoBootstrap(): BootstrapData {
  const storedUser = getDemoUser();
  const teams = initialTeams.map((team) => ({
    id: team.id,
    name: team.name,
    shortCode: team.shortCode
  }));
  const byId = new Map(teams.map((team) => [team.id, team]));
  const matches = initialMatches.map((match, index) => ({
    id: match.id,
    stage: match.stage,
    round: match.round,
    matchday: match.matchday,
    groupName: match.groupName,
    homeTeam: byId.get(match.homeTeamId)!,
    awayTeam: byId.get(match.awayTeamId)!,
    kickoffAt: match.kickoffAt,
    lockAt: match.lockAt,
    status: index === 0 ? "live" : "scheduled",
    homeScore: null,
    awayScore: null,
    extraHomeScore: null,
    extraAwayScore: null,
    penaltyHomeScore: null,
    penaltyAwayScore: null,
    goals: [],
    isDoublePoints: match.isDoublePoints,
    myPrediction: null
  })) satisfies BootstrapData["matches"];
  const nextMatch = matches.find((match) => new Date(match.kickoffAt).getTime() > Date.now()) ?? matches[0];

  return {
    appName: "Porra Fortilin",
    league: { id: "fortilin", name: "Fortilin" },
    user: storedUser
      ? {
          id: storedUser.isAdmin ? "demo-admin" : "demo-user",
          username: storedUser.username,
          displayName: storedUser.displayName,
          isAdmin: storedUser.isAdmin,
          leagueId: "fortilin"
        }
      : null,
    teams,
    squadPlayers: [],
    matches,
    nextMatch,
    leaderboard: storedUser && !storedUser.isAdmin
      ? [{ userId: "demo-user", displayName: storedUser.displayName, points: 0, exacts: 0, championHit: false, rank: 1 }]
      : [],
    bonus: null,
    adminUsers: storedUser?.isAdmin ? [] : undefined,
    now: new Date().toISOString(),
    isDemo: true
  };
}

function getDemoUser(): { username: string; displayName: string; isAdmin: boolean } | null {
  const raw = localStorage.getItem("pf_demo_user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { username?: string; displayName?: string; isAdmin?: boolean };
    if (!parsed.username || !parsed.displayName) return null;
    return { username: parsed.username, displayName: parsed.displayName, isAdmin: parsed.isAdmin === true };
  } catch {
    return null;
  }
}
