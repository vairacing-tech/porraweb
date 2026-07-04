import { createId } from "./crypto";
import { ensureSeeded, recalculateMatch } from "./db";
import { safeEvaluateAchievements } from "./achievements";
import { resolveKnockoutMatches } from "./knockout";
import {
  fetchOpenLigaDbMatches,
  fetchOpenLigaDbTeams,
  normalizeLogoUrl,
  parseOpenLigaDbMatch,
  type ParsedOpenLigaDbMatch
} from "./providers/openligadb";
import type { MatchGoal } from "../shared/types";
import type { Env } from "./types";

type MatchSyncRow = {
  id: string;
  api_fixture_id: number | null;
  stage: string;
  kickoff_at: string;
  matchday: number | null;
  group_name: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  extra_home_score: number | null;
  extra_away_score: number | null;
  penalty_home_score: number | null;
  penalty_away_score: number | null;
  goals_json: string | null;
  home_team_id: string;
  away_team_id: string;
};

type MatchApplyResult = {
  linked: number;
  updated: number;
  finishedFromLive: number;
  liveStandingGroups: Set<string>;
};

type GroupStandingMatch = {
  groupName: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: GroupStandingTeam;
  awayTeam: GroupStandingTeam;
};

type GroupStandingTeam = {
  id: string;
  providerTeamId: number | null;
  name: string;
  shortCode: string | null;
  logoUrl: string | null;
};

