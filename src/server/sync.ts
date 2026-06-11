import { recalculateMatch } from "./db";
import { ensureSeeded } from "./db";
import { createId } from "./crypto";
import { fetchOpenLigaDbMatches, fetchOpenLigaDbTeams, parseOpenLigaDbMatch, type ParsedOpenLigaDbMatch } from "./providers/openligadb";
import type { Env } from "./types";

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  teams: {
    home: ApiFootballTeamRef;
    away: ApiFootballTeamRef;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    extratime?: { home: number | null; away: number | null };
    penalty?: { home: number | null; away: number | null };
  };
};

type ApiFootballTeamRef = {
  id: number;
  name: string;
  logo?: string | null;
};

type ApiFootballSquad = {
  team: ApiFootballTeamRef;
  players: Array<{
    id: number;
    name: string;
    position?: string | null;
    photo?: string | null;
  }>;
};

type ApiFootballTeamSearchResult = {
  team: ApiFootballTeamRef & { national?: boolean };
};

type MatchSyncRow = {
  id: string;
  api_fixture_id: number | null;
  kickoff_at: string;
  home_team_id: string;
  away_team_id: string;
};

const apiNameToTeamId: Record<string, string> = {
  "algeria": "argelia",
  "argentina": "argentina",
  "australia": "australia",
  "austria": "austria",
  "belgium": "belgica",
  "bosnia and herzegovina": "bosnia-y-herzegovina",
  "brazil": "brasil",
  "canada": "canada",
  "cape verde": "cabo-verde",
  "colombia": "colombia",
  "croatia": "croacia",
  "curacao": "curazao",
  "czech republic": "republica-checa",
  "czechia": "republica-checa",
  "democratic republic of the congo": "rd-congo",
  "congo dr": "rd-congo",
  "dr congo": "rd-congo",
  "ecuador": "ecuador",
  "egypt": "egipto",
  "england": "inglaterra",
  "france": "francia",
  "germany": "alemania",
  "ghana": "ghana",
  "haiti": "haiti",
  "iran": "iran",
  "iraq": "irak",
  "ivory coast": "costa-de-marfil",
  "cote d'ivoire": "costa-de-marfil",
  "japan": "japon",
  "jordan": "jordania",
  "korea republic": "corea-del-sur",
  "mexico": "mexico",
  "morocco": "marruecos",
  "netherlands": "paises-bajos",
  "new zealand": "nueva-zelanda",
  "norway": "noruega",
  "panama": "panama",
  "paraguay": "paraguay",
  "portugal": "portugal",
  "qatar": "catar",
  "saudi arabia": "arabia-saudi",
  "scotland": "escocia",
  "senegal": "senegal",
  "south africa": "sudafrica",
  "south korea": "corea-del-sur",
  "spain": "espana",
  "sweden": "suecia",
  "switzerland": "suiza",
  "tunisia": "tunez",
  "turkey": "turquia",
  "united states": "estados-unidos",
  "united states of america": "estados-unidos",
  "usa": "estados-unidos",
  "uruguay": "uruguay",
  "uzbekistan": "uzbekistan"
};

const providerNameToTeamId: Record<string, string> = {
  ...apiNameToTeamId,
  "agypten": "egipto",
  "aegypten": "egipto",
  "algerien": "argelia",
  "argentinien": "argentina",
  "australien": "australia",
  "belgien": "belgica",
  "bosnien und herzegowina": "bosnia-y-herzegovina",
  "brasilien": "brasil",
  "deutschland": "alemania",
  "dr kongo": "rd-congo",
  "elfenbeinkuste": "costa-de-marfil",
  "england": "inglaterra",
  "frankreich": "francia",
  "iran": "iran",
  "irak": "irak",
  "japan": "japon",
  "kanada": "canada",
  "kap verde": "cabo-verde",
  "katar": "catar",
  "kolumbien": "colombia",
  "kroatien": "croacia",
  "marokko": "marruecos",
  "mexiko": "mexico",
  "neuseeland": "nueva-zelanda",
  "niederlande": "paises-bajos",
  "norwegen": "noruega",
  "osterreich": "austria",
  "oesterreich": "austria",
  "saudi arabien": "arabia-saudi",
  "schottland": "escocia",
  "schweden": "suecia",
  "schweiz": "suiza",
  "spanien": "espana",
  "sudafrika": "sudafrica",
  "suedafrika": "sudafrica",
  "tschechien": "republica-checa",
  "tunesien": "tunez",
  "turkei": "turquia",
  "tuerkei": "turquia",
  "usbekistan": "uzbekistan",
  "vereinigte staaten": "estados-unidos"
};

