import { getLockAt } from "../../domain/scoring";
import { teamId } from "../../shared/fixtures";
import type { MatchGoal, MatchStatus, Team } from "../../shared/types";
import type { Env } from "../types";

export type OpenLigaDbTeam = {
  teamID?: number;
  teamId?: number;
  teamName: string;
  shortName?: string;
  teamIconUrl?: string | null;
};

export type OpenLigaDbResult = {
  resultID?: number;
  resultName?: string;
  resultDescription?: string;
  resultOrderID?: number;
  resultTypeID?: number;
  pointsTeam1: number;
  pointsTeam2: number;
};

export type OpenLigaDbMatch = {
  matchID: number;
  matchDateTime: string;
  matchDateTimeUTC?: string;
  team1: OpenLigaDbTeam;
  team2: OpenLigaDbTeam;
  matchIsFinished: boolean;
  matchResults?: OpenLigaDbResult[];
  goals?: Array<{
    goalID?: number;
    scoreTeam1: number;
    scoreTeam2: number;
    matchMinute?: number | null;
    goalGetterName?: string | null;
    isPenalty?: boolean;
    isOwnGoal?: boolean;
    isOvertime?: boolean;
  }>;
  group?: {
    groupName?: string;
    groupOrderID?: number;
  };
};

export type ParsedOpenLigaDbMatch = {
  providerMatchId: number;
  kickoffAt: string;
  lockAt: string;
  homeTeam: Team;
  awayTeam: Team;
  round: string;
  matchday: number | null;
  groupName: string | null;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  goals: MatchGoal[];
};

type OpenLigaDbConfig = {
  baseUrl: string;
  leagueShortcut: string;
  season: string;
};

export function getOpenLigaDbConfig(env: Env): OpenLigaDbConfig | null {
  const leagueShortcut = env.OPENLIGADB_LEAGUE_SHORTCUT?.trim();
  const season = env.OPENLIGADB_SEASON?.trim();
  if (!leagueShortcut || !season) return null;

  return {
    baseUrl: (env.OPENLIGADB_BASE_URL || "https://api.openligadb.de").replace(/\/+$/, ""),
    leagueShortcut,
    season
  };
}

export async function fetchOpenLigaDbMatches(env: Env): Promise<OpenLigaDbMatch[]> {
  const config = getOpenLigaDbConfig(env);
  if (!config) {
    console.error("OPENLIGADB CONFIG MISSING", {
      hasShortcut: Boolean(env.OPENLIGADB_LEAGUE_SHORTCUT),
      hasSeason: Boolean(env.OPENLIGADB_SEASON)
    });
    return [];
  }

  return fetchJson<OpenLigaDbMatch[]>(`${config.baseUrl}/getmatchdata/${config.leagueShortcut}/${config.season}`);
}

export async function fetchOpenLigaDbTeams(env: Env): Promise<OpenLigaDbTeam[]> {
  const config = getOpenLigaDbConfig(env);
  if (!config) return [];

  return fetchJson<OpenLigaDbTeam[]>(`${config.baseUrl}/getavailableteams/${config.leagueShortcut}/${config.season}`);
}

export function parseOpenLigaDbMatch(match: OpenLigaDbMatch): ParsedOpenLigaDbMatch {
  const kickoffAt = normalizeKickoff(match.matchDateTimeUTC || match.matchDateTime);
  const finalResult = selectFinalResult(match.matchResults || []);
  const status = getStatus(match, kickoffAt);

  return {
    providerMatchId: match.matchID,
    kickoffAt,
    lockAt: getLockAt(kickoffAt),
    homeTeam: parseTeam(match.team1),
    awayTeam: parseTeam(match.team2),
    round: match.group?.groupName || "OpenLigaDB",
    matchday: match.group?.groupOrderID ?? null,
    groupName: match.group?.groupName ?? null,
    status,
    homeScore: finalResult?.pointsTeam1 ?? null,
    awayScore: finalResult?.pointsTeam2 ?? null,
    goals: parseGoals(match.goals || [])
  };
}

function parseGoals(goals: NonNullable<OpenLigaDbMatch["goals"]>): MatchGoal[] {
  return goals
    .filter((goal) => Number.isFinite(goal.scoreTeam1) && Number.isFinite(goal.scoreTeam2))
    .map((goal) => ({
      minute: goal.matchMinute ?? null,
      scorerName: goal.goalGetterName?.trim() || null,
      homeScore: goal.scoreTeam1,
      awayScore: goal.scoreTeam2,
      isPenalty: goal.isPenalty === true,
      isOwnGoal: goal.isOwnGoal === true,
      isOvertime: goal.isOvertime === true
    }));
}

export function selectFinalResult(results: OpenLigaDbResult[]): OpenLigaDbResult | null {
  if (results.length === 0) return null;

  const byType = results.find((result) => result.resultTypeID === 2);
  if (byType) return byType;

  const byName = results.find((result) => {
    const text = `${result.resultName || ""} ${result.resultDescription || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return text.includes("endergebnis") || text.includes("final") || text.includes("endstand");
  });
  if (byName) return byName;

  return [...results].sort((left, right) => {
    const leftOrder = left.resultOrderID ?? left.resultID ?? 0;
    const rightOrder = right.resultOrderID ?? right.resultID ?? 0;
    return rightOrder - leftOrder;
  })[0] ?? null;
}

function parseTeam(team: OpenLigaDbTeam): Team {
  return {
    id: teamId(team.teamName),
    name: team.teamName,
    shortCode: team.shortName || team.teamName.slice(0, 3).toUpperCase(),
    logoUrl: team.teamIconUrl || null
  };
}

function normalizeKickoff(value: string): string {
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function getStatus(match: OpenLigaDbMatch, kickoffAt: string): MatchStatus {
  if (match.matchIsFinished) return "finished";

  const kickoffTime = new Date(kickoffAt).getTime();
  const now = Date.now();
  if (kickoffTime <= now && now - kickoffTime <= 3 * 60 * 60 * 1000) return "live";
  return "scheduled";
}

async function fetchJson<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) {
      console.error("OPENLIGADB HTTP ERROR", { url, status: response.status });
      return [] as T;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("OPENLIGADB FETCH ERROR", { url, error });
    return [] as T;
  }
}
