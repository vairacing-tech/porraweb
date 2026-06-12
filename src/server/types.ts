export interface Env {
  DB: D1Database;
  APP_NAME?: string;
  LEAGUE_NAME?: string;
  OPENLIGADB_BASE_URL?: string;
  OPENLIGADB_LEAGUE_SHORTCUT?: string;
  OPENLIGADB_SEASON?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  leagueId: string;
}

export interface ApiContext {
  env: Env;
  request: Request;
  url: URL;
  user: AuthUser | null;
}
