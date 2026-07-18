import { describe, expect, it } from "vitest";
import { rankAchievementRows } from "../src/domain/achievementRanking";

describe("achievement ranking", () => {
  it("groups duplicate achievement rows, keeps zero-achievement participants, and assigns shared competition ranks", () => {
    const rows = [
      { userId: "ana", displayName: "Ana", avatarUrl: null, achievementId: "visionario_desastre" as const },
      { userId: "ana", displayName: "Ana", avatarUrl: null, achievementId: "nostradamus_aliexpress" as const },
      { userId: "ana", displayName: "Ana", avatarUrl: null, achievementId: "analista_de_bar" as const },
      { userId: "ana", displayName: "Ana", avatarUrl: null, achievementId: "cementerio_de_puntos" as const },
      { userId: "ana", displayName: "Ana", avatarUrl: null, achievementId: "visionario_desastre" as const },
      { userId: "beto", displayName: "Beto", avatarUrl: "https://example.test/beto.png", achievementId: "visionario_desastre" as const },
      { userId: "beto", displayName: "Beto", avatarUrl: "https://example.test/beto.png", achievementId: "nostradamus_aliexpress" as const },
      { userId: "beto", displayName: "Beto", avatarUrl: "https://example.test/beto.png", achievementId: "analista_de_bar" as const },
      { userId: "beto", displayName: "Beto", avatarUrl: "https://example.test/beto.png", achievementId: "cementerio_de_puntos" as const },
      { userId: "carmen", displayName: "Carmen", avatarUrl: null, achievementId: "visionario_desastre" as const },
      { userId: "zara", displayName: "Zara", avatarUrl: null, achievementId: null },
      { userId: "alvaro", displayName: "\u00c1lvaro", avatarUrl: null, achievementId: null }
    ];

    const ranked = rankAchievementRows(rows, new Map([["beto", 2], ["ana", 5], ["carmen", 1]]));

    expect(ranked.map((row) => [row.userId, row.achievementCount, row.rank])).toEqual([
      ["beto", 4, 1],
      ["ana", 4, 1],
      ["carmen", 1, 3],
      ["alvaro", 0, 4],
      ["zara", 0, 4]
    ]);
    expect(ranked.find((row) => row.userId === "ana")?.achievementIds).toEqual([
      "visionario_desastre",
      "nostradamus_aliexpress",
      "analista_de_bar",
      "cementerio_de_puntos"
    ]);
  });
});
