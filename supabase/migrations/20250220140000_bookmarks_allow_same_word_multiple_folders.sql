-- bookmarks: 같은 user_id, word_id라도 folder_id가 다르면 여러 행 허용
-- (한 단어를 여러 폴더에 넣을 수 있도록)
-- 1. (user_id, word_id) 유니크 제약/인덱스 모두 제거
-- 2. (user_id, word_id, folder_id) 유니크 인덱스 추가 (같은 폴더에 같은 단어 한 번만)

-- (user_id, word_id) 유니크 제약 제거 (제약이 있으면 인덱스는 함께 제거됨)
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_user_id_word_id_key;
-- 인덱스만 있는 경우 (제약 없이 생성된 경우)
DROP INDEX IF EXISTS bookmarks_user_id_word_id_uniq;

-- (user_id, word_id) 만 있는 유니크 제약 찾아서 제거 (컬럼 순서 무관)
DO $$
DECLARE
  con_name text;
  con_cols text[];
BEGIN
  FOR con_name, con_cols IN
    SELECT c.conname,
      (SELECT array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum))
       FROM pg_attribute a
       WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND NOT a.attisdropped)
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'bookmarks'
      AND c.contype = 'u'
      AND n.nspname = 'public'
  LOOP
    IF con_cols @> ARRAY['user_id', 'word_id'] AND array_length(con_cols, 1) = 2 THEN
      EXECUTE format('ALTER TABLE bookmarks DROP CONSTRAINT %I', con_name);
      EXIT;
    END IF;
  END LOOP;
END $$;

-- (user_id, word_id) 2컬럼 유니크 인덱스 찾아서 제거 (제약이 아닌 인덱스만 있는 경우)
DO $$
DECLARE
  idx_name text;
  idx_cols text[];
BEGIN
  FOR idx_name, idx_cols IN
    SELECT c.relname,
      (SELECT array_agg(a.attname ORDER BY a.attnum)
       FROM pg_attribute a
       WHERE a.attrelid = ix.indrelid
         AND a.attnum IN (SELECT (ix.indkey)[gs] FROM generate_series(1, ix.indnatts) gs)
         AND a.attnum > 0 AND NOT a.attisdropped)
    FROM pg_index ix
    JOIN pg_class c ON c.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'bookmarks'
      AND ix.indisunique
      AND n.nspname = 'public'
  LOOP
    IF idx_cols @> ARRAY['user_id', 'word_id'] AND array_length(idx_cols, 1) = 2 THEN
      EXECUTE format('DROP INDEX IF EXISTS %I', idx_name);
      EXIT;
    END IF;
  END LOOP;
END $$;

-- (user_id, word_id, folder_id) 유니크 인덱스 추가 (같은 폴더에 같은 단어 한 번만)
CREATE UNIQUE INDEX IF NOT EXISTS bookmarks_user_id_word_id_folder_id_key
  ON bookmarks (user_id, word_id, folder_id);
