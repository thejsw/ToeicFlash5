-- user_profiles에 address(메일 주소) 컬럼 추가
-- address 기반 유저 판별: 신규/기존 구분

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS address text;

-- address에 unique 제약 (동일 메일 중복 프로필 방지)
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_address_key
  ON user_profiles (address)
  WHERE address IS NOT NULL;

-- 기존 데이터: auth.users와 연동해 address 백필 (선택적, 수동 실행 시)
-- UPDATE user_profiles up
-- SET address = au.email
-- FROM auth.users au
-- WHERE up.id = au.id AND up.address IS NULL;