export type CalculatedGroupStanding = {
  teamId: string;
  providerTeamId: number | null;
  groupName: string;
  rank: number;
  teamName: string;
  shortCode: string | null;
  logoUrl: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

type ResultSyncMode = "force" | "adaptive";

type ResultSyncDecision = {
  shouldRun: boolean;
  cadence: "live" | "hourly" | "recent";
  includeAuxiliaryData: boolean;
  provider: "openligadb" | "openligadb-live";
  message: string;
};

const syncTargetLookbehindMs = 7 * 60 * 60 * 1000;
const finishedCorrectionLookbehindMs = 48 * 60 * 60 * 1000;
const syncTargetLookaheadMs = 3 * 60 * 60 * 1000;
const activeMatchLookbehindMs = 7 * 60 * 60 * 1000;
const activeMatchLookaheadMs = 15 * 60 * 1000;
const hourlySyncIntervalMs = 60 * 60 * 1000;

const providerNameToTeamId: Record<string, string> = {
  "algeria": "argelia",
  "algerien": "argelia",
  "argentina": "argentina",
  "argentinien": "argentina",
  "australia": "australia",
  "australien": "australia",
  "austria": "austria",
  "osterreich": "austria",
  "oesterreich": "austria",
  "belgium": "belgica",
  "belgien": "belgica",
  "bosnia and herzegovina": "bosnia-y-herzegovina",
  "bosnien und herzegowina": "bosnia-y-herzegovina",
  "brazil": "brasil",
  "brasilien": "brasil",
  "canada": "canada",
  "kanada": "canada",
  "cape verde": "cabo-verde",
  "kap verde": "cabo-verde",
  "colombia": "colombia",
  "kolumbien": "colombia",
  "croatia": "croacia",
  "kroatien": "croacia",
  "curacao": "curazao",
  "czech republic": "republica-checa",
  "czechia": "republica-checa",
  "tschechien": "republica-checa",
  "democratic republic of the congo": "rd-congo",
  "congo dr": "rd-congo",
  "dr congo": "rd-congo",
  "dr kongo": "rd-congo",
  "ecuador": "ecuador",
  "egypt": "egipto",
  "aegypten": "egipto",
  "agypten": "egipto",
  "england": "inglaterra",
  "france": "francia",
  "frankreich": "francia",
  "germany": "alemania",
  "deutschland": "alemania",
  "ghana": "ghana",
  "haiti": "haiti",
  "iran": "iran",
  "iraq": "irak",
  "irak": "irak",
  "ivory coast": "costa-de-marfil",
  "cote d ivoire": "costa-de-marfil",
  "elfenbeinkuste": "costa-de-marfil",
  "japan": "japon",
  "jordan": "jordania",
  "jordanien": "jordania",
  "korea republic": "corea-del-sur",
  "south korea": "corea-del-sur",
  "sudkorea": "corea-del-sur",
  "suedkorea": "corea-del-sur",
  "mexico": "mexico",
  "mexiko": "mexico",
  "morocco": "marruecos",
  "marokko": "marruecos",
  "netherlands": "paises-bajos",
  "niederlande": "paises-bajos",
  "new zealand": "nueva-zelanda",
  "neuseeland": "nueva-zelanda",
  "norway": "noruega",
  "norwegen": "noruega",
  "panama": "panama",
  "paraguay": "paraguay",
  "portugal": "portugal",
  "qatar": "catar",
  "katar": "catar",
  "saudi arabia": "arabia-saudi",
  "saudi arabien": "arabia-saudi",
  "scotland": "escocia",
  "schottland": "escocia",
  "senegal": "senegal",
  "south africa": "sudafrica",
  "sudafrika": "sudafrica",
  "suedafrika": "sudafrica",
  "spain": "espana",
  "spanien": "espana",
  "sweden": "suecia",
  "schweden": "suecia",
  "switzerland": "suiza",
  "schweiz": "suiza",
  "tunisia": "tunez",
  "tunesien": "tunez",
  "turkey": "turquia",
  "turkei": "turquia",
  "tuerkei": "turquia",
  "united states": "estados-unidos",
  "united states of america": "estados-unidos",
  "usa": "estados-unidos",
  "vereinigte staaten": "estados-unidos",
  "uruguay": "uruguay",
  "uzbekistan": "uzbekistan",
  "usbekistan": "uzbekistan"
};

const normalizedProviderNameToTeamId = Object.entries(providerNameToTeamId).reduce<Record<string, string>>((accumulator, [name, localId]) => {
  accumulator[normalizeProviderName(name)] = localId;
  return accumulator;
}, {});

export async function runSquadSync(env: Env): Promise<{ ok: boolean; requestsUsed: number; message: string }> {
  await ensureSeeded(env);

  const localSquads = await getLocalSquadSummary(env);
  if (localSquads.players > 0) {
    const message = `Convocatorias locales cargadas: ${localSquads.players} jugadores en ${localSquads.teams} selecciones.`;
    await logSync(env, "ok", 0, message, "local-squads");
    return { ok: true, requestsUsed: 0, message };
  }

  const message = "No hay convocatorias locales. Aplica la migracion 0002_seed_squads.sql para cargar jugadores.";
  await logSync(env, "skipped", 0, message, "local-squads");
  return { ok: false, requestsUsed: 0, message };
}

export async function runResultSync(
  env: Env,
  options: { mode?: ResultSyncMode } = {}
): Promise<{ ok: boolean; requestsUsed: number; message: string }> {
  await ensureSeeded(env);

  const decision =
    options.mode === "adaptive"
      ? await getResultSyncDecision(env)
      : {
          shouldRun: true,
          cadence: "hourly",
          includeAuxiliaryData: true,
          provider: "openligadb",
          message: "Sincronizacion manual."
        } satisfies ResultSyncDecision;

  if (!decision.shouldRun) {
    return { ok: true, requestsUsed: 0, message: decision.message };
  }

  return runOpenLigaDbResultSync(env, decision);
}

async function runOpenLigaDbResultSync(env: Env, decision: ResultSyncDecision): Promise<{ ok: boolean; requestsUsed: number; message: string }> {
  try {
    let standingsUpdated = decision.includeAuxiliaryData ? await syncOpenLigaDbStandings(env) : 0;
    let resolvedBefore = decision.includeAuxiliaryData ? await resolveKnockoutMatches(env) : 0;
    const targets = await getSyncMatchTargets(env);
    if (targets.length === 0) {
      const message = decision.includeAuxiliaryData
        ? `Clasificación mundial actualizada: ${standingsUpdated} equipos, cruces resueltos: ${resolvedBefore}. No hay partidos no finalizados en la ventana de sincronización.`
        : "No hay partidos no finalizados en la ventana de sincronización live.";
      await logSync(env, "skipped", 0, message, decision.provider);
      return { ok: true, requestsUsed: 0, message };
    }

    const teams = decision.includeAuxiliaryData ? await fetchOpenLigaDbTeams(env) : [];
    let teamsUpdated = decision.includeAuxiliaryData ? await applyOpenLigaDbTeams(env, teams) : 0;
    const targetMatchdays = targets.map((match) => match.matchday).filter((matchday): matchday is number => typeof matchday === "number");
    const matches = await fetchOpenLigaDbMatches(env, targetMatchdays);

    if (matches.length === 0) {
      const message = "OpenLigaDB no devolvio partidos para la configuracion actual.";
      await logSync(env, "skipped", 0, message, decision.provider);
      return { ok: true, requestsUsed: 0, message };
    }

    const parsedMatches = matches.map(parseOpenLigaDbMatch);
    const { linked, updated, finishedFromLive, liveStandingGroups } = await applyOpenLigaDbMatches(env, parsedMatches, targets);
    const runCompletionFullSync = !decision.includeAuxiliaryData && finishedFromLive > 0;
    if (runCompletionFullSync) {
      standingsUpdated = await syncOpenLigaDbStandings(env);
      resolvedBefore = await resolveKnockoutMatches(env);
      teamsUpdated = await applyOpenLigaDbTeams(env, await fetchOpenLigaDbTeams(env));
    }
    const runLiveStandingsSync = !decision.includeAuxiliaryData && !runCompletionFullSync && liveStandingGroups.size > 0;
    if (runLiveStandingsSync) {
      standingsUpdated = await syncOpenLigaDbStandings(env, liveStandingGroups);
    }
    const resolvedAfter = decision.includeAuxiliaryData || runCompletionFullSync ? await resolveKnockoutMatches(env) : 0;
    if (updated > 0) await safeEvaluateAchievements(env);
    const ranAuxiliaryData = decision.includeAuxiliaryData || runCompletionFullSync;
    const message = ranAuxiliaryData
      ? `OpenLigaDB: ${targets.length} partidos objetivo, ${matches.length} partidos leídos, ${linked} enlazados, ${updated} resultados actualizados, ${teamsUpdated} equipos con logo revisado, clasificación mundial ${standingsUpdated} equipos, cruces resueltos ${resolvedBefore + resolvedAfter}.`
      : runLiveStandingsSync
        ? `OpenLigaDB live: ${targets.length} partidos objetivo, ${matches.length} partidos leídos, ${linked} enlazados, ${updated} resultados actualizados, clasificación de grupos ${[...liveStandingGroups].join(", ")} actualizada (${standingsUpdated} equipos).`
        : `OpenLigaDB live: ${targets.length} partidos objetivo, ${matches.length} partidos leídos, ${linked} enlazados, ${updated} resultados actualizados.`;
    await logSync(env, "ok", 0, message, ranAuxiliaryData ? "openligadb" : decision.provider);
    return { ok: true, requestsUsed: 0, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error sincronizando OpenLigaDB.";
    console.error("OPENLIGADB SYNC ERROR", error);
    await logSync(env, "error", 0, message, decision.provider);
    return { ok: false, requestsUsed: 0, message };
  }
}

export async function getResultSyncDecision(env: Env, now = new Date()): Promise<ResultSyncDecision> {
  const activeMatch = await getActiveSyncMatch(env, now);
  if (activeMatch) {
    return {
      shouldRun: true,
      cadence: "live",
      includeAuxiliaryData: false,
      provider: "openligadb-live",
      message: `Sincronización live por partido en ventana: ${activeMatch.id}.`
    };
  }

  const lastSyncAt = await getLastFullOpenLigaDbSyncAt(env);
  const needsHourlySync = !lastSyncAt || now.getTime() - lastSyncAt.getTime() >= hourlySyncIntervalMs;

  if (needsHourlySync) {
    return {
      shouldRun: true,
      cadence: "hourly",
      includeAuxiliaryData: true,
      provider: "openligadb",
      message: "Sincronización horaria sin partidos en curso."
    };
  }

  const nextHourlyAt = new Date(lastSyncAt.getTime() + hourlySyncIntervalMs);
  return {
    shouldRun: false,
    cadence: "recent",
    includeAuxiliaryData: false,
    provider: "openligadb",
    message: `Sync omitido: no hay partidos en curso y el último sync horario fue a ${lastSyncAt.toISOString()}. Próximo desde ${nextHourlyAt.toISOString()}.`
  };
}

async function getLocalSquadSummary(env: Env): Promise<{ players: number; teams: number }> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS players, COUNT(DISTINCT team_id) AS teams FROM squad_players"
  ).first<{ players: number; teams: number }>();
  return { players: row?.players ?? 0, teams: row?.teams ?? 0 };
}

