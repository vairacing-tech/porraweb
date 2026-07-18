import { describe, expect, it } from "vitest";
import {
  calculateBonusPoints,
  evaluateTournamentBonuses,
  isFinalGoalDataComplete,
  resolveFinalists,
  type StoredBonusPrediction
} from "../src/server/bonus";
import type { Match, MatchGoal, SquadPlayer, Team } from "../src/shared/types";

const spain: Team = { id: "espana", name: "España", shortCode: "ESP" };
const argentina: Team = { id: "argentina", name: "Argentina", shortCode: "ARG" };

function goal(homeScore: number, awayScore: number, scorerName: string | null, options: Partial<MatchGoal> = {}): MatchGoal {
  return {
    minute: 20,
    scorerName,
    homeScore,
    awayScore,
    isPenalty: false,
    isOwnGoal: false,
    isOvertime: false,
    ...options
  };
}

function finalMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: "ko-104",
    stage: "FINAL",
    round: "Final",
    matchday: 8,
    homeTeam: spain,
    awayTeam: argentina,
    kickoffAt: "2026-07-19T19:00:00.000Z",
    lockAt: "2026-07-19T17:00:00.000Z",
    status: "finished",
    homeScore: 1,
    awayScore: 0,
    extraHomeScore: null,
    extraAwayScore: null,
    penaltyHomeScore: null,
    penaltyAwayScore: null,
    goals: [goal(1, 0, "Mikel Oyarzabal")],
    isDoublePoints: true,
    ...overrides
  };
}

const tiedLeaders = [
  { player: "Lionel Messi", teamId: "argentina", teamName: "Argentina", goals: 8 },
  { player: "Kylian Mbappe", teamId: "francia", teamName: "Francia", goals: 8 }
];

describe("final bonus readiness", () => {
  it("does not resolve finalists until the final is finished", () => {
    expect(resolveFinalists(finalMatch({ status: "live" }))).toBeNull();
  });

  it("resolves regulation, extra-time, and penalty winners in decisive order", () => {
    expect(resolveFinalists(finalMatch())).toEqual({ championTeamId: "espana", runnerUpTeamId: "argentina" });
    expect(resolveFinalists(finalMatch({ homeScore: 1, awayScore: 1, extraHomeScore: 1, extraAwayScore: 2 }))).toEqual({
      championTeamId: "argentina",
      runnerUpTeamId: "espana"
    });
    expect(resolveFinalists(finalMatch({
      homeScore: 0,
      awayScore: 0,
      extraHomeScore: 1,
      extraAwayScore: 1,
      penaltyHomeScore: 5,
      penaltyAwayScore: 4
    }))).toEqual({ championTeamId: "espana", runnerUpTeamId: "argentina" });
  });

  it("requires a complete named non-shootout goal timeline", () => {
    expect(isFinalGoalDataComplete(finalMatch({ goals: [] }))).toBe(false);
    expect(isFinalGoalDataComplete(finalMatch({ goals: [goal(1, 0, "Gol por confirmar")] }))).toBe(false);
    expect(isFinalGoalDataComplete(finalMatch({ goals: [goal(1, 0, null)] }))).toBe(false);
    expect(isFinalGoalDataComplete(finalMatch())).toBe(true);
  });

  it("accepts a complete scoreless final resolved on penalties", () => {
    expect(isFinalGoalDataComplete(finalMatch({
      homeScore: 0,
      awayScore: 0,
      extraHomeScore: 0,
      extraAwayScore: 0,
      penaltyHomeScore: 4,
      penaltyAwayScore: 3,
      goals: []
    }))).toBe(true);
  });
});

describe("calculateBonusPoints", () => {
  it("combines champion, runner-up, and any tied top scorer", () => {
    const perfect: StoredBonusPrediction = {
      leagueId: "fortilin",
      userId: "one",
      championTeamId: "espana",
      runnerUpTeamId: "argentina",
      topScorerTeamId: "argentina",
      topScorer: "Lionel Messi",
      points: 0
    };
    const otherTiedLeader = { ...perfect, userId: "two", topScorerTeamId: "francia", topScorer: "Kylian Mbappe" };

    expect(calculateBonusPoints(perfect, "espana", "argentina", tiedLeaders)).toBe(20);
    expect(calculateBonusPoints(otherTiedLeader, "espana", "argentina", tiedLeaders)).toBe(20);
  });

  it("recomputes from facts instead of retaining stale points", () => {
    const stale: StoredBonusPrediction = {
      leagueId: "fortilin",
      userId: "one",
      championTeamId: "argentina",
      runnerUpTeamId: "espana",
      topScorerTeamId: "inglaterra",
      topScorer: "Harry Kane",
      points: 20
    };

    expect(calculateBonusPoints(stale, "espana", "argentina", tiedLeaders)).toBe(0);
  });
});

