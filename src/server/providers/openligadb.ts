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
    goalGetterID?: number | null;
    goalGetterId?: number | null;
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

export type OpenLigaDbGoalGetter = {
  goalGetterId?: number;
  goalGetterID?: number;
  goalGetterName: string;
  goalCount: number;
};

export type OpenLigaDbStanding = {
  teamInfoId: number;
  teamName: string;
  shortName?: string | null;
  teamIconUrl?: string | null;
  points: number;
  opponentGoals: number;
  goals: number;
  matches: number;
  won: number;
  lost: number;
  draw: number;
  goalDiff: number;
};

export type ParsedOpenLigaDbStanding = {
  providerTeamId: number;
  providerTeamName: string;
  shortCode: string | null;
  logoUrl: string | null;
  points: number;
  goalsAgainst: number;
  goalsFor: number;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  goalDiff: number;
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
  extraHomeScore: number | null;
  extraAwayScore: number | null;
  penaltyHomeScore: number | null;
  penaltyAwayScore: number | null;
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

export async function fetchOpenLigaDbMatches(env: Env, groupOrderIds: number[] = []): Promise<OpenLigaDbMatch[]> {
  const config = getOpenLigaDbConfig(env);
  if (!config) {
    console.error("OPENLIGADB CONFIG MISSING", {
      hasShortcut: Boolean(env.OPENLIGADB_LEAGUE_SHORTCUT),
      hasSeason: Boolean(env.OPENLIGADB_SEASON)
    });
    return [];
  }

  const uniqueGroupOrderIds = [...new Set(groupOrderIds.filter((groupOrderId) => Number.isFinite(groupOrderId)))];
  const matches =
    uniqueGroupOrderIds.length > 0
      ? (
          await Promise.all(
            uniqueGroupOrderIds.map((groupOrderId) =>
              fetchJson<OpenLigaDbMatch[]>(`${config.baseUrl}/getmatchdata/${config.leagueShortcut}/${config.season}/${groupOrderId}`)
            )
          )
        ).flat()
      : await fetchJson<OpenLigaDbMatch[]>(`${config.baseUrl}/getmatchdata/${config.leagueShortcut}/${config.season}`);
  const goalGetters = await fetchJson<OpenLigaDbGoalGetter[]>(`${config.baseUrl}/getgoalgetters/${config.leagueShortcut}/${config.season}`);
  return enrichGoalGetterNames(matches, goalGetters);
}

export async function fetchOpenLigaDbTeams(env: Env): Promise<OpenLigaDbTeam[]> {
  const config = getOpenLigaDbConfig(env);
  if (!config) return [];

  return fetchJson<OpenLigaDbTeam[]>(`${config.baseUrl}/getavailableteams/${config.leagueShortcut}/${config.season}`);
}

export async function fetchOpenLigaDbStandings(env: Env): Promise<OpenLigaDbStanding[]> {
  const config = getOpenLigaDbConfig(env);
  if (!config) return [];

  return fetchJson<OpenLigaDbStanding[]>(`${config.baseUrl}/getbltable/${config.leagueShortcut}/${config.season}`);
}

export function parseOpenLigaDbMatch(match: OpenLigaDbMatch): ParsedOpenLigaDbMatch {
  const kickoffAt = normalizeKickoff(match.matchDateTimeUTC || match.matchDateTime);
  const goals = parseGoals(match.goals || []);
  const results = match.matchResults || [];
  const regularTimeResult = selectRegularTimeResult(results);
  const extraTimeResult = selectExtraTimeResult(results);
  const penaltyResult = selectPenaltyShootoutResult(results);
  const finalResult = penaltyResult ?? extraTimeResult ?? regularTimeResult;
  const fallbackScore = getLatestGoalScore(goals);
  const visibleScore = selectVisibleScore(match, extraTimeResult ?? regularTimeResult, fallbackScore);
  const status = getStatus(match, kickoffAt, finalResult);

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
    homeScore: visibleScore?.homeScore ?? null,
    awayScore: visibleScore?.awayScore ?? null,
    extraHomeScore: extraTimeResult?.pointsTeam1 ?? null,
    extraAwayScore: extraTimeResult?.pointsTeam2 ?? null,
    penaltyHomeScore: penaltyResult?.pointsTeam1 ?? null,
    penaltyAwayScore: penaltyResult?.pointsTeam2 ?? null,
    goals
  };
}