const teamIdToApiSearchName = Object.entries(apiNameToTeamId).reduce<Record<string, string>>((accumulator, [apiName, localId]) => {
  if (!accumulator[localId]) accumulator[localId] = apiName;
  return accumulator;
}, {});

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

  if (!env.API_FOOTBALL_KEY) {
    const message = "No hay convocatorias locales y API_FOOTBALL_KEY no esta configurada. Aplica la migracion 0002_seed_squads.sql.";
    await logSync(env, "skipped", 0, message, "local-squads");
    return { ok: false, requestsUsed: 0, message };
  }

  const budget = Number(env.API_FOOTBALL_DAILY_BUDGET || 70);
  const usedToday = await getRequestsUsedToday(env);
  if (usedToday >= budget) {
    const message = `Presupuesto diario agotado: ${usedToday}/${budget}.`;
    await logSync(env, "skipped", 0, message, "api-football-squads");
    return { ok: false, requestsUsed: 0, message };
  }

  let requestsUsed = 0;
  let teamsUpdated = 0;
  const notes: string[] = [];

  try {
    requestsUsed += 1;
    const fixtures = await fetchFixtures(env, "league=1&season=2026");
    teamsUpdated += await upsertApiTeamsFromFixtures(env, fixtures);
  } catch (error) {
    notes.push(`Calendario 2026 no disponible: ${error instanceof Error ? error.message : "error desconocido"}.`);
  }

  if (teamsUpdated === 0 && usedToday + requestsUsed < budget) {
    const resolved = await resolveMissingApiTeamIds(env, budget - usedToday - requestsUsed);
    requestsUsed += resolved.requestsUsed;
    teamsUpdated += resolved.teamsUpdated;
    if (resolved.requestsUsed > 0) notes.push("IDs de equipos resueltos por nombre.");
  }

  let localTeams = await getLocalTeamsWithApiIds(env, true);
  if (localTeams.length === 0) {
    localTeams = await getLocalTeamsWithApiIds(env, false);
  }
  let squadsUpdated = 0;
  let playersUpdated = 0;

  for (const team of localTeams) {
    if (usedToday + requestsUsed >= budget) break;
    requestsUsed += 1;
    const squad = await fetchSquad(env, team.api_team_id);
    if (!squad) continue;
    const count = await upsertSquadPlayers(env, team.id, squad);
    if (count > 0) {
      squadsUpdated += 1;
      playersUpdated += count;
    }
  }

  const limited = usedToday + requestsUsed >= budget ? " Presupuesto diario alcanzado." : "";
  const suffix = notes.length > 0 ? ` ${notes.join(" ")}` : "";
  const message = `Convocatorias: ${squadsUpdated} selecciones y ${playersUpdated} jugadores. Equipos API actualizados: ${teamsUpdated}.${limited}${suffix}`;
  await logSync(env, "ok", requestsUsed, message, "api-football-squads");
  return { ok: true, requestsUsed, message };
}

async function getLocalSquadSummary(env: Env): Promise<{ players: number; teams: number }> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS players, COUNT(DISTINCT team_id) AS teams FROM squad_players"
  ).first<{ players: number; teams: number }>();
  return { players: row?.players ?? 0, teams: row?.teams ?? 0 };
}

