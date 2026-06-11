export interface Env {
  DB: D1Database;
  APP_NAME?: string;
  LEAGUE_NAME?: string;
  API_FOOTBALL_KEY?: string;
  API_FOOTBALL_DAILY_BUDGET?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  leagueId: string;
}

export interface ApiContext {
  env: Env;
  request: Request;
  url: URL;
  user: AuthUser | null;
}
