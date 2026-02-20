# Project Overview

## 프로젝트 성격
- Expo 기반 TOEIC 단어 학습 + AI 문제 생성 앱

## 주요 기술
- Expo Router
- Supabase (Database + Edge Functions)
- OpenAI API

---

## 최상위 폴더 역할 요약

- .bolt  
  - Cursor AI 개발 보조 메타데이터

- app  
  - 화면 구성 및 라우팅

- assets/images  
  - 아이콘, 이미지 리소스

- components  
  - 재사용 가능한 UI 컴포넌트  
  - AuthProvider.tsx: Supabase 인증 상태, 로그인 시 address(메일) 기반 신규/기존 유저 판별 후 user_profiles·user_settings 자동 생성

- hooks  
  - 커스텀 React Hooks  
  - useAuth.ts: AuthContext 훅  
  - 웹 환경 초기화 관련 Hook 포함

- lib  
  - 인프라 설정 및 공용 로직

- tools  
  - DB 데이터 가공 및 관리 툴

- supabase  
  - DB 스키마 및 Edge Functions

- types  
  - 타입 정의 및 도메인 모델

- docs  
  - 문서 및 레퍼런스  
  - CHANGELOG_20250210.md: 일별 변경 이력

- 설정 파일  
  - 빌드, 환경 변수, 포맷 설정

---

## app 폴더 내부 구조

- _layout.tsx  
  - 앱 전체 최상위 레이아웃  
  - ThemeProvider, AuthProvider 래핑

- +not-found.tsx  
  - 잘못된 라우트 접근 시 표시되는 404 화면

- (tabs)  
  - 하단 탭 네비게이션 전용 컨테이너  
  - URL에 노출되지 않음
  - _layout.tsx  
    - 하단 탭 네비게이션 레이아웃
  - index.tsx  
    - 앱 진입 시 기본 화면  
    - 로그인 시 user_progress 기반 Day 진행도, 비로그인 시 AsyncStorage
  - profile/  
    - index.tsx: 프로필 표시, Google 로그인 (닉네임 수정 불가)
    - _layout.tsx: Stack (index, settings)
    - settings.tsx: 콘텐츠 표시 언어(한/일), 푸시 알림, 계정 삭제
  - bookmarks/  
    - 북마크 폴더 목록 및 폴더별 단어 목록
    - index.tsx: 폴더 목록, 폴더 생성
    - [folderId].tsx: 해당 폴더 북마크 단어 플래시카드
    - _components/: MoveBookmarkSheet 등

- study  
  - [day].tsx  
    - Day별 단어 학습(플래시카드) 화면  
    - Day 학습 완료 시 user_progress 저장 (로그인 사용자)
  - [day]/  
    - quiz.tsx  
      - 학습 이후 이어지는 퀴즈 흐름
    - complete.tsx  
      - Day 학습 전체 완료 화면
    - quiz/  
      - result.tsx  
        - 퀴즈 풀이 후 결과 화면  
        - 퀴즈 완료 시 user_progress 저장 (로그인 사용자)

---

## lib 폴더 내부 구조

- supabase.ts  
  - Supabase DB 연결 설정 및 타입 정의  
  - 인증: signInWithGoogle, signOut, getCurrentUserId  
  - user_profiles(address 기반 getUserProfileByAddress, ensureProfile), user_settings(ensureUserSettings), user_progress(upsertUserProgress)  
  - uploadAvatar (Supabase Storage avatars 버킷)

- llm.ts  
  - OpenAI API 호출 로직

- theme.ts  
  - 라이트 / 다크 테마 관리

---

## supabase 폴더 내부 구조

- migrations  
  - DB 마이그레이션 SQL  
  - `20250219120000_schedule_weekly_mock_cron.sql`: Mock Exam 매주 월요일 00:30(KST) 자동 생성 cron  
  - `20250219130000_add_address_to_user_profiles.sql`: user_profiles에 address(메일 주소) 컬럼 추가, address 기반 유저 판별

- functions/generate-quiz  
  - Supabase Edge Function 기반 퀴즈 생성 함수  
  - OpenAI API 응답 파싱 로직 포함

- functions/generate-weekly-quiz  
  - 주차별 TOEIC Part 5 어휘 10문항 생성 후 **Edge Function에서 Service Role로 DB 직접 insert** (RLS 우회)  
  - **필수 시크릿**: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (대시보드 → Edge Functions → generate-weekly-quiz → Secrets)  
  - **자동 생성 (cron)**: 매주 월요일 00:30 KST에 pg_cron으로 자동 호출 → 모든 유저 공통 퀴즈  
  - **cron 설정**: `docs/CRON_SETUP.md` 참고 (Vault 시크릿, pg_cron/pg_net 확장)  
  - **대시보드 테스트**: Request Body `{}` 또는 `{ "weekNum": 2026021 }`  
  - **localhost에서 401**: `npm run deploy:weekly-quiz` 로 재배포 (--no-verify-jwt)

- functions/delete-user  
  - 계정 삭제 Edge Function (Service Role)  
  - bookmarks → bookmark_folders → user_progress → user_settings → user_profiles → auth 사용자 순 삭제  
  - Authorization 헤더로 본인 확인 후 삭제  
  - **CORS**: localhost 등 브라우저 호출 시 preflight(OPTIONS) 지원 (Access-Control-Allow-Methods 등)  
  - **배포**: `npm run deploy:delete-user`

---

## types 폴더 내부 구조

- env.d.ts  
  - 환경 변수 타입 안정성 확보

- modules.d.ts  
  - 외부 모듈 타입 보강

- quiz.ts  
  - 퀴즈 도메인 모델 정의
