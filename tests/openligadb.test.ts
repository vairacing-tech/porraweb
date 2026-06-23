import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchOpenLigaDbMatches,
  parseOpenLigaDbMatch,
  parseOpenLigaDbStanding,
  selectExtraTimeResult,
  selectFinalResult,
  selectPenaltyShootoutResult,
  selectRegularTimeResult
} from "../src/server/providers/openligadb";
import type { Env } from "../src/server/types";

describe("OpenLigaDB provider", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("parses match data into the internal shape", () => {
    const parsed = parseOpenLigaDbMatch({
      matchID: 12345,
      matchDateTime: "2026-06-11T19:00:00",
      matchDateTimeUTC: "2026-06-11T19:00:00Z",
      matchIsFinished: true,
      team1: { teamName: "Mexico", shortName: "MEX", teamIconUrl: "https://example.com/mex.png" },
      team2: { teamName: "South Africa", shortName: "RSA", teamIconUrl: "https://example.com/rsa.png" },
      group: { groupName: "Group A", groupOrderID: 1 },
      matchResults: [
        { resultTypeID: 1, resultName: "Halbzeit", pointsTeam1: 1, pointsTeam2: 0 },
        { resultTypeID: 2, resultName: "Endergebnis", pointsTeam1: 2, pointsTeam2: 1 }
      ],
      goals: [
        { scoreTeam1: 1, scoreTeam2: 0, matchMinute: 22, goalGetterName: "Jugador Uno" },
        { scoreTeam1: 2, scoreTeam2: 0, matchMinute: 48, goalGetterName: "Jugador Dos" }
      ]
    });

    expect(parsed).toMatchObject({
      providerMatchId: 12345,
      kickoffAt: "2026-06-11T19:00:00.000Z",
      lockAt: "2026-06-11T17:00:00.000Z",
      status: "finished",
      homeScore: 2,
      awayScore: 1,
      homeTeam: { id: "mexico", shortCode: "MEX" },
      awayTeam: { id: "south-africa", shortCode: "RSA" }
    });
    expect(parsed.goals).toEqual([
      { minute: 22, scorerName: "Jugador Uno", homeScore: 1, awayScore: 0, isPenalty: false, isOwnGoal: false, isOvertime: false },
      { minute: 48, scorerName: "Jugador Dos", homeScore: 2, awayScore: 0, isPenalty: false, isOwnGoal: false, isOvertime: false },
      { minute: null, scorerName: "Gol por confirmar", homeScore: 2, awayScore: 1, isPenalty: false, isOwnGoal: false, isOvertime: false }
    ]);
  });

  it("sorts OpenLigaDB goals and fills missing cumulative score steps", () => {
    const parsed = parseOpenLigaDbMatch({
      matchID: 80110,
      matchDateTime: "2026-06-15T04:00:00",
      matchDateTimeUTC: "2026-06-15T02:00:00Z",
      matchIsFinished: true,
      team1: { teamName: "Schweden", shortName: "SWE" },
      team2: { teamName: "Tunesien", shortName: "TUN" },
      group: { groupName: "1. Runde", groupOrderID: 1 },
      matchResults: [
        { resultTypeID: 1, resultName: "Halbzeit", pointsTeam1: 2, pointsTeam2: 1 },
        { resultTypeID: 2, resultName: "Endergebnis", pointsTeam1: 5, pointsTeam2: 1 }
      ],
      goals: [
        { scoreTeam1: 3, scoreTeam2: 1, matchMinute: 59, goalGetterName: "Viktor Gyokeres" },
        { scoreTeam1: 1, scoreTeam2: 0, matchMinute: 7, goalGetterName: "Yasin Ayari" },
        { scoreTeam1: 5, scoreTeam2: 1, matchMinute: 96, goalGetterName: "Yasin Ayari", isOvertime: true },
        { scoreTeam1: 2, scoreTeam2: 0, matchMinute: 30, goalGetterName: "Alexander Isak" },
        { scoreTeam1: 2, scoreTeam2: 1, matchMinute: 43, goalGetterName: "Omar Rekik" },
        { scoreTeam1: 4, scoreTeam2: 1, matchMinute: 86, goalGetterName: "Mattias Svanberg" }
      ]
    });

    expect(parsed.goals.map((goal) => `${goal.homeScore}-${goal.awayScore}`)).toEqual(["1-0", "2-0", "2-1", "3-1", "4-1", "5-1"]);
    expect(parsed.goals[2]).toMatchObject({ minute: 43, scorerName: "Omar Rekik", homeScore: 2, awayScore: 1 });
  });

  it("fills placeholder goals up to the final score when the provider goal list is incomplete", () => {
    const parsed = parseOpenLigaDbMatch({
      matchID: 80108,
      matchDateTime: "2026-06-14T22:00:00",
      matchDateTimeUTC: "2026-06-14T20:00:00Z",
      matchIsFinished: true,
      team1: { teamName: "Niederlande", shortName: "NED" },
      team2: { teamName: "Japan", shortName: "JPN" },
      group: { groupName: "1. Runde", groupOrderID: 1 },
      matchResults: [{ resultTypeID: 2, resultName: "Endergebnis", pointsTeam1: 2, pointsTeam2: 2 }],
      goals: [
        { scoreTeam1: 1, scoreTeam2: 0, matchMinute: 51, goalGetterName: "Virgil van Dijk" },
        { scoreTeam1: 1, scoreTeam2: 1, matchMinute: 57, goalGetterName: "Keito Nakamura" }
      ]
    });

    expect(parsed.goals.map((goal) => `${goal.scorerName}:${goal.homeScore}-${goal.awayScore}`)).toEqual([
      "Virgil van Dijk:1-0",
      "Keito Nakamura:1-1",
      "Gol por confirmar:2-1",
      "Gol por confirmar:2-2"
    ]);
  });

  it("selects regular-time result independently of MatchResults order", () => {
    expect(
      selectRegularTimeResult([
        { resultTypeID: 1, pointsTeam1: 0, pointsTeam2: 0 },
        { resultTypeID: 2, pointsTeam1: 3, pointsTeam2: 2 }
      ])
    ).toMatchObject({ pointsTeam1: 3, pointsTeam2: 2 });
  });

  it("prefers decisive knockout results over the 90-minute result", () => {
    const results = [
        { resultTypeID: 1, pointsTeam1: 0, pointsTeam2: 0 },
        { resultTypeID: 2, pointsTeam1: 1, pointsTeam2: 1 },
        { resultTypeID: 4, pointsTeam1: 2, pointsTeam2: 2 },
        { resultTypeID: 5, pointsTeam1: 6, pointsTeam2: 5 }
      ];

    expect(selectExtraTimeResult(results)).toMatchObject({ pointsTeam1: 2, pointsTeam2: 2 });
    expect(selectPenaltyShootoutResult(results)).toMatchObject({ pointsTeam1: 6, pointsTeam2: 5 });
    expect(selectFinalResult(results)).toMatchObject({ pointsTeam1: 6, pointsTeam2: 5 });
  });

  it("parses extra-time and penalty results for knockout matches", () => {
    const parsed = parseOpenLigaDbMatch({
      matchID: 90002,
      matchDateTime: "2026-07-04T21:00:00",
      matchDateTimeUTC: "2026-07-04T19:00:00Z",
      matchIsFinished: true,
      team1: { teamName: "Mexiko", shortName: "MEX" },
      team2: { teamName: "Sudafrica", shortName: "RSA" },
      group: { groupName: "Dieciseisavos", groupOrderID: 4 },
      matchResults: [
        { resultTypeID: 2, resultName: "Endergebnis", pointsTeam1: 1, pointsTeam2: 1 },
        { resultTypeID: 5, resultName: "nach Elfmeterschießen", pointsTeam1: 5, pointsTeam2: 4 },
        { resultTypeID: 4, resultName: "nach Verlängerung", pointsTeam1: 1, pointsTeam2: 1 }
      ]
    });

    expect(parsed.homeScore).toBe(1);
    expect(parsed.awayScore).toBe(1);
    expect(parsed.extraHomeScore).toBe(1);
    expect(parsed.extraAwayScore).toBe(1);
    expect(parsed.penaltyHomeScore).toBe(5);
    expect(parsed.penaltyAwayScore).toBe(4);
  });

  it("parses standings data into the internal shape", () => {
    expect(
      parseOpenLigaDbStanding({
        teamInfoId: 761,
        teamName: "Mexiko",
        shortName: "MEX",
        teamIconUrl: "http://example.com/mex.png",
        points: 3,
        opponentGoals: 0,
        goals: 2,
        matches: 1,
        won: 1,
        lost: 0,
        draw: 0,
        goalDiff: 2
      })
    ).toEqual({
      providerTeamId: 761,
      providerTeamName: "Mexiko",
      shortCode: "MEX",
      logoUrl: "https://example.com/mex.png",
      points: 3,
      goalsAgainst: 0,
      goalsFor: 2,
      played: 1,
      won: 1,
      lost: 0,
      drawn: 0,
      goalDiff: 2
    });
  });

  it("keeps the published score for unfinished matches", () => {
    const parsed = parseOpenLigaDbMatch({
      matchID: 81464,
      matchDateTime: "2026-06-11T21:00:00",
      matchDateTimeUTC: "2026-06-11T19:00:00Z",
      matchIsFinished: false,
      team1: { teamName: "Mexiko", shortName: "MEX" },
      team2: { teamName: "Sudafrica", shortName: "RSA" },
      matchResults: [{ resultTypeID: 2, resultName: "Endergebnis", pointsTeam1: 2, pointsTeam2: 0 }]
    });

    expect(parsed.homeScore).toBe(2);
    expect(parsed.awayScore).toBe(0);
  });

  it("uses the latest goal score when OpenLigaDB has goals but no match result", () => {
    const parsed = parseOpenLigaDbMatch({
      matchID: 81465,
      matchDateTime: "2026-06-12T21:00:00",
      matchDateTimeUTC: "2026-06-12T19:00:00Z",
      matchIsFinished: false,
      team1: { teamName: "Kanada", shortName: "CAN" },
      team2: { teamName: "Bosnien und Herzegowina", shortName: "BIH" },
      group: { groupName: "1. Runde", groupOrderID: 1 },
      matchResults: [],
      goals: [{ scoreTeam1: 0, scoreTeam2: 1, matchMinute: 18, goalGetterName: "Jugador Bosnia" }]
    });

    expect(parsed.homeScore).toBe(0);
    expect(parsed.awayScore).toBe(1);
    expect(parsed.goals[0]?.scorerName).toBe("Jugador Bosnia");
  });

  it("prefers the latest goal score over a stale match result while the match is live", () => {
    const parsed = parseOpenLigaDbMatch({
      matchID: 81466,
      matchDateTime: "2026-06-12T21:00:00",
      matchDateTimeUTC: "2026-06-12T19:00:00Z",
      matchIsFinished: false,
      team1: { teamName: "Kanada", shortName: "CAN" },
      team2: { teamName: "Bosnien und Herzegowina", shortName: "BIH" },
      group: { groupName: "1. Runde", groupOrderID: 1 },
      matchResults: [{ resultTypeID: 2, resultName: "Endergebnis", pointsTeam1: 0, pointsTeam2: 0 }],
      goals: [{ scoreTeam1: 0, scoreTeam2: 1, matchMinute: 11, goalGetterName: "Alistair Johnston" }]
    });

    expect(parsed.homeScore).toBe(0);
    expect(parsed.awayScore).toBe(1);
    expect(parsed.goals[0]?.scorerName).toBe("Alistair Johnston");
  });

  it("fills missing goal scorer names from OpenLigaDB goal getters", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("getgoalgetters")) {
        return Response.json([{ goalGetterID: 77, goalGetterName: "Jugador Bosnia", goalCount: 1 }]);
      }

      return Response.json([
        {
          matchID: 81465,
          matchDateTime: "2026-06-12T21:00:00",
          matchDateTimeUTC: "2026-06-12T19:00:00Z",
          matchIsFinished: false,
          team1: { teamName: "Kanada", shortName: "CAN" },
          team2: { teamName: "Bosnien und Herzegowina", shortName: "BIH" },
          goals: [{ scoreTeam1: 0, scoreTeam2: 1, matchMinute: 18, goalGetterID: 77, goalGetterName: "" }]
        }
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const matches = await fetchOpenLigaDbMatches({
      OPENLIGADB_BASE_URL: "https://api.openligadb.test",
      OPENLIGADB_LEAGUE_SHORTCUT: "wm26",
      OPENLIGADB_SEASON: "2026"
    } as Env);

    expect(matches[0]?.goals?.[0]?.goalGetterName).toBe("Jugador Bosnia");
  });

  it("keeps unfinished group matches live inside the extended group-stage fallback window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T21:35:00.000Z"));

    const parsed = parseOpenLigaDbMatch({
      matchID: 81464,
      matchDateTime: "2026-06-11T21:00:00",
      matchDateTimeUTC: "2026-06-11T19:00:00Z",
      matchIsFinished: false,
      team1: { teamName: "Mexiko", shortName: "MEX" },
      team2: { teamName: "Sudafrica", shortName: "RSA" },
      group: { groupName: "1. Runde", groupOrderID: 1 },
      matchResults: [{ resultTypeID: 2, resultName: "Endergebnis", pointsTeam1: 2, pointsTeam2: 0 }]
    });

    expect(parsed.status).toBe("live");
  });

  it("marks unfinished group matches as finished after the extended fallback window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T00:35:00.000Z"));

    const parsed = parseOpenLigaDbMatch({
      matchID: 81464,
      matchDateTime: "2026-06-11T21:00:00",
      matchDateTimeUTC: "2026-06-11T19:00:00Z",
      matchIsFinished: false,
      team1: { teamName: "Mexiko", shortName: "MEX" },
      team2: { teamName: "Sudafrica", shortName: "RSA" },
      group: { groupName: "1. Runde", groupOrderID: 1 },
      matchResults: [{ resultTypeID: 2, resultName: "Endergebnis", pointsTeam1: 2, pointsTeam2: 0 }]
    });

    expect(parsed.status).toBe("finished");
  });

  it("keeps unfinished knockout matches live inside the extra-time window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T21:35:00.000Z"));

    const parsed = parseOpenLigaDbMatch({
      matchID: 90001,
      matchDateTime: "2026-07-04T21:00:00",
      matchDateTimeUTC: "2026-07-04T19:00:00Z",
      matchIsFinished: false,
      team1: { teamName: "Mexiko", shortName: "MEX" },
      team2: { teamName: "Sudafrica", shortName: "RSA" },
      group: { groupName: "Achtelfinale", groupOrderID: 4 },
      matchResults: [{ resultTypeID: 2, resultName: "Endergebnis", pointsTeam1: 2, pointsTeam2: 0 }]
    });

    expect(parsed.status).toBe("live");
  });

  it("returns an empty list when OpenLigaDB is not configured", async () => {
    await expect(fetchOpenLigaDbMatches({} as Env)).resolves.toEqual([]);
  });
});
