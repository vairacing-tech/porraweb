import type { Match, SquadPlayer } from "../shared/types";

export interface ScorerRow {
  player: string;
  teamId: string;
  teamName: string;
  goals: number;
}

export function getTopScorers(matches: Match[], squadPlayers: SquadPlayer[] = []): ScorerRow[] {
  const scorers = new Map<string, ScorerRow>();

  for (const match of matches) {
    let previousHome = 0;
    let previousAway = 0;
    for (const goal of match.goals || []) {
      const scoredForHome = goal.homeScore > previousHome;
      const scoredForAway = goal.awayScore > previousAway;
      const teamId = scoredForHome ? match.homeTeam.id : scoredForAway ? match.awayTeam.id : null;
      const teamName = scoredForHome ? match.homeTeam.name : scoredForAway ? match.awayTeam.name : "";

      if (goal.scorerName && goal.scorerName !== "Gol por confirmar" && !goal.isOwnGoal && teamId) {
        const player = canonicalScorerName(goal.scorerName, teamId, squadPlayers);
        const key = `${player}|${teamId}`;
        const current = scorers.get(key) ?? { player, teamId, teamName, goals: 0 };
        current.goals += 1;
        scorers.set(key, current);
      }

      previousHome = goal.homeScore;
      previousAway = goal.awayScore;
    }
  }

  return [...scorers.values()].sort((left, right) => right.goals - left.goals || left.player.localeCompare(right.player)).slice(0, 20);
}

function canonicalScorerName(name: string, teamId: string, squadPlayers: SquadPlayer[]): string {
  const candidates = squadPlayers.filter((player) => player.teamId === teamId);
  return findPersonNameMatch(name, candidates.map((player) => player.name)) ?? name;
}

function findPersonNameMatch(name: string, candidates: string[]): string | null {
  const normalizedName = normalizePersonName(name);
  if (!normalizedName) return null;

  for (const candidate of candidates) {
    const normalizedCandidate = normalizePersonName(candidate);
    if (normalizedCandidate === normalizedName) return candidate;
    if (normalizedCandidate.includes(normalizedName) || normalizedName.includes(normalizedCandidate)) return candidate;
  }

  const nameTokens = normalizedName.split(" ").filter(Boolean);
  const lastName = nameTokens[nameTokens.length - 1];
  const firstInitial = nameTokens[0]?.[0];
  const tokenSet = new Set(nameTokens);

  for (const candidate of candidates) {
    const candidateTokens = normalizePersonName(candidate).split(" ").filter(Boolean);
    if (nameTokens.length >= 2 && candidateTokens.includes(lastName) && candidateTokens.some((token) => token[0] === firstInitial)) {
      return candidate;
    }
    if (nameTokens.length >= 2 && nameTokens.every((token) => candidateTokens.includes(token))) {
      return candidate;
    }
    if (candidateTokens.length >= 2 && candidateTokens.every((token) => tokenSet.has(token))) {
      return candidate;
    }
  }

  return null;
}

function normalizePersonName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
