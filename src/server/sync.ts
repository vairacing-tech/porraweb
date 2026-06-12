import { createId } from "./crypto";
import { ensureSeeded, recalculateMatch } from "./db";
import {
  fetchOpenLigaDbMatches,
  fetchOpenLigaDbStandings,
  fetchOpenLigaDbTeams,
  normalizeLogoUrl,
  parseOpenLigaDbMatch,
  parseOpenLigaDbStanding,
  type ParsedOpenLigaDbStanding,
  type ParsedOpenLigaDbMatch
} from "./providers/openligadb";
import type { MatchGoal } from "../shared/types";
import type { Env } from "./types";

type MatchSyncRow = {
  id: string;
  api_fixture_id: number | null;
  kickoff_at: string;
  matchday: number | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team_id: string;
  away_team_id: string;
};

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

export async function runResultSync(env: Env): Promise<{ ok: boolean; requestsUsed: number; message: string }> {
  return runOpenLigaDbResultSync(env);
}

async function runOpenLigaDbResultSync(env: Env): Promise<{ ok: boolean; requestsUsed: number; message: string }> {
  await ensureSeeded(env);

  try {
    const standingsUpdated = await syncOpenLigaDbStandings(env);
    const targets = await getSyncMatchTargets(env);
    if (targets.length === 0) {
      const message = `Clasificación mundial actualizada: ${standingsUpdated} equipos. No hay partidos no finalizados en la ventana de sincronización.`;
      await logSync(env, "skipped", 0, message, "openligadb");
      return { ok: true, requestsUsed: 0, message };
    }

    const teams = await fetchOpenLigaDbTeams(env);
    const teamsUpdated = await applyOpenLigaDbTeams(env, teams);
    const targetMatchdays = targets.map((match) => match.matchday).filter((matchday): matchday is number => typeof matchday === "number");
    const matches = await fetchOpenLigaDbMatches(env, targetMatchdays);

    if (matches.length === 0) {
      const message = "OpenLigaDB no devolvio partidos para la configuracion actual.";
      await logSync(env, "skipped", 0, message, "openligadb");
      return { ok: true, requestsUsed: 0, message };
    }

    const parsedMatches = matches.map(parseOpenLigaDbMatch);
    const { linked, updated } = await applyOpenLigaDbMatches(env, parsedMatches, targets);
    const message = `OpenLigaDB: ${targets.length} partidos objetivo, ${matches.length} partidos leídos, ${linked} enlazados, ${updated} resultados actualizados, ${teamsUpdated} equipos con logo revisado, clasificación mundial ${standingsUpdated} equipos.`;
    await logSync(env, "ok", 0, message, "openligadb");
    return { ok: true, requestsUsed: 0, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error sincronizando OpenLigaDB.";
    console.error("OPENLIGADB SYNC ERROR", error);
    await logSync(env, "error", 0, message, "openligadb");
    return { ok: false, requestsUsed: 0, message };
  }
}

async function getLocalSquadSummary(env: Env): Promise<{ players: number; teams: number }> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS players, COUNT(DISTINCT team_id) AS teams FROM squad_players"
  ).first<{ players: number; teams: number }>();
  return { players: row?.players ?? 0, teams: row?.teams ?? 0 };
}

async function syncOpenLigaDbStandings(env: Env): Promise<number> {
  const standings = await fetchOpenLigaDbStandings(env);
  if (standings.length === 0) return 0;

  return applyOpenLigaDbStandings(env, standings.map(parseOpenLigaDbStanding));
}

