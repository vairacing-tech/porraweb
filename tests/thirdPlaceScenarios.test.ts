import { describe, expect, it } from "vitest";
import { getThirdPlaceScenario, thirdPlaceWinnerSlots } from "../src/server/thirdPlaceScenarios";

describe("third-place scenario lookup", () => {
  it("maps qualified third-place groups to the FIFA round-of-32 slots", () => {
    expect(thirdPlaceWinnerSlots).toEqual(["1A", "1B", "1D", "1E", "1G", "1I", "1K", "1L"]);
    expect(getThirdPlaceScenario(["C", "D", "E", "F", "G", "I", "K", "L"])).toEqual({
      "1A": "C",
      "1B": "G",
      "1D": "E",
      "1E": "D",
      "1G": "I",
      "1I": "F",
      "1K": "L",
      "1L": "K"
    });
  });

  it("returns null for incomplete third-place combinations", () => {
    expect(getThirdPlaceScenario(["A", "B", "C"])).toBeNull();
  });
});
