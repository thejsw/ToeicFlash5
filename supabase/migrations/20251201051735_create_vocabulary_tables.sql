/*
  # TOEIC Vocabulary App Database Schema

  1. New Tables
    - `vocabulary_words`
      - `id` (uuid, primary key)
      - `day` (integer, 1-20)
      - `word` (text, English word)
      - `meaning` (text, Korean meaning)
      - `example` (text, English example sentence)
      - `order_index` (integer, order within the day)
      - `created_at` (timestamp)
    
    - `user_progress`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `day` (integer)
      - `last_card_index` (integer)
      - `updated_at` (timestamp)
    
    - `bookmarks`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `word_id` (uuid, references vocabulary_words)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - vocabulary_words: Public read access
    - user_progress: Users can manage their own progress
    - bookmarks: Users can manage their own bookmarks
*/

-- Create vocabulary_words table
CREATE TABLE IF NOT EXISTS vocabulary_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day integer NOT NULL CHECK (day >= 1 AND day <= 20),
  word text NOT NULL,
  meaning text NOT NULL,
  example text NOT NULL,
  order_index integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vocabulary_words ENABLE ROW LEVEL SECURITY;

-- Public read access for vocabulary words
CREATE POLICY "Anyone can read vocabulary words"
  ON vocabulary_words FOR SELECT
  TO public
  USING (true);

-- Create user_progress table
CREATE TABLE IF NOT EXISTS user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day integer NOT NULL CHECK (day >= 1 AND day <= 20),
  last_card_index integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, day)
);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON user_progress FOR SELECT
  TO public
  USING (user_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'sub', ''));

CREATE POLICY "Users can insert own progress"
  ON user_progress FOR INSERT
  TO public
  WITH CHECK (user_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'sub', ''));

CREATE POLICY "Users can update own progress"
  ON user_progress FOR UPDATE
  TO public
  USING (user_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'sub', ''))
  WITH CHECK (user_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'sub', ''));

-- Create bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  word_id uuid NOT NULL REFERENCES vocabulary_words(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, word_id)
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookmarks"
  ON bookmarks FOR SELECT
  TO public
  USING (user_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'sub', ''));

CREATE POLICY "Users can insert own bookmarks"
  ON bookmarks FOR INSERT
  TO public
  WITH CHECK (user_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'sub', ''));

CREATE POLICY "Users can delete own bookmarks"
  ON bookmarks FOR DELETE
  TO public
  USING (user_id::text = COALESCE(current_setting('request.jwt.claims', true)::json->>'sub', ''));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_vocabulary_day ON vocabulary_words(day, order_index);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
