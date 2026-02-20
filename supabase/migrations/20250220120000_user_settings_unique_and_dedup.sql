-- user_settings: user_id당 1행만 허용 (PGRST116 방지)
-- 1. 중복 제거: user_id별 가장 최신(updated_at) 1행만 유지
-- 2. UNIQUE 제약 추가

-- 중복 제거: 각 user_id별 id가 가장 큰(최신) 행만 남기고 나머지 삭제
DELETE FROM user_settings us1
WHERE us1.id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC NULLS LAST, id DESC) AS rn
    FROM user_settings
  ) sub
  WHERE rn > 1
);

-- user_id에 UNIQUE 제약 (이미 있으면 스킵)
CREATE UNIQUE INDEX IF NOT EXISTS user_settings_user_id_key
  ON user_settings (user_id);
