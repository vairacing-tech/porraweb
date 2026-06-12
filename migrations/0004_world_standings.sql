CREATE TABLE IF NOT EXISTS world_standings (
  team_id TEXT PRIMARY KEY,
  provider_team_id INTEGER,
  group_name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  team_name TEXT NOT NULL,
  short_code TEXT,
  logo_url TEXT,
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  drawn INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  goal_diff INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_standings_group_rank ON world_standings(group_name, rank);
