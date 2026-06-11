import { describe, expect, it } from "vitest";
import { fetchOpenLigaDbMatches, parseOpenLigaDbMatch, selectFinalResult } from "../src/server/providers/openligadb";
import type { Env } from "../src/server/types";

describe("OpenLigaDB provider", () => {
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
  });

  it("prefers resultTypeID 2 as final result", () => {
    expect(
      selectFinalResult([
        { resultTypeID: 1, pointsTeam1: 0, pointsTeam2: 0 },
        { resultTypeID: 2, pointsTeam1: 3, pointsTeam2: 2 }
      ])
    ).toMatchObject({ pointsTeam1: 3, pointsTeam2: 2 });
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

  it("returns an empty list when OpenLigaDB is not configured", async () => {
    await expect(fetchOpenLigaDbMatches({} as Env)).resolves.toEqual([]);
  });
});
