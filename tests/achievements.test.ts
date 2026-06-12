import { describe, expect, it } from "vitest";
import { evaluateAchievementUnlocks, type AchievementEvaluationInput, type AchievementMatch, type AchievementPrediction } from "../src/domain/achievements";
import { exactPhrases, getPostMatchPhrase, getPreviewPhrase, missPhrases, trendPhrases } from "../src/domain/fortilinCopy";
import { achievementDefinitions } from "../src/shared/achievements";

const baseDate = new Date("2026-06-20T12:00:00.000Z");

describe("achievement evaluation", () => {
  it("unlocks the Fortilin achievement catalog without mutating scoring inputs", () => {
    const input: AchievementEvaluationInput = {
      participants: [
        { userId: "user-a", isAdmin: false, joinedAt: "2026-06-10T12:00:00.000Z" },
        { userId: "user-b", isAdmin: false, joinedAt: "2026-06-10T12:00:00.000Z" },
        { userId: "admin", isAdmin: true, joinedAt: "2026-06-10T12:00:00.000Z" }
      ],
      predictions: [
        ...Array.from({ length: 5 }, (_, index) => prediction({ userId: "user-a", matchId: `miss-${index}`, outcome: "miss", points: 0, kickoffAt: kickoff(index) })),
        ...Array.from({ length: 6 }, (_, index) =>
          prediction({ userId: "user-a", matchId: `bar-${index}`, homeScore: index % 2 === 0 ? 2 : 1, awayScore: index % 2 === 0 ? 1 : 2, outcome: "miss", points: 0, kickoffAt: kickoff(index + 10) })
        ),
        prediction({ userId: "user-a", matchId: "spain", homeTeamId: "espana", awayTeamId: "alemania", homeScore: 0, awayScore: 1, status: "scheduled", lockAt: "2026-06-19T10:00:00.000Z" }),
        ...Array.from({ length: 5 }, (_, index) => prediction({ userId: "user-b", matchId: `trend-${index}`, outcome: "trend", points: 1, kickoffAt: kickoff(index) })),
        prediction({ userId: "admin", matchId: "admin-miss", outcome: "miss", points: 0 })
      ],
      matches: [],
      leaderboard: [
        { userId: "user-a", points: 12, exacts: 0, rank: 1 },
        { userId: "user-b", points: 6, exacts: 0, rank: 2 },
        { userId: "admin", points: 99, exacts: 99, rank: 3 }
      ],
      finalFinished: true,
      now: baseDate
    };
    const snapshot = JSON.stringify(input);

    const unlocks = evaluateAchievementUnlocks(input);
    const idsForA = unlocks.filter((unlock) => unlock.userId === "user-a").map((unlock) => unlock.achievementId).sort();
    const idsForB = unlocks.filter((unlock) => unlock.userId === "user-b").map((unlock) => unlock.achievementId).sort();

    expect(idsForA).toEqual([
      "analista_de_bar",
      "antipatriota_estadistico",
      "campeon_con_asterisco",
      "cementerio_de_puntos",
      "dictador_de_la_tabla",
      "rey_del_barro",
      "visionario_desastre"
    ].sort());
    expect(idsForB).toEqual(["nostradamus_aliexpress", "zurullo_de_oro"].sort());
    expect(unlocks.some((unlock) => unlock.userId === "admin")).toBe(false);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("does not unlock the AliExpress Nostradamus after an exact result exists", () => {
    const input: AchievementEvaluationInput = {
      participants: [{ userId: "user-a", isAdmin: false, joinedAt: "2026-06-10T12:00:00.000Z" }],
      predictions: [
        ...Array.from({ length: 5 }, (_, index) => prediction({ userId: "user-a", matchId: `trend-${index}`, outcome: "trend", points: 1, kickoffAt: kickoff(index) })),
        prediction({ userId: "user-a", matchId: "exact", outcome: "exact", points: 3, kickoffAt: kickoff(9) })
      ],
      matches: [],
      leaderboard: [{ userId: "user-a", points: 8, exacts: 1, rank: 1 }],
      finalFinished: false,
      now: baseDate
    };

    expect(evaluateAchievementUnlocks(input).map((unlock) => unlock.achievementId)).not.toContain("nostradamus_aliexpress");
  });

  it("unlocks the new Fortilin prediction pattern achievements", () => {
    const input: AchievementEvaluationInput = {
      participants: [{ userId: "user-a", isAdmin: false, joinedAt: "2026-06-10T12:00:00.000Z" }],
      predictions: [
        ...Array.from({ length: 4 }, (_, index) =>
          prediction({ matchId: `zero-${index}`, homeScore: 0, awayScore: 0, points: 1, outcome: "trend", lockAt: "2026-06-19T10:00:00.000Z", kickoffAt: kickoff(index) })
        ),
        ...Array.from({ length: 2 }, (_, index) =>
          prediction({ matchId: `draw-${index}`, homeScore: 1, awayScore: 1, points: 1, outcome: "trend", lockAt: "2026-06-19T10:00:00.000Z", kickoffAt: kickoff(index + 5) })
        ),
        ...Array.from({ length: 5 }, (_, index) =>
          prediction({
            matchId: `var-${index}`,
            homeScore: 1,
            awayScore: 0,
            outcome: "miss",
            actualHomeScore: 1,
            actualAwayScore: 1,
            kickoffAt: kickoff(index + 10)
          })
        ),
        ...Array.from({ length: 3 }, (_, index) =>
          prediction({ matchId: `exact-${index}`, homeScore: 2, awayScore: 0, points: 3, outcome: "exact", matchday: 2, kickoffAt: kickoff(index + 20) })
        ),
        prediction({ matchId: "double-zero", isDoublePoints: true, points: 0, outcome: "miss", kickoffAt: kickoff(30) }),
        prediction({
          matchId: "last-minute",
          lockAt: "2026-06-19T10:00:00.000Z",
          createdAt: "2026-06-19T09:30:00.000Z",
          updatedAt: "2026-06-19T09:50:00.000Z",
          status: "scheduled",
          kickoffAt: kickoff(31)
        })
      ],
      matches: [],
      leaderboard: [],
      finalFinished: false,
      now: baseDate
    };

    const ids = evaluateAchievementUnlocks(input).map((unlock) => unlock.achievementId);

    expect(ids).toEqual(expect.arrayContaining([
      "arquitecto_del_cero_cero",
      "funcionario_del_empate",
      "el_var_te_odia",
      "mano_rota",
      "doble_o_nada_pero_nada",
      "ultima_hora_fc"
    ]));
  });

  it("unlocks the forgotten save achievement only for eligible locked matches", () => {
    const input: AchievementEvaluationInput = {
      participants: [
        { userId: "user-a", isAdmin: false, joinedAt: "2026-06-10T12:00:00.000Z" },
        { userId: "user-b", isAdmin: false, joinedAt: "2026-06-13T12:00:00.000Z" },
        { userId: "admin", isAdmin: true, joinedAt: "2026-06-10T12:00:00.000Z" }
      ],
      predictions: [
        prediction({ userId: "user-b", matchId: "future-locked" }),
        prediction({ userId: "admin", matchId: "future-locked" })
      ],
      matches: [
        match({ id: "before-user", lockAt: "2026-06-09T17:00:00.000Z" }),
        match({ id: "future-locked", lockAt: "2026-06-12T17:00:00.000Z" }),
        match({ id: "cancelled", lockAt: "2026-06-12T17:00:00.000Z", status: "cancelled" })
      ],
      leaderboard: [],
      finalFinished: false,
      now: baseDate
    };

    const unlocks = evaluateAchievementUnlocks(input).filter((unlock) => unlock.achievementId === "boton_de_guardar_desconocido");

    expect(unlocks.map((unlock) => unlock.userId)).toEqual(["user-a"]);
  });

  it("keeps the achievement catalog copy with Spanish accents", () => {
    const byId = new Map(achievementDefinitions.map((achievement) => [achievement.id, achievement]));

    expect(byId.get("nostradamus_aliexpress")?.description).toContain("jamás");
    expect(byId.get("antipatriota_estadistico")?.name).toBe("Antipatriota estadístico");
    expect(byId.get("antipatriota_estadistico")?.description).toContain("España");
    expect(byId.get("campeon_con_asterisco")?.name).toBe("Campeón con asterisco");
    expect(byId.get("campeon_con_asterisco")?.description).toContain("todavía está en revisión");
    expect(byId.get("zurullo_de_oro")?.name).toBe("Zurullo de oro");
  });
});

describe("Fortilin copy selectors", () => {
  it("keeps at least 10 post-match phrases per outcome", () => {
    expect(missPhrases.length).toBeGreaterThanOrEqual(10);
    expect(trendPhrases.length).toBeGreaterThanOrEqual(10);
    expect(exactPhrases.length).toBeGreaterThanOrEqual(10);
  });

  it("keeps post-match phrases stable for the same seed", () => {
    expect(getPostMatchPhrase("miss", "user-a:match-a:miss")).toBe(getPostMatchPhrase("miss", "user-a:match-a:miss"));
    expect(getPostMatchPhrase("pending", "user-a:match-a:pending")).toBeNull();
  });

  it("returns a preview phrase for a session seed", () => {
    expect(getPreviewPhrase("match:user:session")).toEqual(expect.any(String));
  });
});

function prediction(overrides: Partial<AchievementPrediction> = {}): AchievementPrediction {
  return {
    userId: "user-a",
    matchId: "match",
    homeScore: 1,
    awayScore: 0,
    points: 0,
    outcome: "miss",
    createdAt: "2026-06-11T16:00:00.000Z",
    updatedAt: "2026-06-11T16:00:00.000Z",
    kickoffAt: "2026-06-11T19:00:00.000Z",
    lockAt: "2026-06-11T17:00:00.000Z",
    status: "finished",
    stage: "GROUP",
    matchday: 1,
    isDoublePoints: false,
    homeTeamId: "mexico",
    awayTeamId: "sudafrica",
    actualHomeScore: null,
    actualAwayScore: null,
    ...overrides
  };
}

function match(overrides: Partial<AchievementMatch> = {}): AchievementMatch {
  return {
    id: "match",
    kickoffAt: "2026-06-11T19:00:00.000Z",
    lockAt: "2026-06-11T17:00:00.000Z",
    status: "scheduled",
    ...overrides
  };
}

function kickoff(offset: number): string {
  return new Date(Date.UTC(2026, 5, 11 + offset, 19, 0, 0)).toISOString();
}
