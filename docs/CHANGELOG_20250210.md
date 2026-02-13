# 2025-02-10 변경 사항

## 인증 및 프로필
- iOS 빌드: app.config.ts에 bundleIdentifier 추가
- Supabase OAuth 웹: detectSessionInUrl, redirectTo 설정으로 구글 로그인 후 세션 복구
- 프로필 편집 페이지 제거, 프로필 화면에서 닉네임만 인라인 편집 (저장 버튼)
- 닉네임 입력 영역 모바일 오버플로우 수정 (minWidth: 0, flexShrink)
- 비로그인 시 이메일 로그인 옵션 제거, Google 로그인만 제공
- 로그아웃: 웹에서 window.confirm 사용, 완료 후 reload

## 학습 진행도
- Day 학습/퀴즈 완료 시 user_progress에 저장 (로그인 사용자)
- 홈: 로그인 시 user_progress 기반 진행도 표시, 비로그인 시 AsyncStorage
- Day 진행도 50일 완료 시 체크 아이콘 및 "50일 학습 완료" 표시

## 설정 및 계정
- 설정 > 콘텐츠 표시 언어: 한국어, 일본어만
- 로그인 시 user_settings 자동 생성 (ensureUserSettings)
- 계정 삭제: delete-user Edge Function에서 bookmarks, bookmark_folders, user_progress, user_settings, user_profiles 순서로 전체 삭제, 실패 시 500 반환