async function syncOpenLigaDbStandings(env: Env, onlyGroupNames?: Set<string>): Promise<number> {
  return refreshGroupStandingsFromMatches(env, onlyGroupNames);
}

async function refreshGroupStandingsFromMatches(env: Env, onlyGroupNames?: Set<string>): Promise<number> {
  const matches = await getGroupStandingMatches(env, onlyGroupNames);
  const rows = calculateGroupStandings(matches);
  const now = new Date().toISOString();

  const statements: D1PreparedStatement[] = onlyGroupNames
    ? [...onlyGroupNames].map((groupName) => env.DB.prepare("DELETE FROM world_standings WHERE group_name = ?1").bind(groupName))
    : [env.DB.prepare("DELETE FROM world_standings")];

  for (const row of rows) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO world_standings
         (team_id, provider_team_id, group_name, rank, team_name, short_code, logo_url,
          played, won, drawn, lost, goals_for, goals_against, goal_diff, points, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`
      ).bind(
        row.teamId,
        row.providerTeamId,
        row.groupName,
        row.rank,
        row.teamName,
        row.shortCode,
        row.logoUrl,
        row.played,
        row.won,
        row.drawn,
        row.lost,
        row.goalsFor,
        row.goalsAgainst,
        row.goalDiff,
        row.points,
        now
      )
    );
  }

  await env.DB.batch(statements);
  return rows.length;
}

async function getGroupStandingMatches(env: Env, onlyGroupNames?: Set<string>): Promise<GroupStandingMatch[]> {
  const { results } = await env.DB.prepare(
    `SELECT m.group_name, m.status, m.home_score, m.away_score,
            ht.id AS home_team_id, ht.api_team_id AS home_api_team_id, ht.name AS home_team_name,
            ht.short_code AS home_short_code, ht.logo_url AS home_logo_url,
            at.id AS away_team_id, at.api_team_id AS away_api_team_id, at.name AS away_team_name,
            at.short_code AS away_short_code, at.logo_url AS away_logo_url
     FROM matches m
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams at ON at.id = m.away_team_id
     WHERE m.stage = 'GROUP'
       AND m.group_name IS NOT NULL
     ORDER BY m.group_name COLLATE NOCASE, m.kickoff_at ASC`
  ).all<{
    group_name: string;
    status: string;
    home_score: number | null;
    away_score: number | null;
    home_team_id: string;
    home_api_team_id: number | null;
    home_team_name: string;
    home_short_code: string | null;
    home_logo_url: string | null;
    away_team_id: string;
    away_api_team_id: number | null;
    away_team_name: string;
    away_short_code: string | null;
    away_logo_url: string | null;
  }>();

  return results
    .map((row) => ({
      groupName: formatGroupName(row.group_name),
      status: row.status,
      homeScore: row.home_score,
      awayScore: row.away_score,
      homeTeam: {
        id: row.home_team_id,
        providerTeamId: row.home_api_team_id,
        name: row.home_team_name,
        shortCode: row.home_short_code,
        logoUrl: row.home_logo_url
      },
      awayTeam: {
        id: row.away_team_id,
        providerTeamId: row.away_api_team_id,
        name: row.away_team_name,
        shortCode: row.away_short_code,
        logoUrl: row.away_logo_url
      }
    }))
    .filter((match) => !onlyGroupNames || onlyGroupNames.has(match.groupName));
}

export function calculateGroupStandings(matches: GroupStandingMatch[]): CalculatedGroupStanding[] {
  const grouped = new Map<string, Map<string, Omit<CalculatedGroupStanding, "rank">>>();

  for (const match of matches) {
    const groupName = formatGroupName(match.groupName);
    const groupRows = grouped.get(groupName) ?? new Map<string, Omit<CalculatedGroupStanding, "rank">>();
    const home = ensureGroupStandingRow(groupRows, groupName, match.homeTeam);
    const away = ensureGroupStandingRow(groupRows, groupName, match.awayTeam);

    if (match.status !== "scheduled" && match.homeScore !== null && match.awayScore !== null) {
      applyGroupMatchScore(home, away, match.homeScore, match.awayScore);
    }

    grouped.set(groupName, groupRows);
  }

  return [...grouped.entries()].flatMap(([groupName, groupRows]) =>
    [...groupRows.values()]
      .sort(
        (left, right) =>
          right.points - left.points ||
          right.goalDiff - left.goalDiff ||
          right.goalsFor - left.goalsFor ||
          left.teamName.localeCompare(right.teamName, "es")
      )
      .map((row, index) => ({
        ...row,
        groupName,
        rank: index + 1
      }))
  );
}

function ensureGroupStandingRow(
  groupRows: Map<string, Omit<CalculatedGroupStanding, "rank">>,
  groupName: string,
  team: GroupStandingTeam
): Omit<CalculatedGroupStanding, "rank"> {
  const existing = groupRows.get(team.id);
  if (existing) return existing;

  const row = {
    teamId: team.id,
    providerTeamId: team.providerTeamId,
    groupName,
    teamName: team.name,
    shortCode: team.shortCode,
    logoUrl: team.logoUrl,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0
  };
  groupRows.set(team.id, row);
  return row;
}

function applyGroupMatchScore(
  home: Omit<CalculatedGroupStanding, "rank">,
  away: Omit<CalculatedGroupStanding, "rank">,
  homeScore: number,
  awayScore: number
): void {
  home.played += 1;
  away.played += 1;
  home.goalsFor += homeScore;
  home.goalsAgainst += awayScore;
  away.goalsFor += awayScore;
  away.goalsAgainst += homeScore;
  home.goalDiff = home.goalsFor - home.goalsAgainst;
  away.goalDiff = away.goalsFor - away.goalsAgainst;

  if (homeScore > awayScore) {
    home.won += 1;
    home.points += 3;
    away.lost += 1;
  } else if (awayScore > homeScore) {
    away.won += 1;
    away.points += 3;
    home.lost += 1;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }
}

async function applyOpenLigaDbTeams(env: Env, teams: Array<{ teamName: string; teamIconUrl?: string | null }>): Promise<number> {
  let updated = 0;
  for (const team of teams) {
    const localTeamId = resolveProviderTeamId(team.teamName);
    if (!localTeamId) continue;
    const result = await env.DB.prepare("UPDATE teams SET logo_url = COALESCE(?1, logo_url) WHERE id = ?2")
      .bind(normalizeLogoUrl(team.teamIconUrl), localTeamId)
      .run();
    updated += result.meta.changes ?? 0;
  }
  return updated;
}

async function applyOpenLigaDbMatches(
  env: Env,
  parsedMatches: ParsedOpenLigaDbMatch[],
  targets: MatchSyncRow[]
): Promise<MatchApplyResult> {
  const squadNameCache = new Map<string, string[]>();
  let linked = 0;
  let updated = 0;
  let finishedFromLive = 0;
  const liveStandingGroups = new Set<string>();

  for (const parsed of parsedMatches) {
    const match = findMatchingOpenLigaDbTarget(targets, parsed);
    if (!match) continue;

    const incomingGoals = await canonicalizeMatchGoals(env, match, parsed.goals, squadNameCache);
    const goals = selectBestGoalTimeline(parseStoredMatchGoals(match.goals_json), incomingGoals, parsed);
    const goalsJson = JSON.stringify(goals);
    const now = new Date().toISOString();
    linked += 1;
    const scoreChanged =
      match.home_score !== parsed.homeScore ||
      match.away_score !== parsed.awayScore ||
      match.extra_home_score !== parsed.extraHomeScore ||
      match.extra_away_score !== parsed.extraAwayScore ||
      match.penalty_home_score !== parsed.penaltyHomeScore ||
      match.penalty_away_score !== parsed.penaltyAwayScore;
    const goalsChanged = (match.goals_json ?? "[]") !== goalsJson;
    const finishedChanged = match.status !== "finished" && parsed.status === "finished";
    const metadataChanged =
      match.api_fixture_id !== parsed.providerMatchId ||
      match.kickoff_at !== parsed.kickoffAt ||
      match.status !== parsed.status;

    if (scoreChanged || goalsChanged || finishedChanged || metadataChanged) {
      await env.DB.prepare(
        `UPDATE matches
         SET api_fixture_id = ?1, kickoff_at = ?2, lock_at = ?3, status = ?4,
             home_score = ?5, away_score = ?6,
             extra_home_score = ?7, extra_away_score = ?8,
             penalty_home_score = ?9, penalty_away_score = ?10,
             goals_json = ?11, updated_at = ?12
         WHERE id = ?13`
      )
        .bind(
          parsed.providerMatchId,
          parsed.kickoffAt,
          parsed.lockAt,
          parsed.status,
          parsed.homeScore,
          parsed.awayScore,
          parsed.extraHomeScore,
          parsed.extraAwayScore,
          parsed.penaltyHomeScore,
          parsed.penaltyAwayScore,
          goalsJson,
          now,
          match.id
        )
        .run();

      updated += 1;
    }

    if (isLiveToFinishedTransition(match.status, parsed.status)) {
      finishedFromLive += 1;
    }
    if (
      shouldRefreshGroupStandingsForMatch({
        stage: match.stage,
        matchday: match.matchday,
        groupName: match.group_name,
        previousStatus: match.status,
        nextStatus: parsed.status,
        scoreChanged
      })
    ) {
      liveStandingGroups.add(formatGroupName(match.group_name!));
    }
    if (parsed.status === "finished" && parsed.homeScore !== null && parsed.awayScore !== null && (scoreChanged || finishedChanged)) {
      await recalculateMatch(env, match.id);
    }
  }

  return { linked, updated, finishedFromLive, liveStandingGroups };
}

export function isLiveToFinishedTransition(previousStatus: string, nextStatus: string): boolean {
  return previousStatus === "live" && nextStatus === "finished";
}

export function shouldRefreshGroupStandingsForMatch(input: {
  stage: string;
  matchday: number | null;
  groupName: string | null;
  previousStatus: string;
  nextStatus: string;
  scoreChanged: boolean;
}): boolean {
  if (input.stage !== "GROUP" || !input.groupName) return false;
  if (typeof input.matchday !== "number" || input.matchday < 1 || input.matchday > 3) return false;
  const started = input.previousStatus !== "live" && input.nextStatus === "live";
  const liveScoreChanged = input.nextStatus === "live" && input.scoreChanged;
  return started || liveScoreChanged;
}

async function canonicalizeMatchGoals(
  env: Env,
  match: MatchSyncRow,
  goals: MatchGoal[],
  squadNameCache: Map<string, string[]>
): Promise<MatchGoal[]> {
  let previousHome = 0;
  let previousAway = 0;
  const normalized: MatchGoal[] = [];

  for (const goal of goals) {
    const teamId = goal.homeScore > previousHome ? match.home_team_id : goal.awayScore > previousAway ? match.away_team_id : null;
    const scorerName = goal.scorerName && teamId ? await canonicalizeScorerName(env, teamId, goal.scorerName, squadNameCache) : goal.scorerName;
    normalized.push({ ...goal, scorerName });
    previousHome = goal.homeScore;
    previousAway = goal.awayScore;
  }

  return normalized;
}

export function selectBestGoalTimeline(existing: MatchGoal[], incoming: MatchGoal[], parsed: ParsedOpenLigaDbMatch): MatchGoal[] {
  if (existing.length === 0) return incoming;
  if (incoming.length === 0) return existing;

  const finalScore = getGoalTimelineFinalScore(parsed);
  const existingScore = goalTimelineCompleteness(existing, finalScore);
  const incomingScore = goalTimelineCompleteness(incoming, finalScore);
  return incomingScore >= existingScore ? incoming : existing;
}

function getGoalTimelineFinalScore(parsed: ParsedOpenLigaDbMatch): Pick<MatchGoal, "homeScore" | "awayScore"> | null {
  if (parsed.extraHomeScore !== null && parsed.extraAwayScore !== null) {
    return { homeScore: parsed.extraHomeScore, awayScore: parsed.extraAwayScore };
  }
  if (parsed.homeScore !== null && parsed.awayScore !== null) {
    return { homeScore: parsed.homeScore, awayScore: parsed.awayScore };
  }
  return null;
}

function goalTimelineCompleteness(goals: MatchGoal[], finalScore: Pick<MatchGoal, "homeScore" | "awayScore"> | null): number {
  const namedGoals = goals.filter((goal) => goal.scorerName && goal.scorerName !== "Gol por confirmar").length;
  let score = goals.length * 10 + namedGoals;
  if (finalScore) {
    const expectedGoals = finalScore.homeScore + finalScore.awayScore;
    const quality = analyzeGoalTimeline(goals, finalScore);
    if (quality.isValid) score += 10_000;
    if (goals.length === expectedGoals) score += 5_000;
    score -= Math.abs(goals.length - expectedGoals) * 1_000;
    if (quality.endsAtFinalScore) score += 500;
  }
  return score;
}

function analyzeGoalTimeline(goals: MatchGoal[], finalScore: Pick<MatchGoal, "homeScore" | "awayScore">): { isValid: boolean; endsAtFinalScore: boolean } {
  let previousHome = 0;
  let previousAway = 0;

  for (const goal of goals) {
    const homeDelta = goal.homeScore - previousHome;
    const awayDelta = goal.awayScore - previousAway;
    if (homeDelta < 0 || awayDelta < 0 || homeDelta + awayDelta !== 1) {
      return { isValid: false, endsAtFinalScore: false };
    }
    previousHome = goal.homeScore;
    previousAway = goal.awayScore;
  }

  return {
    isValid: true,
    endsAtFinalScore: previousHome === finalScore.homeScore && previousAway === finalScore.awayScore
  };
}

function parseStoredMatchGoals(value: string | null): MatchGoal[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as MatchGoal[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (goal) =>
        typeof goal.homeScore === "number" &&
        typeof goal.awayScore === "number" &&
        (typeof goal.minute === "number" || goal.minute === null) &&
        (typeof goal.scorerName === "string" || goal.scorerName === null)
    );
  } catch {
    return [];
  }
}

async function canonicalizeScorerName(env: Env, teamId: string, name: string, squadNameCache: Map<string, string[]>): Promise<string> {
  const squadNames = await getSquadNames(env, teamId, squadNameCache);
  return findPersonNameMatch(name, squadNames) ?? name;
}

async function getSquadNames(env: Env, teamId: string, squadNameCache: Map<string, string[]>): Promise<string[]> {
  const cached = squadNameCache.get(teamId);
  if (cached) return cached;

  const { results } = await env.DB.prepare("SELECT name FROM squad_players WHERE team_id = ?1 ORDER BY name COLLATE NOCASE")
    .bind(teamId)
    .all<{ name: string }>();
  const names = results.map((row) => row.name);
  squadNameCache.set(teamId, names);
  return names;
}

async function getActiveSyncMatch(env: Env, now: Date): Promise<{ id: string } | null> {
  const from = new Date(now.getTime() - activeMatchLookbehindMs).toISOString();
  const to = new Date(now.getTime() + activeMatchLookaheadMs).toISOString();
  return await env.DB.prepare(
    `SELECT id
     FROM matches
     WHERE status <> 'finished'
       AND (status = 'live' OR kickoff_at BETWEEN ?1 AND ?2)
     ORDER BY kickoff_at ASC
     LIMIT 1`
  )
    .bind(from, to)
    .first<{ id: string }>();
}

async function getLastFullOpenLigaDbSyncAt(env: Env): Promise<Date | null> {
  const row = await env.DB.prepare(
    `SELECT finished_at
     FROM sync_runs
     WHERE provider = 'openligadb'
       AND finished_at IS NOT NULL
     ORDER BY finished_at DESC
     LIMIT 1`
  ).first<{ finished_at: string }>();

  if (!row?.finished_at) return null;
  const value = new Date(row.finished_at);
  return Number.isNaN(value.getTime()) ? null : value;
}

async function getSyncMatchTargets(env: Env): Promise<MatchSyncRow[]> {
  const now = Date.now();
  const from = new Date(now - syncTargetLookbehindMs).toISOString();
  const finishedFrom = new Date(now - finishedCorrectionLookbehindMs).toISOString();
  const to = new Date(now + syncTargetLookaheadMs).toISOString();
  const nowIso = new Date(now).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT id, api_fixture_id, stage, kickoff_at, matchday, group_name, status,
            home_score, away_score, extra_home_score, extra_away_score,
            penalty_home_score, penalty_away_score, goals_json, home_team_id, away_team_id
     FROM matches
     WHERE (
       status <> 'finished'
       AND kickoff_at BETWEEN ?1 AND ?2
     )
     OR (
       status = 'finished'
       AND kickoff_at BETWEEN ?3 AND ?4
     )
     ORDER BY kickoff_at ASC`
  )
    .bind(from, to, finishedFrom, nowIso)
    .all<MatchSyncRow>();
  return results;
}

