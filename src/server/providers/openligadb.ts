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
    goalID?: number | string | null;
    scoreTeam1: number | string | null;
    scoreTeam2: number | string | null;
    matchMinute?: number | string | null;
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

type ParsedGoal = MatchGoal & {
  providerGoalId: number | null;
};

type MatchScore = Pick<MatchGoal, "homeScore" | "awayScore">;

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
  const parsedGoals = parseGoals(match.goals || []);
  const results = match.matchResults || [];
  const regularTimeResult = selectRegularTimeResult(results);
  const extraTimeResult = selectExtraTimeResult(results);
  const penaltyResult = selectPenaltyShootoutResult(results);
  const finalResult = penaltyResult ?? extraTimeResult ?? regularTimeResult;
  const fallbackScore = getLatestGoalScore(parsedGoals);
  const regularTimeScore = selectRegularTimeScore(parsedGoals, regularTimeResult, extraTimeResult, penaltyResult);
  const visibleScore = selectVisibleScore(match, regularTimeScore, fallbackScore);
  const status = getStatus(match, kickoffAt, finalResult);
  const goals = completeGoalTimeline(parsedGoals, visibleScore);

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

function parseGoals(goals: NonNullable<OpenLigaDbMatch["goals"]>): ParsedGoal[] {
  return goals
    .map((goal) => {
      const homeScore = numberOrNull(goal.scoreTeam1);
      const awayScore = numberOrNull(goal.scoreTeam2);
      if (homeScore === null || awayScore === null) return null;
      const minute = numberOrNull(goal.matchMinute);
      if (isPenaltyShootoutGoal(goal, minute)) return null;

      return {
        minute,
        scorerName: goal.goalGetterName?.trim() || null,
        homeScore,
        awayScore,
        isPenalty: goal.isPenalty === true,
        isOwnGoal: goal.isOwnGoal === true,
        isOvertime: goal.isOvertime === true,
        providerGoalId: numberOrNull(goal.goalID)
      };
    })
    .filter((goal): goal is ParsedGoal => goal !== null)
    .sort(compareParsedGoals);
}

function isPenaltyShootoutGoal(goal: NonNullable<OpenLigaDbMatch["goals"]>[number], minute: number | null): boolean {
  return minute === null && goal.isPenalty === true;
}

function completeGoalTimeline(
  goals: ParsedGoal[],
  finalScore: Pick<MatchGoal, "homeScore" | "awayScore"> | null
): MatchGoal[] {
  let previous = { homeScore: 0, awayScore: 0 };
  const complete: ParsedGoal[] = [];

  for (const goal of goals) {
    complete.push(...createMissingGoalsBefore(previous, goal), goal);
    previous = { homeScore: goal.homeScore, awayScore: goal.awayScore };
  }

  if (finalScore) {
    complete.push(...createPlaceholderGoals(previous, finalScore, null));
  }

  return complete.map(toMatchGoal);
}

function createMissingGoalsBefore(previous: Pick<MatchGoal, "homeScore" | "awayScore">, current: ParsedGoal): ParsedGoal[] {
  const homeDelta = current.homeScore - previous.homeScore;
  const awayDelta = current.awayScore - previous.awayScore;
  if (homeDelta < 0 || awayDelta < 0 || homeDelta + awayDelta <= 1) return [];

  const currentGoalSide = homeDelta > 0 ? "home" : "away";
  const targetBeforeCurrent = {
    homeScore: current.homeScore - (currentGoalSide === "home" ? 1 : 0),
    awayScore: current.awayScore - (currentGoalSide === "away" ? 1 : 0)
  };
  return createPlaceholderGoals(previous, targetBeforeCurrent, current.minute);
}

