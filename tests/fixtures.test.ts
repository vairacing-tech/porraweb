import { describe, expect, it } from "vitest";
import { initialMatches, initialTeams, knockoutMatchId, rawKnockoutMatches } from "../src/shared/fixtures";

describe("initial fixture seed", () => {
  it("contains the complete group and knockout schedule", () => {
    expect(initialMatches).toHaveLength(104);
    expect(rawKnockoutMatches).toHaveLength(32);
    expect(initialTeams).toHaveLength(112);
  });

  it("marks Spain group fixtures as double points", () => {
    const doubleMatches = initialMatches.filter((match) => match.isDoublePoints);
    expect(doubleMatches).toHaveLength(6);
    expect(doubleMatches.every((match) => match.groupName === "H")).toBe(true);
  });

  it("stores kickoff dates in UTC", () => {
    expect(initialMatches[0]).toMatchObject({
      id: "grp-01-001",
      kickoffAt: "2026-06-11T19:00:00Z",
      lockAt: "2026-06-11T17:00:00.000Z"
    });
  });

  it("seeds knockout placeholders with official match numbers and UTC kickoffs", () => {
    expect(initialMatches.find((match) => match.id === knockoutMatchId(73))).toMatchObject({
      stage: "ROUND_OF_32",
      homeTeamId: "slot-2a",
      awayTeamId: "slot-2b",
      kickoffAt: "2026-06-28T19:00:00Z"
    });
    expect(initialMatches.find((match) => match.id === knockoutMatchId(104))).toMatchObject({
      stage: "FINAL",
      homeTeamId: "slot-w101",
      awayTeamId: "slot-w102",
      kickoffAt: "2026-07-19T19:00:00Z"
    });
  });
});
