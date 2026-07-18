import type {
  AchievementLeaderboardRow,
  BonusPrediction,
  LeaderboardRow,
  Match,
  Prediction,
  SquadPlayer,
  Team,
  UserAchievement,
  WorldStanding
} from "../shared/types";

export interface BootstrapData {
  appName: string;
  league: { id: string; name: string };
  user: { id: string; username: string; displayName: string; avatarUrl: string | null; isAdmin: boolean; leagueId: string } | null;
  teams: Team[];
  squadPlayers: SquadPlayer[];
  worldStandings: WorldStanding[];
  matches: Array<Match & { myPrediction?: { id: string; homeScore: number; awayScore: number; points: number; outcome: string } | null }>;
  nextMatch: (Match & { myPrediction?: { id: string; homeScore: number; awayScore: number; points: number; outcome: string } | null }) | null;
  leaderboard: LeaderboardRow[];
  bonus: BonusPrediction | null;
  achievements: UserAchievement[];
  achievementLeaderboard: AchievementLeaderboardRow[];
  adminUsers?: AdminUser[];
  adminPredictions?: Prediction[];
  now: string;
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isAdmin: boolean;
  bonus: BonusPrediction | null;
}

export interface VisiblePrediction {
  displayName: string;
  homeScore: number;
  awayScore: number;
  points: number;
  outcome: string;
}

export interface UserClosedSummary {
  user: { id: string; username: string; displayName: string };
  bonus: BonusPrediction | null;
  achievements: UserAchievement[];
  predictions: Array<Prediction & { kickoffAt: string }>;
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
  return await request<BootstrapData>("/api/bootstrap");
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

export async function updateProfile(displayName: string): Promise<void> {
  await request("/api/profile", {
    method: "PUT",
    body: JSON.stringify({ displayName })
  });
}

export async function updateAvatar(avatarUrl: string | null): Promise<void> {
  await request("/api/profile/avatar", {
    method: "PUT",
    body: JSON.stringify({ avatarUrl })
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request("/api/profile/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword })
  });
}

export async function savePrediction(matchId: string, homeScore: number, awayScore: number): Promise<void> {
  await request(`/api/predictions/${matchId}`, {
    method: "PUT",
    body: JSON.stringify({ homeScore, awayScore })
  });
}

export async function fetchMatchPredictions(matchId: string): Promise<VisiblePrediction[]> {
  const data = await request<{ predictions: VisiblePrediction[] }>(`/api/matches/${matchId}/predictions`);
  return data.predictions;
}

export async function fetchUserSummary(userId: string): Promise<UserClosedSummary> {
  return await request<UserClosedSummary>(`/api/users/${userId}/summary`);
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  await request(`/api/admin/users/${userId}/password`, {
    method: "PUT",
    body: JSON.stringify({ newPassword })
  });
}

export async function deleteUser(userId: string): Promise<void> {
  await request(`/api/admin/users/${userId}`, { method: "DELETE" });
}

export async function setUserPrediction(userId: string, matchId: string, homeScore: number, awayScore: number): Promise<void> {
  await request(`/api/admin/users/${userId}/predictions/${matchId}`, {
    method: "PUT",
    body: JSON.stringify({ homeScore, awayScore })
  });
}

export async function setUserBonus(userId: string, bonus: RegisterInput["bonus"]): Promise<void> {
  await request(`/api/admin/users/${userId}/bonus`, {
    method: "PUT",
    body: JSON.stringify(bonus)
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
  const method = (init.method || "GET").toUpperCase();
  const maxAttempts = method === "GET" ? 3 : 1;
  let response: Response | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      response = await fetch(path, {
        credentials: "include",
        headers: {
          "content-type": "application/json",
          ...(init.headers || {})
        },
        ...init
      });
      break;
    } catch {
      if (attempt === maxAttempts) {
        throw new Error("No se pudo conectar con la API. Reintenta en unos segundos.");
      }
      await wait(500 * attempt);
    }
  }
  if (!response) throw new Error("No se pudo conectar con la API. Reintenta en unos segundos.");

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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
