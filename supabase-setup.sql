-- Supabase Setup for X Reply Extension
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/twflzxstgnxwpzzdywqa/sql)

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Update tweets table to use proper vector dimension (1536 for OpenAI text-embedding-3-small)
-- First, drop the existing embedding column if it exists with wrong dimension
ALTER TABLE tweets DROP COLUMN IF EXISTS embedding;

-- Add embedding column with correct dimension
ALTER TABLE tweets ADD COLUMN embedding vector(1536);

-- 3. Create index for fast similarity search
CREATE INDEX IF NOT EXISTS tweets_embedding_idx ON tweets
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 4. Create the similarity search function
CREATE OR REPLACE FUNCTION match_tweets(
  query_embedding vector(1536),
  match_count int DEFAULT 20,
  filter_user_id text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  content text,
  user_id text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tweets.id,
    tweets.content,
    tweets.user_id,
    1 - (tweets.embedding <=> query_embedding) AS similarity
  FROM tweets
  WHERE
    tweets.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR tweets.user_id = filter_user_id)
  ORDER BY tweets.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 5. Enable Row Level Security (optional but recommended)
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;

-- 6. Create policy to allow inserts and reads (adjust based on your needs)
CREATE POLICY "Allow all operations for now" ON tweets
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Verify setup
SELECT 'pgvector extension enabled' AS status WHERE EXISTS (
  SELECT 1 FROM pg_extension WHERE extname = 'vector'
);
