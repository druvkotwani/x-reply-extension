-- Style Profiles Table for X Reply Extension
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS style_profiles (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id text NOT NULL DEFAULT 'default_user',
  profile jsonb NOT NULL,
  tweet_count int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS style_profiles_user_id_idx ON style_profiles(user_id);

-- Only keep latest profile per user (optional - run manually if needed)
-- DELETE FROM style_profiles WHERE id NOT IN (
--   SELECT DISTINCT ON (user_id) id FROM style_profiles ORDER BY user_id, created_at DESC
-- );
