import { describe, expect, it } from "vitest";
import { getLockAt, isPredictionLocked, scorePrediction, validatePrediction } from "../src/domain/scoring";

describe("scoring", () => {
  it("gives 3 points for exact score", () => {
    expect(
      scorePrediction(
        { homeScore: 2, awayScore: 1 },
        { stage: "GROUP", homeScore: 2, awayScore: 1 }
      )
    ).toEqual({ points: 3, outcome: "exact" });
  });

  it("gives 1 point for trend", () => {
    expect(
      scorePrediction(
        { homeScore: 3, awayScore: 0 },
        { stage: "GROUP", homeScore: 1, awayScore: 0 }
      )
    ).toEqual({ points: 1, outcome: "trend" });
  });

  it("doubles points for Spain group fixtures", () => {
    expect(
      scorePrediction(
        { homeScore: 1, awayScore: 1 },
        { stage: "GROUP", homeScore: 2, awayScore: 2, isDoublePoints: true }
      )
    ).toEqual({ points: 2, outcome: "trend" });
  });

  it("rejects draw predictions in knockouts", () => {
    expect(validatePrediction("ROUND_OF_16", { homeScore: 1, awayScore: 1 })).toContain("eliminatorias");
  });

  it("uses penalty shootout winner for knockout trend when the match score is tied", () => {
    expect(
      scorePrediction(
        { homeScore: 2, awayScore: 1 },
        {
          stage: "ROUND_OF_16",
          homeScore: 1,
          awayScore: 1,
          extraHomeScore: 1,
          extraAwayScore: 1,
          penaltyHomeScore: 5,
          penaltyAwayScore: 4
        }
      )
    ).toEqual({ points: 1, outcome: "trend" });
  });

  it("locks two hours before kickoff", () => {
    const kickoff = "2026-06-11T19:00:00.000Z";
    expect(getLockAt(kickoff)).toBe("2026-06-11T17:00:00.000Z");
    expect(isPredictionLocked(kickoff, new Date("2026-06-11T16:59:59.000Z"))).toBe(false);
    expect(isPredictionLocked(kickoff, new Date("2026-06-11T17:00:00.000Z"))).toBe(true);
  });
});
