export type MatchStage = "GROUP" | "ROUND_OF_32" | "ROUND_OF_16" | "QUARTER_FINAL" | "SEMI_FINAL" | "THIRD_PLACE" | "FINAL";

export type MatchStatus = "scheduled" | "locked" | "live" | "finished" | "postponed" | "cancelled";

export type PredictionOutcome = "pending" | "exact" | "trend" | "miss";

export type AchievementId =
  | "visionario_desastre"
  | "nostradamus_aliexpress"
  | "analista_de_bar"
  | "cementerio_de_puntos"
  | "antipatriota_estadistico"
  | "arquitecto_del_cero_cero"
  | "funcionario_del_empate"
  | "el_var_te_odia"
  | "mano_rota"
  | "doble_o_nada_pero_nada"
  | "ultima_hora_fc"
  | "boton_de_guardar_desconocido"
  | "rey_del_barro"
  | "dictador_de_la_tabla"
  | "campeon_con_asterisco"
  | "zurullo_de_oro";

export interface AchievementDefinition {
  id: AchievementId;
  name: string;
  description: string;
}

export interface UserAchievement extends AchievementDefinition {
  unlockedAt: string;
  metadata: Record<string, unknown>;
}

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

export interface MatchGoal {
  minute: number | null;
  scorerName: string | null;
  homeScore: number;
  awayScore: number;
  isPenalty: boolean;
  isOwnGoal: boolean;
  isOvertime: boolean;
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
  goals: MatchGoal[];
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
  avatarUrl: string | null;
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

export interface WorldStanding {
  groupName: string;
  rank: number;
  teamId: string | null;
  teamName: string;
  shortCode: string | null;
  logoUrl: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  updatedAt: string;
}
