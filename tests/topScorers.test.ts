import { describe, expect, it } from "vitest";
import { getTopScorers } from "../src/domain/topScorers";
import type { Match, MatchGoal, SquadPlayer, Team } from "../src/shared/types";

const spain: Team = { id: "espana", name: "España", shortCode: "ESP" };
const argentina: Team = { id: "argentina", name: "Argentina", shortCode: "ARG" };

function goal(homeScore: number, awayScore: number, scorerName: string | null, options: Partial<MatchGoal> = {}): MatchGoal {
  return {
    minute: 10,
    scorerName,
    homeScore,
    awayScore,
    isPenalty: false,
    isOwnGoal: false,
    isOvertime: false,
    ...options
  };
}

function match(id: string, goals: MatchGoal[], homeTeam = spain, awayTeam = argentina): Match {
  return {
    id,
    stage: "GROUP",
    round: "Grupo",
    homeTeam,
    awayTeam,
    kickoffAt: "2026-06-11T19:00:00.000Z",
    lockAt: "2026-06-11T17:00:00.000Z",
    status: "finished",
    homeScore: goals.at(-1)?.homeScore ?? 0,
    awayScore: goals.at(-1)?.awayScore ?? 0,
    goals,
    isDoublePoints: false
  };
}

const squads: SquadPlayer[] = [
  { teamId: "espana", apiPlayerId: 1, name: "Mikel Oyarzabal", position: null, photoUrl: null },
  { teamId: "argentina", apiPlayerId: 2, name: "Lionel Messi", position: null, photoUrl: null }
];

describe("getTopScorers", () => {
  it("uses score transitions to infer teams and canonicalizes squad names", () => {
    const scorers = getTopScorers(
      [match("one", [goal(1, 0, "Oyarzabal"), goal(1, 1, "L. Messi"), goal(2, 1, "Mikel Oyarzabal")])],
      squads
    );

    expect(scorers).toEqual([
      { player: "Mikel Oyarzabal", teamId: "espana", teamName: "España", goals: 2 },
      { player: "Lionel Messi", teamId: "argentina", teamName: "Argentina", goals: 1 }
    ]);
  });

  it("excludes own goals and provisional scorer names", () => {
    const scorers = getTopScorers([
      match("one", [
        goal(1, 0, "Lionel Messi", { isOwnGoal: true }),
        goal(2, 0, "Gol por confirmar"),
        goal(2, 1, "Lionel Messi")
      ])
    ], squads);

    expect(scorers).toEqual([
      { player: "Lionel Messi", teamId: "argentina", teamName: "Argentina", goals: 1 }
    ]);
  });

  it("keeps every tied leader and sorts equal totals by player name", () => {
    const scorers = getTopScorers([
      match("one", [goal(1, 0, "Mikel Oyarzabal"), goal(1, 1, "Lionel Messi")]),
      match("two", [goal(0, 1, "Lionel Messi"), goal(1, 1, "Mikel Oyarzabal")])
    ], squads);

    expect(scorers.map(({ player, goals }) => ({ player, goals }))).toEqual([
      { player: "Lionel Messi", goals: 2 },
      { player: "Mikel Oyarzabal", goals: 2 }
    ]);
  });
});