export function parseOpenLigaDbStanding(row: OpenLigaDbStanding): ParsedOpenLigaDbStanding {
  return {
    providerTeamId: row.teamInfoId,
    providerTeamName: row.teamName,
    shortCode: row.shortName || null,
    logoUrl: normalizeLogoUrl(row.teamIconUrl),
    points: numberOrZero(row.points),
    goalsAgainst: numberOrZero(row.opponentGoals),
    goalsFor: numberOrZero(row.goals),
    played: numberOrZero(row.matches),
    won: numberOrZero(row.won),
    lost: numberOrZero(row.lost),
    drawn: numberOrZero(row.draw),
    goalDiff: numberOrZero(row.goalDiff)
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

function enrichGoalGetterNames(matches: OpenLigaDbMatch[], goalGetters: OpenLigaDbGoalGetter[]): OpenLigaDbMatch[] {
  if (goalGetters.length === 0) return matches;

  const byId = new Map<number, string>();
  for (const goalGetter of goalGetters) {
    const id = getGoalGetterId(goalGetter);
    if (id !== null) byId.set(id, goalGetter.goalGetterName);
  }
  return matches.map((match) => ({
    ...match,
    goals: match.goals?.map((goal) => ({
      ...goal,
      goalGetterName: goal.goalGetterName?.trim() || resolveGoalGetterName(goal, byId)
    }))
  }));
}

function getLatestGoalScore(goals: MatchGoal[]): Pick<MatchGoal, "homeScore" | "awayScore"> | null {
  if (goals.length === 0) return null;
  return goals[goals.length - 1] ?? null;
}

function selectVisibleScore(
  match: OpenLigaDbMatch,
  finalResult: OpenLigaDbResult | null,
  fallbackScore: Pick<MatchGoal, "homeScore" | "awayScore"> | null
): Pick<MatchGoal, "homeScore" | "awayScore"> | null {
  if (!match.matchIsFinished && fallbackScore) return fallbackScore;
  if (finalResult) return { homeScore: finalResult.pointsTeam1, awayScore: finalResult.pointsTeam2 };
  return fallbackScore;
}

function resolveGoalGetterName(goal: NonNullable<OpenLigaDbMatch["goals"]>[number], byId: Map<number, string>): string {
  const id = getGoalGetterId(goal);
  return id === null ? "" : byId.get(id) ?? "";
}

function getGoalGetterId(value: { goalGetterID?: number | null; goalGetterId?: number | null }): number | null {
  const id = value.goalGetterID ?? value.goalGetterId ?? null;
  return Number.isFinite(id) ? Number(id) : null;
}

export function selectFinalResult(results: OpenLigaDbResult[]): OpenLigaDbResult | null {
  if (results.length === 0) return null;

  return selectPenaltyShootoutResult(results) ?? selectExtraTimeResult(results) ?? selectRegularTimeResult(results) ?? selectHighestOrderResult(results);
}

export function selectRegularTimeResult(results: OpenLigaDbResult[]): OpenLigaDbResult | null {
  const byType = results.find((result) => result.resultTypeID === 2);
  if (byType) return byType;

  const byName = results.find((result) => {
    const text = `${result.resultName || ""} ${result.resultDescription || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return text.includes("endergebnis") || text.includes("nach 90") || text.includes("offiziellen spielzeit");
  });
  return byName ?? null;
}

export function selectExtraTimeResult(results: OpenLigaDbResult[]): OpenLigaDbResult | null {
  const byType = results.find((result) => result.resultTypeID === 4);
  if (byType) return byType;

  const byName = results.find((result) => {
    const text = `${result.resultName || ""} ${result.resultDescription || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return text.includes("verlangerung") || text.includes("extra time");
  });
  return byName ?? null;
}

export function selectPenaltyShootoutResult(results: OpenLigaDbResult[]): OpenLigaDbResult | null {
  const byType = results.find((result) => result.resultTypeID === 5);
  if (byType) return byType;

  const byName = results.find((result) => {
    const text = `${result.resultName || ""} ${result.resultDescription || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return text.includes("elfmeterschiessen") || text.includes("penalt");
  });
  return byName ?? null;
}

function selectHighestOrderResult(results: OpenLigaDbResult[]): OpenLigaDbResult | null {
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
    logoUrl: normalizeLogoUrl(team.teamIconUrl)
  };
}

export function normalizeLogoUrl(value?: string | null): string | null {
  if (!value) return null;
  return value.replace(/^http:\/\//i, "https://");
}

function normalizeKickoff(value: string): string {
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function getStatus(match: OpenLigaDbMatch, kickoffAt: string, finalResult: OpenLigaDbResult | null): MatchStatus {
  if (match.matchIsFinished) return "finished";

  const kickoffTime = new Date(kickoffAt).getTime();
  const now = Date.now();
  const elapsed = now - kickoffTime;
  const liveWindow = getLiveWindowMs(match);
  if (finalResult && elapsed >= liveWindow) return "finished";
  if (kickoffTime <= now && elapsed <= liveWindow) return "live";
  return "scheduled";
}

function getLiveWindowMs(match: OpenLigaDbMatch): number {
  const groupOrder = match.group?.groupOrderID ?? 0;
  const groupStageWindow = 270 * 60 * 1000;
  const knockoutWindow = 330 * 60 * 1000;
  return groupOrder > 0 && groupOrder <= 3 ? groupStageWindow : knockoutWindow;
}

function numberOrZero(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
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
