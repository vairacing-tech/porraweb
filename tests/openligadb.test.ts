import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOpenLigaDbMatches, parseOpenLigaDbMatch, parseOpenLigaDbStanding, selectFinalResult } from "../src/server/providers/openligadb";
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
      { minute: 48, scorerName: "Jugador Dos", homeScore: 2, awayScore: 0, isPenalty: false, isOwnGoal: false, isOvertime: false }
    ]);
  });

  it("prefers resultTypeID 2 as final result", () => {
    expect(
      selectFinalResult([
        { resultTypeID: 1, pointsTeam1: 0, pointsTeam2: 0 },
        { resultTypeID: 2, pointsTeam1: 3, pointsTeam2: 2 }
      ])
    ).toMatchObject({ pointsTeam1: 3, pointsTeam2: 2 });
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
