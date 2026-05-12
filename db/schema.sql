-- Run this against your Neon database to add lock-in schema

-- InBody body composition logs
CREATE TABLE IF NOT EXISTS inbody_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  body_fat NUMERIC,
  skeletal_muscle NUMERIC,
  trunk_fat NUMERIC,
  whr NUMERIC,
  bmr NUMERIC,
  recovery_status NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);

-- Ensure no duplicate workout sessions per user per day
ALTER TABLE workout_sessions ADD CONSTRAINT unique_user_date UNIQUE (user_id, date);

-- Track completion percentage (100 = full, 1-99 = partial)
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS completion_pct INTEGER DEFAULT 100;

-- Track rest days (boolean)
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS rest_day BOOLEAN DEFAULT FALSE;