describe("evaluateTournamentBonuses", () => {
  it("replaces points idempotently and corrects them after result changes", async () => {
    const squads: SquadPlayer[] = [
      { teamId: "espana", apiPlayerId: 1, name: "Mikel Oyarzabal", position: null, photoUrl: null }
    ];
    const bonusRows: StoredBonusPrediction[] = [{
      leagueId: "fortilin",
      userId: "one",
      championTeamId: "espana",
      runnerUpTeamId: "argentina",
      topScorerTeamId: "espana",
      topScorer: "Mikel Oyarzabal",
      points: 0
    }];
    const database = createBonusDatabase([finalMatch()], squads, bonusRows);

    expect(await evaluateTournamentBonuses({ DB: database.db })).toEqual({ applied: true, changed: 1, evaluated: 1 });
    expect(database.points.get("one")).toBe(20);
    expect(await evaluateTournamentBonuses({ DB: database.db })).toEqual({ applied: true, changed: 0, evaluated: 1 });
    expect(database.points.get("one")).toBe(20);

    database.matches[0] = finalMatch({ homeScore: 0, awayScore: 1, goals: [goal(0, 1, "Lionel Messi")] });
    expect(await evaluateTournamentBonuses({ DB: database.db })).toEqual({ applied: true, changed: 1, evaluated: 1 });
    expect(database.points.get("one")).toBe(0);
  });

  it("does not update existing points when the final data is incomplete", async () => {
    const bonusRows: StoredBonusPrediction[] = [{
      leagueId: "fortilin",
      userId: "one",
      championTeamId: "espana",
      runnerUpTeamId: "argentina",
      topScorerTeamId: "espana",
      topScorer: "Mikel Oyarzabal",
      points: 12
    }];
    const database = createBonusDatabase([finalMatch({ goals: [] })], [], bonusRows);

    expect(await evaluateTournamentBonuses({ DB: database.db })).toEqual({ applied: false, changed: 0, evaluated: 0 });
    expect(database.points.get("one")).toBe(12);
  });
});

function createBonusDatabase(matches: Match[], squads: SquadPlayer[], bonuses: StoredBonusPrediction[]) {
  const points = new Map(bonuses.map((row) => [row.userId, row.points]));
  const prepared = (sql: string, values: unknown[] = []): Record<string, unknown> => ({
    sql,
    values,
    bind(...nextValues: unknown[]) {
      return prepared(sql, nextValues);
    },
    async all() {
      if (sql.includes("FROM matches m")) return { results: matches.map(toMatchRow) };
      if (sql.includes("FROM squad_players")) {
        return { results: squads.map((player) => ({
          team_id: player.teamId,
          api_player_id: player.apiPlayerId,
          name: player.name,
          position: player.position,
          photo_url: player.photoUrl
        })) };
      }
      if (sql.includes("FROM bonus_predictions")) {
        return { results: bonuses.map((row) => ({
          league_id: row.leagueId,
          user_id: row.userId,
          champion_team_id: row.championTeamId,
          runner_up_team_id: row.runnerUpTeamId,
          top_scorer_team_id: row.topScorerTeamId,
          top_scorer: row.topScorer,
          points: points.get(row.userId) ?? 0
        })) };
      }
      return { results: [] };
    }
  });

  const db = {
    prepare(sql: string) {
      return prepared(sql);
    },
    async batch(statements: Array<{ sql: string; values: unknown[] }>) {
      for (const statement of statements) {
        if (statement.sql.startsWith("UPDATE bonus_predictions")) {
          points.set(String(statement.values[3]), Number(statement.values[0]));
        }
      }
      return statements.map(() => ({ success: true }));
    }
  } as unknown as D1Database;

  return { db, matches, points };
}

function toMatchRow(match: Match) {
  return {
    ...match,
    api_fixture_id: match.apiFixtureId ?? null,
    matchday: match.matchday ?? null,
    group_name: match.groupName ?? null,
    kickoff_at: match.kickoffAt,
    lock_at: match.lockAt,
    home_score: match.homeScore ?? null,
    away_score: match.awayScore ?? null,
    extra_home_score: match.extraHomeScore ?? null,
    extra_away_score: match.extraAwayScore ?? null,
    penalty_home_score: match.penaltyHomeScore ?? null,
    penalty_away_score: match.penaltyAwayScore ?? null,
    goals_json: JSON.stringify(match.goals),
    is_double_points: match.isDoublePoints ? 1 : 0,
    home_id: match.homeTeam.id,
    home_name: match.homeTeam.name,
    home_code: match.homeTeam.shortCode,
    home_logo_url: match.homeTeam.logoUrl ?? null,
    away_id: match.awayTeam.id,
    away_name: match.awayTeam.name,
    away_code: match.awayTeam.shortCode,
    away_logo_url: match.awayTeam.logoUrl ?? null
  };
}
