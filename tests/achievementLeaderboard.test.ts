import { describe, expect, it, vi } from "vitest";
import { safeGetAchievementLeaderboard } from "../src/server/achievements";
import type { Env } from "../src/server/types";

function createEnv(options: { failAchievementRead?: boolean } = {}): Env {
  const achievementRows = [
    { user_id: "ana", display_name: "Ana", avatar_url: null, achievement_id: "visionario_desastre" },
    { user_id: "ana", display_name: "Ana", avatar_url: null, achievement_id: "nostradamus_aliexpress" },
    { user_id: "beto", display_name: "Beto", avatar_url: "https://example.test/beto.png", achievement_id: "visionario_desastre" },
    { user_id: "beto", display_name: "Beto", avatar_url: "https://example.test/beto.png", achievement_id: "nostradamus_aliexpress" },
    { user_id: "carmen", display_name: "Carmen", avatar_url: null, achievement_id: null }
  ];
  const poolRows = [
    { user_id: "beto", display_name: "Beto", avatar_url: "https://example.test/beto.png", total_points: 12, exacts: 2, champion_hit: 0 },
    { user_id: "ana", display_name: "Ana", avatar_url: null, total_points: 8, exacts: 1, champion_hit: 0 },
    { user_id: "carmen", display_name: "Carmen", avatar_url: null, total_points: 0, exacts: 0, champion_hit: 0 }
  ];

  return {
    DB: {
      prepare(sql: string) {
        return {
          bind: vi.fn().mockReturnThis(),
          all: async () => {
            if (sql.includes("user_achievements ua")) {
              if (options.failAchievementRead) throw new Error("D1 unavailable");
              return { results: achievementRows };
            }
            if (sql.includes("COALESCE(SUM(p.points), 0)")) return { results: poolRows };
            throw new Error(`Unexpected query: ${sql}`);
          }
        };
      }
    } as unknown as D1Database
  };
}

describe("achievement leaderboard", () => {
  it("includes every league member, aggregates achievement ids, and uses pool positions to order shared ranks", async () => {
    const leaderboard = await safeGetAchievementLeaderboard(createEnv());

    expect(leaderboard).toEqual([
      {
        userId: "beto",
        displayName: "Beto",
        avatarUrl: "https://example.test/beto.png",
        achievementIds: ["visionario_desastre", "nostradamus_aliexpress"],
        achievementCount: 2,
        rank: 1
      },
      {
        userId: "ana",
        displayName: "Ana",
        avatarUrl: null,
        achievementIds: ["visionario_desastre", "nostradamus_aliexpress"],
        achievementCount: 2,
        rank: 1
      },
      {
        userId: "carmen",
        displayName: "Carmen",
        avatarUrl: null,
        achievementIds: [],
        achievementCount: 0,
        rank: 3
      }
    ]);
  });

  it("returns an empty leaderboard when D1 cannot read achievements", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(safeGetAchievementLeaderboard(createEnv({ failAchievementRead: true }))).resolves.toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith("ACHIEVEMENT LEADERBOARD READ ERROR", expect.anything());

    errorSpy.mockRestore();
  });
});