export async function runResultSync(env: Env): Promise<{ ok: boolean; requestsUsed: number; message: string }> {
  const openLigaDbResult = await runOpenLigaDbResultSync(env);
  if (openLigaDbResult.usedProvider || !env.API_FOOTBALL_KEY) {
    return openLigaDbResult;
  }

  const fallbackResult = await runApiFootballResultSync(env);
  return {
    ok: fallbackResult.ok,
    requestsUsed: fallbackResult.requestsUsed,
    message: `OpenLigaDB sin datos; fallback API-Football: ${fallbackResult.message}`
  };
}

async function runOpenLigaDbResultSync(env: Env): Promise<{ ok: boolean; requestsUsed: number; message: string; usedProvider: boolean }> {
  await ensureSeeded(env);

  try {
    const teams = await fetchOpenLigaDbTeams(env);
    const teamsUpdated = await applyOpenLigaDbTeams(env, teams);
    const matches = await fetchOpenLigaDbMatches(env);

    if (matches.length === 0) {
      const message = "OpenLigaDB no devolvio partidos para la configuracion actual.";
      await logSync(env, "skipped", 0, message, "openligadb");
      return { ok: true, requestsUsed: 0, message, usedProvider: false };
    }

    const parsedMatches = matches.map(parseOpenLigaDbMatch);
    const { linked, updated } = await applyOpenLigaDbMatches(env, parsedMatches);
    const message = `OpenLigaDB: ${matches.length} partidos leidos, ${linked} enlazados, ${updated} resultados actualizados, ${teamsUpdated} equipos con logo revisado.`;
    await logSync(env, "ok", 0, message, "openligadb");
    return { ok: true, requestsUsed: 0, message, usedProvider: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error sincronizando OpenLigaDB.";
    console.error("OPENLIGADB SYNC ERROR", error);
    await logSync(env, "error", 0, message, "openligadb");
    return { ok: false, requestsUsed: 0, message, usedProvider: false };
  }
}

async function runApiFootballResultSync(env: Env): Promise<{ ok: boolean; requestsUsed: number; message: string }> {
  await ensureSeeded(env);

  if (!env.API_FOOTBALL_KEY) {
    await logSync(env, "skipped", 0, "API_FOOTBALL_KEY no configurada.");
    return { ok: false, requestsUsed: 0, message: "API_FOOTBALL_KEY no configurada." };
  }

  const budget = Number(env.API_FOOTBALL_DAILY_BUDGET || 70);
  const usedToday = await getRequestsUsedToday(env);
  if (usedToday >= budget) {
    const message = `Presupuesto diario agotado: ${usedToday}/${budget}.`;
    await logSync(env, "skipped", 0, message);
    return { ok: false, requestsUsed: 0, message };
  }

  const targets = await getTargetMatches(env);
  if (targets.length === 0) {
    await logSync(env, "skipped", 0, "No hay partidos cercanos que sincronizar.");
    return { ok: true, requestsUsed: 0, message: "No hay partidos cercanos que sincronizar." };
  }

  let requestsUsed = 0;
  const fixtures: ApiFootballFixture[] = [];
  const ids = targets.map((match) => match.api_fixture_id).filter((id): id is number => typeof id === "number");

  if (ids.length > 0) {
    try {
      for (const chunk of chunkIds(ids, 20)) {
        if (usedToday + requestsUsed >= budget) break;
        requestsUsed += 1;
        fixtures.push(...(await fetchFixtures(env, `ids=${chunk.join("-")}`)));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error sincronizando resultados.";
      await logSync(env, "error", requestsUsed, message);
      return { ok: false, requestsUsed, message };
    }
  } else {
    const dates = getDateWindow();
    requestsUsed += 1;
    try {
      fixtures.push(...(await fetchFixtures(env, `league=1&season=2026&from=${dates.from}&to=${dates.to}`)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error sincronizando resultados.";
      await logSync(env, "error", requestsUsed, message);
      return { ok: false, requestsUsed, message };
    }
  }

  let updated = 0;
  for (const fixture of fixtures) {
    const match = findMatchingTarget(targets, fixture);
    if (!match) continue;
    await applyFixture(env, match.id, fixture);
    updated += 1;
  }

  const message = `Sincronizados ${updated} partidos con ${requestsUsed} request(s).`;
  await logSync(env, "ok", requestsUsed, message);
  return { ok: true, requestsUsed, message };
}

async function applyOpenLigaDbTeams(env: Env, teams: Array<{ teamName: string; teamIconUrl?: string | null }>): Promise<number> {
  let updated = 0;
  for (const team of teams) {
    const localTeamId = resolveProviderTeamId(team.teamName);
    if (!localTeamId) continue;
    const result = await env.DB.prepare("UPDATE teams SET logo_url = COALESCE(?1, logo_url) WHERE id = ?2")
      .bind(team.teamIconUrl ?? null, localTeamId)
      .run();
    updated += result.meta.changes ?? 0;
  }
  return updated;
}

async function applyOpenLigaDbMatches(env: Env, parsedMatches: ParsedOpenLigaDbMatch[]): Promise<{ linked: number; updated: number }> {
  const targets = await getAllMatchTargets(env);
  let linked = 0;
  let updated = 0;

  for (const parsed of parsedMatches) {
    const match = findMatchingOpenLigaDbTarget(targets, parsed);
    if (!match) continue;

    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE matches
       SET api_fixture_id = ?1, kickoff_at = ?2, lock_at = ?3, status = ?4,
           home_score = ?5, away_score = ?6, updated_at = ?7
       WHERE id = ?8`
    )
      .bind(parsed.providerMatchId, parsed.kickoffAt, parsed.lockAt, parsed.status, parsed.homeScore, parsed.awayScore, now, match.id)
      .run();

    linked += 1;
    if (parsed.status === "finished" && parsed.homeScore !== null && parsed.awayScore !== null) {
      await recalculateMatch(env, match.id);
      updated += 1;
    }
  }

  return { linked, updated };
}

async function getAllMatchTargets(env: Env): Promise<MatchSyncRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, api_fixture_id, kickoff_at, home_team_id, away_team_id
     FROM matches
     ORDER BY kickoff_at ASC`
  ).all<MatchSyncRow>();
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

async function getTargetMatches(env: Env): Promise<MatchSyncRow[]> {
  const now = Date.now();
  const from = new Date(now - 8 * 60 * 60 * 1000).toISOString();
  const to = new Date(now + 4 * 60 * 60 * 1000).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT id, api_fixture_id, kickoff_at, home_team_id, away_team_id
     FROM matches
     WHERE status IN ('scheduled', 'locked', 'live')
       AND kickoff_at BETWEEN ?1 AND ?2
     ORDER BY kickoff_at ASC
     LIMIT 20`
  )
    .bind(from, to)
    .all<MatchSyncRow>();
  return results;
}

async function fetchFixtures(env: Env, query: string): Promise<ApiFootballFixture[]> {
  const response = await fetch(`https://v3.football.api-sports.io/fixtures?${query}`, {
    headers: { "x-apisports-key": env.API_FOOTBALL_KEY || "" }
  });
  if (!response.ok) throw new Error(`API-Football respondio ${response.status}`);
  const data = (await response.json()) as { response?: ApiFootballFixture[]; errors?: unknown };
  const apiError = formatApiErrors(data.errors);
  if (apiError) throw new Error(apiError);
  return data.response || [];
}

async function fetchSquad(env: Env, apiTeamId: number): Promise<ApiFootballSquad | null> {
  const response = await fetch(`https://v3.football.api-sports.io/players/squads?team=${apiTeamId}`, {
    headers: { "x-apisports-key": env.API_FOOTBALL_KEY || "" }
  });
  if (!response.ok) throw new Error(`API-Football respondio ${response.status}`);
  const data = (await response.json()) as { response?: ApiFootballSquad[]; errors?: unknown };
  const apiError = formatApiErrors(data.errors);
  if (apiError) throw new Error(apiError);
  return data.response?.[0] ?? null;
}

async function fetchTeamByName(env: Env, name: string): Promise<ApiFootballTeamRef | null> {
  const response = await fetch(`https://v3.football.api-sports.io/teams?name=${encodeURIComponent(name)}`, {
    headers: { "x-apisports-key": env.API_FOOTBALL_KEY || "" }
  });
  if (!response.ok) throw new Error(`API-Football respondio ${response.status}`);
  const data = (await response.json()) as { response?: ApiFootballTeamSearchResult[]; errors?: unknown };
  const apiError = formatApiErrors(data.errors);
  if (apiError) throw new Error(apiError);
  const teams = data.response || [];
  return teams.find((item) => item.team.national)?.team ?? teams[0]?.team ?? null;
}

async function upsertApiTeamsFromFixtures(env: Env, fixtures: ApiFootballFixture[]): Promise<number> {
  const teams = new Map<string, ApiFootballTeamRef>();

  for (const fixture of fixtures) {
    for (const apiTeam of [fixture.teams.home, fixture.teams.away]) {
      const localId = normalizeApiName(apiTeam.name);
      if (!localId || teams.has(localId)) continue;
      teams.set(localId, apiTeam);
    }
  }

  const now = new Date().toISOString();
  const statements = Array.from(teams.entries()).map(([localId, apiTeam]) =>
    env.DB.prepare("UPDATE teams SET api_team_id = ?1, logo_url = COALESCE(?2, logo_url) WHERE id = ?3")
      .bind(apiTeam.id, apiTeam.logo ?? null, localId)
  );

  if (statements.length > 0) {
    await env.DB.batch(statements);
    await env.DB.prepare(
      "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, payload, created_at) VALUES (?1, NULL, 'sync_api_teams', 'team', 'fortilin', ?2, ?3)"
    )
      .bind(createId("aud"), JSON.stringify({ teams: statements.length }), now)
      .run();
  }

  return statements.length;
}

async function resolveMissingApiTeamIds(env: Env, availableRequests: number): Promise<{ teamsUpdated: number; requestsUsed: number }> {
  const { results } = await env.DB.prepare(
    "SELECT id, name FROM teams WHERE api_team_id IS NULL ORDER BY name COLLATE NOCASE"
  ).all<{ id: string; name: string }>();

  let requestsUsed = 0;
  let teamsUpdated = 0;

  for (const team of results) {
    if (requestsUsed >= availableRequests) break;
    const searchName = teamIdToApiSearchName[team.id] || team.name;
    requestsUsed += 1;
    const apiTeam = await fetchTeamByName(env, searchName);
    if (!apiTeam) continue;
    await env.DB.prepare("UPDATE teams SET api_team_id = ?1, logo_url = COALESCE(?2, logo_url) WHERE id = ?3")
      .bind(apiTeam.id, apiTeam.logo ?? null, team.id)
      .run();
    teamsUpdated += 1;
  }

  return { teamsUpdated, requestsUsed };
}

async function getLocalTeamsWithApiIds(env: Env, onlyWithoutSquad: boolean): Promise<Array<{ id: string; api_team_id: number }>> {
  const squadFilter = onlyWithoutSquad ? "AND NOT EXISTS (SELECT 1 FROM squad_players sp WHERE sp.team_id = teams.id)" : "";
  const { results } = await env.DB.prepare(
    `SELECT id, api_team_id FROM teams WHERE api_team_id IS NOT NULL ${squadFilter} ORDER BY name COLLATE NOCASE`
  ).all<{ id: string; api_team_id: number | null }>();

  return results
    .filter((row): row is { id: string; api_team_id: number } => typeof row.api_team_id === "number")
    .map((row) => ({ id: row.id, api_team_id: row.api_team_id }));
}

async function upsertSquadPlayers(env: Env, localTeamId: string, squad: ApiFootballSquad): Promise<number> {
  const now = new Date().toISOString();
  const statements = squad.players.map((player) =>
    env.DB.prepare(
      `INSERT INTO squad_players (team_id, api_player_id, name, position, photo_url, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(team_id, api_player_id)
       DO UPDATE SET name = excluded.name, position = excluded.position, photo_url = excluded.photo_url, updated_at = excluded.updated_at`
    ).bind(localTeamId, player.id, player.name, player.position ?? null, player.photo ?? null, now)
  );

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }

  return statements.length;
}

function findMatchingTarget(targets: MatchSyncRow[], fixture: ApiFootballFixture): MatchSyncRow | null {
  const byId = targets.find((match) => match.api_fixture_id === fixture.fixture.id);
  if (byId) return byId;

  const home = normalizeApiName(fixture.teams.home.name);
  const away = normalizeApiName(fixture.teams.away.name);
  const fixtureTime = new Date(fixture.fixture.date).getTime();

  return (
    targets.find((match) => {
      const sameTeams = match.home_team_id === home && match.away_team_id === away;
      const closeKickoff = Math.abs(new Date(match.kickoff_at).getTime() - fixtureTime) <= 3 * 60 * 60 * 1000;
      return sameTeams && closeKickoff;
    }) || null
  );
}

async function applyFixture(env: Env, matchId: string, fixture: ApiFootballFixture): Promise<void> {
  const status = mapStatus(fixture.fixture.status.short);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE matches
     SET api_fixture_id = ?1, status = ?2, home_score = ?3, away_score = ?4,
         extra_home_score = ?5, extra_away_score = ?6,
         penalty_home_score = ?7, penalty_away_score = ?8,
         updated_at = ?9
     WHERE id = ?10`
  )
    .bind(
      fixture.fixture.id,
      status,
      fixture.goals.home,
      fixture.goals.away,
      fixture.score.extratime?.home ?? null,
      fixture.score.extratime?.away ?? null,
      fixture.score.penalty?.home ?? null,
      fixture.score.penalty?.away ?? null,
      now,
      matchId
    )
    .run();

  if (status === "finished") {
    await recalculateMatch(env, matchId);
  }
}

function normalizeApiName(name: string): string {
  return (
    apiNameToTeamId[
      name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    ] || ""
  );
}

function resolveProviderTeamId(name: string): string {
  const normalized = normalizeProviderName(name);
  return normalizedProviderNameToTeamId[normalized] || normalized.replace(/\s+/g, "-");
}

function normalizeProviderName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mapStatus(status: string): "scheduled" | "live" | "finished" | "postponed" | "cancelled" {
  if (status === "FT" || status === "AET" || status === "PEN") return "finished";
  if (status === "PST" || status === "SUSP") return "postponed";
  if (status === "CANC" || status === "ABD") return "cancelled";
  if (["1H", "HT", "2H", "ET", "BT", "P"].includes(status)) return "live";
  return "scheduled";
}

async function getRequestsUsedToday(env: Env): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const row = await env.DB.prepare("SELECT COALESCE(SUM(requests_used), 0) AS used FROM sync_runs WHERE started_at >= ?1")
    .bind(start.toISOString())
    .first<{ used: number }>();
  return row?.used ?? 0;
}

async function logSync(env: Env, status: string, requestsUsed: number, message: string, provider = "api-football"): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO sync_runs (id, started_at, finished_at, status, provider, requests_used, message) VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6)"
  )
    .bind(createId("sync"), now, status, provider, requestsUsed, message)
    .run();
}

function formatApiErrors(errors: unknown): string | null {
  if (!errors) return null;
  if (Array.isArray(errors) && errors.length === 0) return null;
  if (typeof errors === "object") {
    const values = Object.values(errors as Record<string, unknown>).filter(Boolean);
    if (values.length === 0) return null;
    return values.map((value) => String(value)).join(" ");
  }
  return String(errors);
}

function getDateWindow(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function chunkIds(ids: number[], size: number): number[][] {
  const chunks: number[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}