function createPlaceholderGoals(
  previous: Pick<MatchGoal, "homeScore" | "awayScore">,
  target: Pick<MatchGoal, "homeScore" | "awayScore">,
  minute: number | null
): ParsedGoal[] {
  let homeScore = previous.homeScore;
  let awayScore = previous.awayScore;
  const goals: ParsedGoal[] = [];

  while (homeScore < target.homeScore || awayScore < target.awayScore) {
    if (homeScore < target.homeScore) {
      homeScore += 1;
    } else {
      awayScore += 1;
    }

    goals.push({
      minute,
      scorerName: "Gol por confirmar",
      homeScore,
      awayScore,
      isPenalty: false,
      isOwnGoal: false,
      isOvertime: false,
      providerGoalId: null
    });
  }

  return goals;
}

function compareParsedGoals(left: ParsedGoal, right: ParsedGoal): number {
  const minuteDiff = (left.minute ?? 999) - (right.minute ?? 999);
  if (minuteDiff !== 0) return minuteDiff;

  const scoreDiff = left.homeScore + left.awayScore - (right.homeScore + right.awayScore);
  if (scoreDiff !== 0) return scoreDiff;

  const idDiff = (left.providerGoalId ?? Number.MAX_SAFE_INTEGER) - (right.providerGoalId ?? Number.MAX_SAFE_INTEGER);
  if (idDiff !== 0) return idDiff;

  return left.homeScore - right.homeScore || left.awayScore - right.awayScore;
}

function toMatchGoal(goal: ParsedGoal): MatchGoal {
  const { providerGoalId: _providerGoalId, ...matchGoal } = goal;
  return matchGoal;
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

function getLatestGoalScore(goals: MatchGoal[]): MatchScore | null {
  if (goals.length === 0) return null;
  return goals[goals.length - 1] ?? null;
}

function selectRegularTimeScore(
  goals: ParsedGoal[],
  regularTimeResult: OpenLigaDbResult | null,
  extraTimeResult: OpenLigaDbResult | null,
  penaltyResult: OpenLigaDbResult | null
): MatchScore | null {
  const publishedRegularTimeScore = resultToScore(regularTimeResult);
  const hasKnockoutDecider = extraTimeResult !== null || penaltyResult !== null;
  if (!hasKnockoutDecider) return publishedRegularTimeScore;

  const scoreFromGoals = getScoreAtRegularTimeEnd(goals);
  if (scoreFromGoals) return scoreFromGoals;

  return resultToScore(extraTimeResult) ?? publishedRegularTimeScore;
}

function getScoreAtRegularTimeEnd(goals: ParsedGoal[]): MatchScore | null {
  let previous: MatchScore = { homeScore: 0, awayScore: 0 };
  let sawGoal = false;

  for (const goal of goals) {
    if (isExtraTimeGoal(goal)) return getScoreBeforeGoal(previous, goal);
    previous = { homeScore: goal.homeScore, awayScore: goal.awayScore };
    sawGoal = true;
  }

  return sawGoal ? previous : null;
}

function isExtraTimeGoal(goal: ParsedGoal): boolean {
  return goal.minute !== null && goal.minute > 90 && goal.isOvertime !== true;
}

function getScoreBeforeGoal(previous: MatchScore, current: MatchScore): MatchScore {
  const homeDelta = current.homeScore - previous.homeScore;
  const awayDelta = current.awayScore - previous.awayScore;
  if (homeDelta <= 0 && awayDelta <= 0) return previous;
  if (homeDelta > 0) return { homeScore: current.homeScore - 1, awayScore: current.awayScore };
  return { homeScore: current.homeScore, awayScore: current.awayScore - 1 };
}

function resultToScore(result: OpenLigaDbResult | null): MatchScore | null {
  return result ? { homeScore: result.pointsTeam1, awayScore: result.pointsTeam2 } : null;
}

function selectVisibleScore(
  match: OpenLigaDbMatch,
  publishedScore: MatchScore | null,
  fallbackScore: MatchScore | null
): MatchScore | null {
  if (!match.matchIsFinished && fallbackScore) return fallbackScore;
  if (publishedScore) return publishedScore;
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

function numberOrNull(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
