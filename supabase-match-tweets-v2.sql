-- Updated match_tweets function with recency weighting
-- Run this in Supabase SQL Editor to replace the old function

-- First drop the old function
DROP FUNCTION IF EXISTS match_tweets(vector, int, text);

CREATE OR REPLACE FUNCTION match_tweets(
  query_embedding vector(1536),
  match_count int DEFAULT 20,
  filter_user_id text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  content text,
  similarity float,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.content,
    -- Blend similarity (70%) with recency (30%)
    -- Similarity: 1 - cosine distance (higher = more similar)
    -- Recency: decay function based on days old (higher = more recent)
    (
      (1 - (t.embedding <=> query_embedding)) * 0.7 +
      (1.0 / (1.0 + EXTRACT(EPOCH FROM (now() - t.created_at)) / 86400 / 30)) * 0.3
    )::float AS similarity,
    t.created_at
  FROM tweets t
  WHERE
    t.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR t.user_id = filter_user_id)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Explanation:
-- Similarity score (70% weight): 1 - cosine_distance gives 0-1 where 1 is identical
-- Recency score (30% weight): 1/(1 + days_old/30) gives decay over ~30 days
--   - Today's tweet: 1/(1+0) = 1.0
--   - 30 days old: 1/(1+1) = 0.5
--   - 60 days old: 1/(1+2) = 0.33
--   - 90 days old: 1/(1+3) = 0.25
--
-- This means:
-- - Semantically similar tweets are still prioritized
-- - Among similar tweets, recent ones rank higher
-- - Copied replies (recent) will naturally rise to the top over time
