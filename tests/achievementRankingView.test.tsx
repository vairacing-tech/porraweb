import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AchievementLeaderboardRows } from "../src/App";

describe("achievement ranking view", () => {
  it("renders shared ranks, zero totals, compact achievement marks, and participant buttons", () => {
    const markup = renderToStaticMarkup(
      <AchievementLeaderboardRows
        rows={[
          {
            userId: "ana",
            displayName: "Ana",
            avatarUrl: null,
            achievementIds: ["visionario_desastre", "nostradamus_aliexpress", "analista_de_bar", "cementerio_de_puntos"],
            achievementCount: 4,
            rank: 1
          },
          {
            userId: "beto",
            displayName: "Beto",
            avatarUrl: "https://example.test/beto.png",
            achievementIds: ["mano_rota"],
            achievementCount: 1,
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
        ]}
        onSelect={() => undefined}
      />
    );

    expect(markup).toContain("Ranking de logros");
    expect(markup).toContain(">1<");
    expect(markup).toContain(">3<");
    expect(markup.match(/>1<\/span>/g)).toHaveLength(2);
    expect(markup).toContain("Ana");
    expect(markup).toContain("Beto");
    expect(markup).toContain("Carmen");
    expect(markup).toContain("4 logros");
    expect(markup).toContain("0 logros");
    expect(markup).toContain('data-user-id="ana"');
    expect(markup).toContain('data-user-id="beto"');
    expect(markup).toContain('data-user-id="carmen"');

    const rows = markup.match(/<button class="achievement-board-row"[\s\S]*?<\/button>/g) ?? [];
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => (row.match(/class="achievement-mini-mark"/g) ?? []).length)).toEqual([3, 1, 0]);
  });
});