async function applyOpenLigaDbStandings(env: Env, rows: ParsedOpenLigaDbStanding[]): Promise<number> {
  const [teams, groupMap] = await Promise.all([getLocalTeams(env), getLocalTeamGroups(env)]);
  const now = new Date().toISOString();
  const grouped = new Map<string, Array<{
    teamId: string;
    providerTeamId: number;
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
  }>>();

  for (const row of rows) {
    const resolvedTeamId = resolveProviderTeamId(row.providerTeamName);
    const localTeam = teams.get(resolvedTeamId);
    const teamId = localTeam?.id ?? resolvedTeamId;
    const groupName = formatGroupName(groupMap.get(teamId) ?? "Sin grupo");
    const groupRows = grouped.get(groupName) ?? [];
    groupRows.push({
      teamId,
      providerTeamId: row.providerTeamId,
      teamName: localTeam?.name ?? row.providerTeamName,
      shortCode: localTeam?.short_code ?? row.shortCode,
      logoUrl: row.logoUrl ?? localTeam?.logo_url ?? null,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDiff: row.goalDiff,
      points: row.points
    });
    grouped.set(groupName, groupRows);
  }

  const statements: D1PreparedStatement[] = [env.DB.prepare("DELETE FROM world_standings")];
  let count = 0;
  for (const [groupName, groupRows] of grouped) {
    const sortedRows = [...groupRows].sort(
      (left, right) =>
        right.points - left.points ||
        right.goalDiff - left.goalDiff ||
        right.goalsFor - left.goalsFor ||
        left.teamName.localeCompare(right.teamName, "es")
    );

    for (const [index, row] of sortedRows.entries()) {
      count += 1;
      statements.push(
        env.DB.prepare(
          `INSERT INTO world_standings
           (team_id, provider_team_id, group_name, rank, team_name, short_code, logo_url,
            played, won, drawn, lost, goals_for, goals_against, goal_diff, points, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`
        ).bind(
          row.teamId,
          row.providerTeamId,
          groupName,
          index + 1,
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
  }

  await env.DB.batch(statements);
  return count;
}

async function getLocalTeams(env: Env): Promise<Map<string, { id: string; name: string; short_code: string; logo_url: string | null }>> {
  const { results } = await env.DB.prepare("SELECT id, name, short_code, logo_url FROM teams")
    .all<{ id: string; name: string; short_code: string; logo_url: string | null }>();
  return new Map(results.map((team) => [team.id, team]));
}

async function getLocalTeamGroups(env: Env): Promise<Map<string, string>> {
  const { results } = await env.DB.prepare(
    `SELECT group_name, home_team_id AS team_id FROM matches WHERE stage = 'GROUP' AND group_name IS NOT NULL
     UNION
     SELECT group_name, away_team_id AS team_id FROM matches WHERE stage = 'GROUP' AND group_name IS NOT NULL`
  ).all<{ group_name: string; team_id: string }>();
  return new Map(results.map((row) => [row.team_id, row.group_name]));
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
): Promise<{ linked: number; updated: number }> {
  const squadNameCache = new Map<string, string[]>();
  let linked = 0;
  let updated = 0;

  for (const parsed of parsedMatches) {
    const match = findMatchingOpenLigaDbTarget(targets, parsed);
    if (!match) continue;

    const goals = await canonicalizeMatchGoals(env, match, parsed.goals, squadNameCache);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE matches
       SET api_fixture_id = ?1, kickoff_at = ?2, lock_at = ?3, status = ?4,
           home_score = ?5, away_score = ?6, goals_json = ?7, updated_at = ?8
       WHERE id = ?9`
    )
      .bind(
        parsed.providerMatchId,
        parsed.kickoffAt,
        parsed.lockAt,
        parsed.status,
        parsed.homeScore,
        parsed.awayScore,
        JSON.stringify(goals),
        now,
        match.id
      )
      .run();

    linked += 1;
    const scoreChanged = match.home_score !== parsed.homeScore || match.away_score !== parsed.awayScore;
    const finishedChanged = match.status !== "finished" && parsed.status === "finished";
    if (parsed.status === "finished" && parsed.homeScore !== null && parsed.awayScore !== null && (scoreChanged || finishedChanged)) {
      await recalculateMatch(env, match.id);
      updated += 1;
    }
  }

  return { linked, updated };
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

async function getSyncMatchTargets(env: Env): Promise<MatchSyncRow[]> {
  const now = Date.now();
  const from = new Date(now - 7 * 60 * 60 * 1000).toISOString();
  const to = new Date(now + 3 * 60 * 60 * 1000).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT id, api_fixture_id, kickoff_at, matchday, status, home_score, away_score, home_team_id, away_team_id
     FROM matches
     WHERE status <> 'finished'
       AND kickoff_at BETWEEN ?1 AND ?2
     ORDER BY kickoff_at ASC`
  )
    .bind(from, to)
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
