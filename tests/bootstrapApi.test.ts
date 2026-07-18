import { describe, expect, it, vi } from "vitest";

vi.mock("../src/server/auth", () => ({
  clearSessionCookie: vi.fn(),
  createSession: vi.fn(),
  getAuthUser: vi.fn().mockResolvedValue(null),
  loginUser: vi.fn(),
  sessionCookie: vi.fn()
}));

vi.mock("../src/server/db", () => ({
  createBonus: vi.fn(),
  deleteUserAsAdmin: vi.fn(),
  ensureSeeded: vi.fn().mockResolvedValue(undefined),
  getBonus: vi.fn(),
  getLeaderboard: vi.fn().mockResolvedValue([{ userId: "ana", displayName: "Ana", avatarUrl: null, points: 12, exacts: 2, rank: 1 }]),
  getLeaguePredictions: vi.fn(),
  getLeagueUsers: vi.fn(),
  getMatches: vi.fn().mockResolvedValue([]),
  getSquadPlayers: vi.fn().mockResolvedValue([]),
  getTeams: vi.fn().mockResolvedValue([]),
  getUserClosedSummary: vi.fn(),
  getWorldStandings: vi.fn().mockResolvedValue([]),
  resetUserPassword: vi.fn(),
  savePrediction: vi.fn(),
  setDoublePoints: vi.fn(),
  setMatchResult: vi.fn(),
  setUserBonusAsAdmin: vi.fn(),
  setUserPredictionAsAdmin: vi.fn(),
  updateUserAvatar: vi.fn(),
  updateUserOwnPassword: vi.fn(),
  updateUserProfile: vi.fn()
}));

vi.mock("../src/server/achievements", () => ({
  safeEvaluateAchievements: vi.fn(),
  safeGetAchievementLeaderboard: vi.fn().mockResolvedValue([
    {
      userId: "ana",
      displayName: "Ana",
      avatarUrl: null,
      achievementIds: ["visionario_desastre"],
      achievementCount: 1,
      rank: 1
    }
  ]),
  safeGetUserAchievements: vi.fn()
}));

vi.mock("../src/server/knockout", () => ({ resolveKnockoutMatches: vi.fn() }));
vi.mock("../src/server/resultCompletion", () => ({ runPostResultEvaluation: vi.fn() }));
vi.mock("../src/server/sync", () => ({ runResultSync: vi.fn(), runSquadSync: vi.fn() }));

import { handleApi } from "../src/server/api";

describe("GET /api/bootstrap", () => {
  it("serializes achievementLeaderboard from handleApi", async () => {
    const response = await handleApi(new Request("https://porra.test/api/bootstrap"), { APP_NAME: "Porra" } as never);

    await expect(response.json()).resolves.toMatchObject({
      achievementLeaderboard: [
        expect.objectContaining({ userId: "ana", achievementCount: 1 })
      ]
    });
  });
});
