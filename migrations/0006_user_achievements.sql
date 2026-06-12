PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_achievements (
  league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (league_id, user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_unlocked
  ON user_achievements(user_id, unlocked_at DESC);
