import {
  groupLetters,
  knockoutMatchId,
  rawKnockoutMatches,
  type GroupLetter,
  type KnockoutSlot
} from "../shared/fixtures";
import { getThirdPlaceScenario, type ThirdPlaceWinnerSlot } from "./thirdPlaceScenarios";
import type { Env } from "./types";

type StandingRow = {
  team_id: string | null;
  group_name: string;
  rank: number;
  team_name: string;
  played: number;
  points: number;
  goals_for: number;
  goal_diff: number;
};

type KnockoutMatchRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  extra_home_score: number | null;
  extra_away_score: number | null;
  penalty_home_score: number | null;
  penalty_away_score: number | null;
};

type GroupResolver = {
  byRank: Map<string, string>;
  thirds: Map<GroupLetter, string>;
  thirdScenario: Record<ThirdPlaceWinnerSlot, string>;
};

export async function resolveKnockoutMatches(env: Env): Promise<number> {
  const [standings, matches] = await Promise.all([getStandingRows(env), getKnockoutRows(env)]);
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const groupResolver = buildGroupResolver(standings);
  const updates: D1PreparedStatement[] = [];
  const now = new Date().toISOString();

  for (const [matchNumber, , , homeSlot, awaySlot] of rawKnockoutMatches) {
    const matchId = knockoutMatchId(matchNumber);
    const match = matchById.get(matchId);
    if (!match) continue;

    const homeTeamId = resolveSlot(homeSlot, groupResolver, matchById, winnerSlotForThird(homeSlot, awaySlot));
    const awayTeamId = resolveSlot(awaySlot, groupResolver, matchById, winnerSlotForThird(awaySlot, homeSlot));
    const shouldUpdateHome = homeTeamId && homeTeamId !== match.home_team_id;
    const shouldUpdateAway = awayTeamId && awayTeamId !== match.away_team_id;
    if (!shouldUpdateHome && !shouldUpdateAway) continue;

    updates.push(
      env.DB.prepare(
        `UPDATE matches
         SET home_team_id = COALESCE(?1, home_team_id),
             away_team_id = COALESCE(?2, away_team_id),
             updated_at = ?3
         WHERE id = ?4`
      ).bind(shouldUpdateHome ? homeTeamId : null, shouldUpdateAway ? awayTeamId : null, now, matchId)
    );

    matchById.set(matchId, {
      ...match,
      home_team_id: shouldUpdateHome ? homeTeamId : match.home_team_id,
      away_team_id: shouldUpdateAway ? awayTeamId : match.away_team_id
    });
  }

  if (updates.length > 0) await env.DB.batch(updates);
  return updates.length;
}

async function getStandingRows(env: Env): Promise<StandingRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT team_id, group_name, rank, team_name, played, points, goals_for, goal_diff
     FROM world_standings
     ORDER BY group_name COLLATE NOCASE, rank ASC`
  ).all<StandingRow>();
  return results;
}

async function getKnockoutRows(env: Env): Promise<KnockoutMatchRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, home_team_id, away_team_id, status,
            home_score, away_score, extra_home_score, extra_away_score,
            penalty_home_score, penalty_away_score
     FROM matches
     WHERE stage <> 'GROUP'
     ORDER BY kickoff_at ASC`
  ).all<KnockoutMatchRow>();
  return results;
}

function buildGroupResolver(rows: StandingRow[]): GroupResolver | null {
  const byGroup = new Map<GroupLetter, StandingRow[]>();
  for (const row of rows) {
    const group = parseGroupLetter(row.group_name);
    if (!group || !row.team_id) continue;
    const groupRows = byGroup.get(group) ?? [];
    groupRows.push(row);
    byGroup.set(group, groupRows);
  }

  const byRank = new Map<string, string>();
  const thirds = new Map<GroupLetter, string>();
  const thirdRows: Array<StandingRow & { group: GroupLetter }> = [];

  for (const group of groupLetters) {
    const groupRows = (byGroup.get(group) ?? []).sort((left, right) => left.rank - right.rank);
    if (groupRows.length < 4 || groupRows.some((row) => row.played < 3)) return null;

    for (const row of groupRows) {
      byRank.set(`${row.rank}${group}`, row.team_id!);
    }

    const third = groupRows.find((row) => row.rank === 3);
    if (!third) return null;
    thirds.set(group, third.team_id!);
    thirdRows.push({ ...third, group });
  }

  const qualifiedThirdGroups = thirdRows
    .sort(
      (left, right) =>
        right.points - left.points ||
        right.goal_diff - left.goal_diff ||
        right.goals_for - left.goals_for ||
        left.team_name.localeCompare(right.team_name, "es")
    )
    .slice(0, 8)
    .map((row) => row.group);

  const thirdScenario = getThirdPlaceScenario(qualifiedThirdGroups);
  if (!thirdScenario) return null;

  return { byRank, thirds, thirdScenario };
}

function resolveSlot(
  slot: KnockoutSlot,
  groupResolver: GroupResolver | null,
  matchById: Map<string, KnockoutMatchRow>,
  thirdWinnerSlot: ThirdPlaceWinnerSlot | null
): string | null {
  if (slot.kind === "group") {
    return groupResolver?.byRank.get(`${slot.rank}${slot.group}`) ?? null;
  }

  if (slot.kind === "third") {
    if (!groupResolver || !thirdWinnerSlot) return null;
    const group = groupResolver.thirdScenario[thirdWinnerSlot] as GroupLetter | undefined;
    return group ? groupResolver.thirds.get(group) ?? null : null;
  }

  const source = matchById.get(knockoutMatchId(slot.matchNumber));
  if (!source || source.status !== "finished") return null;
  const winnerSide = getWinnerSide(source);
  if (!winnerSide) return null;

  if (slot.kind === "winner") {
    return winnerSide === "home" ? source.home_team_id : source.away_team_id;
  }

  return winnerSide === "home" ? source.away_team_id : source.home_team_id;
}

function winnerSlotForThird(slot: KnockoutSlot, otherSlot: KnockoutSlot): ThirdPlaceWinnerSlot | null {
  if (slot.kind !== "third" || otherSlot.kind !== "group" || otherSlot.rank !== 1) return null;
  return `1${otherSlot.group}` as ThirdPlaceWinnerSlot;
}

function getWinnerSide(match: KnockoutMatchRow): "home" | "away" | null {
  if (match.home_score === null || match.away_score === null) return null;
  if (match.home_score > match.away_score) return "home";
  if (match.away_score > match.home_score) return "away";
  if (match.extra_home_score !== null && match.extra_away_score !== null) {
    if (match.extra_home_score > match.extra_away_score) return "home";
    if (match.extra_away_score > match.extra_home_score) return "away";
  }
  if (match.penalty_home_score === null || match.penalty_away_score === null) return null;
  if (match.penalty_home_score > match.penalty_away_score) return "home";
  if (match.penalty_away_score > match.penalty_home_score) return "away";
  return null;
}

function parseGroupLetter(groupName: string): GroupLetter | null {
  const match = groupName.match(/[A-L]$/i);
  if (!match) return null;
  const group = match[0].toUpperCase() as GroupLetter;
  return groupLetters.includes(group) ? group : null;
}
