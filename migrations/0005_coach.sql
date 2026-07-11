-- AI coach feedback memo-cache. Only tier-1 (LLM) responses are stored;
-- tier-0 rule-based messages are derived on the fly and never persisted.
CREATE TABLE coach_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK(kind IN ('food','workout','inbody')),
  record_id INTEGER NOT NULL,        -- id in food_logs / workout_entries / inbody_records
  date TEXT NOT NULL,                -- client-local day, used for daily-cap counting
  tier INTEGER NOT NULL DEFAULT 1,
  event TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_coach_feedback_record ON coach_feedback(user_id, kind, record_id);
CREATE INDEX idx_coach_feedback_user_date ON coach_feedback(user_id, date);
