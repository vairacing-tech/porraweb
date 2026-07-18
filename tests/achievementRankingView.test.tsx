// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AchievementLeaderboardRows, LeaderboardView } from "../src/App";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

describe("achievement ranking empty state", () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    container?.remove();
    container = null;
  });

  it("shows an unavailable message when the main leaderboard has participants but achievements are unavailable", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LeaderboardView
          data={{
            leaderboard: [{ userId: "ana", displayName: "Ana", avatarUrl: null, points: 12, exacts: 2, rank: 1 }],
            achievementLeaderboard: []
          } as never}
          onSelectUser={() => undefined}
        />
      );
    });

    expect(container.textContent).toContain("El ranking de logros no está disponible todavía.");
    expect(container.textContent).not.toContain("Aún no hay participantes.");
  });

  it("keeps the participant empty state when both leaderboards are empty", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LeaderboardView data={{ leaderboard: [], achievementLeaderboard: [] } as never} onSelectUser={() => undefined} />);
    });

    expect(container.textContent).toContain("Aún no hay participantes.");
  });

  it("calls onSelect with the clicked achievement participant id in a real DOM", async () => {
    const onSelect = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AchievementLeaderboardRows
          rows={[{ userId: "beto", displayName: "Beto", avatarUrl: null, achievementIds: [], achievementCount: 0, rank: 1 }]}
          onSelect={onSelect}
        />
      );
    });
    const button = container.querySelector<HTMLButtonElement>('[data-user-id="beto"]');

    await act(async () => {
      button?.click();
    });

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith("beto");
  });
});
