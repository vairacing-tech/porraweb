import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ order: [] as string[] }));

vi.mock("../src/server/bonus", () => ({
  async evaluateTournamentBonuses() {
    state.order.push("bonus");
    return { applied: true, changed: 2, evaluated: 6 };
  }
}));

vi.mock("../src/server/achievements", () => ({
  async safeEvaluateAchievements() {
    state.order.push("achievements");
  }
}));

import { runPostResultEvaluation } from "../src/server/resultCompletion";

describe("runPostResultEvaluation", () => {
  beforeEach(() => {
    state.order.length = 0;
  });

  it("updates tournament bonuses before achievements and returns the bonus result", async () => {
    const result = await runPostResultEvaluation({ DB: {} as D1Database });

    expect(state.order).toEqual(["bonus", "achievements"]);
    expect(result).toEqual({ applied: true, changed: 2, evaluated: 6 });
  });
});
