export type MatchStage = "GROUP" | "ROUND_OF_32" | "ROUND_OF_16" | "QUARTER_FINAL" | "SEMI_FINAL" | "THIRD_PLACE" | "FINAL";

export type MatchStatus = "scheduled" | "locked" | "live" | "finished" | "postponed" | "cancelled";

export type PredictionOutcome = "pending" | "exact" | "trend" | "miss";

export interface Team {
  id: string;
  name: string;
  shortCode: string;
  apiTeamId?: number | null;
  logoUrl?: string | null;
}

export interface SquadPlayer {
  teamId: string;
  apiPlayerId: number;
  name: string;
  position: string | null;
  photoUrl: string | null;
}

export interface Match {
  id: string;
  apiFixtureId?: number | null;
  stage: MatchStage;
  round: string;
  matchday?: number | null;
  groupName?: string | null;
  homeTeam: Team;
  awayTeam: Team;
  kickoffAt: string;
  lockAt: string;
  status: MatchStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  extraHomeScore?: number | null;
  extraAwayScore?: number | null;
  penaltyHomeScore?: number | null;
  penaltyAwayScore?: number | null;
  isDoublePoints: boolean;
}

export interface Prediction {
  id: string;
  matchId: string;
  userId: string;
  homeScore: number;
  awayScore: number;
  points: number;
  outcome: PredictionOutcome;
}

export interface LeaderboardRow {
  userId: string;
  displayName: string;
  points: number;
  exacts: number;
  championHit: boolean;
  rank: number;
}

export interface BonusPrediction {
  championTeamId: string | null;
  runnerUpTeamId: string | null;
  topScorerTeamId: string | null;
  topScorerPlayerId: number | null;
  topScorer: string | null;
  points: number;
  lockedAt: string;
}