function findMatchingOpenLigaDbTarget(targets: MatchSyncRow[], parsed: ParsedOpenLigaDbMatch): MatchSyncRow | null {
  const byId = targets.find((match) => match.api_fixture_id === parsed.providerMatchId);
  if (byId) return byId;

  const home = resolveProviderTeamId(parsed.homeTeam.name);
  const away = resolveProviderTeamId(parsed.awayTeam.name);
  if (!home || !away) return null;

  const fixtureTime = new Date(parsed.kickoffAt).getTime();
  return (
    targets.find((match) => {
      const sameTeams = match.home_team_id === home && match.away_team_id === away;
      const closeKickoff = Math.abs(new Date(match.kickoff_at).getTime() - fixtureTime) <= 12 * 60 * 60 * 1000;
      return sameTeams && closeKickoff;
    }) || null
  );
}

function resolveProviderTeamId(name: string): string {
  const normalized = normalizeProviderName(name);
  return normalizedProviderNameToTeamId[normalized] || normalized.replace(/\s+/g, "-");
}

function formatGroupName(value: string): string {
  if (/^grupo\s+/i.test(value) || value === "Sin grupo") return value;
  return `Grupo ${value}`;
}

function normalizeProviderName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findPersonNameMatch(name: string, candidates: string[]): string | null {
  const normalizedName = normalizePersonName(name);
  if (!normalizedName) return null;

  for (const candidate of candidates) {
    const normalizedCandidate = normalizePersonName(candidate);
    if (normalizedCandidate === normalizedName) return candidate;
    if (normalizedCandidate.includes(normalizedName) || normalizedName.includes(normalizedCandidate)) return candidate;
  }

  const nameTokens = normalizedName.split(" ").filter(Boolean);
  const lastName = nameTokens[nameTokens.length - 1];
  const firstInitial = nameTokens[0]?.[0];
  const tokenSet = new Set(nameTokens);

  for (const candidate of candidates) {
    const candidateTokens = normalizePersonName(candidate).split(" ").filter(Boolean);
    if (nameTokens.length >= 2 && candidateTokens.includes(lastName) && candidateTokens.some((token) => token[0] === firstInitial)) {
      return candidate;
    }
    if (nameTokens.length >= 2 && nameTokens.every((token) => candidateTokens.includes(token))) {
      return candidate;
    }
    if (candidateTokens.length >= 2 && candidateTokens.every((token) => tokenSet.has(token))) {
      return candidate;
    }
  }

  return null;
}

function normalizePersonName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function logSync(env: Env, status: string, requestsUsed: number, message: string, provider = "openligadb"): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO sync_runs (id, started_at, finished_at, status, provider, requests_used, message) VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6)"
  )
    .bind(createId("sync"), now, status, provider, requestsUsed, message)
    .run();
}
