import { describe, expect, it } from "vitest";
import { initialMatches, initialTeams } from "../src/shared/fixtures";

describe("initial fixture seed", () => {
  it("contains the complete group stage from the spreadsheet", () => {
    expect(initialMatches).toHaveLength(72);
    expect(initialTeams).toHaveLength(48);
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
});
