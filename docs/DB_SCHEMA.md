# DB Schema Summary

## 1. 테이블 구조

### words — Day별 학습 단어
- id: uuid (PK) — 단어 ID
- word: text — 영어 단어
- example_en: text — 영문 예문
- order_index: int — Day 내 순서
- day: int4 — 학습 Day

---

### word_contents — 단어 부가 정보
- id: uuid (PK) — 콘텐츠 ID
- word_id: uuid (FK → words.id) — 단어 참조
- language: text — 언어 코드
- meaning: text — 의미
- example_local: text — 번역 예문
- order_index: int4 — 출력 순서

---

### quizzes — 퀴즈 묶음
- id: uuid (PK) — 퀴즈 ID
- type: text — 퀴즈 타입
- day_num: int4 — Day 번호
- week_num: int4 — 주차별 모의고사 번호
- created_at: timestamptz — 생성 시각

---

### quiz_questions — 퀴즈 문항
- id: uuid (PK) — 문항 ID
- word_id: uuid (FK → words.id) — 단어 ID
- quiz_id: uuid (FK → quizzes.id) — 퀴즈 정보 참조
- question_text: text — 문제 지문
- order_index: int4 — 문항 순서

---

### quiz_choices — 객관식 보기
- id: uuid (PK) — 보기 ID
- question_id: uuid (FK → quiz_questions.id) — 문항 참조
- choice_key: text — 선택 키
- choice_text: text — 보기 내용
- is_correct: bool - 정답, 오답 구분

---

### quiz_explanations — 문제 해설
- id: uuid (PK) — 해설 ID
- question_id: uuid (FK → quiz_questions.id) — 문항 참조
- language: text — 언어 코드
- explanation: text — 해설 내용

---

### test_quizzes — 테스트용 퀴즈 묶음 (주차별 모의고사 등)
- id: uuid (PK) — 퀴즈 ID
- type: text — 퀴즈 타입
- day_num: int4 — Day 번호
- week_num: int4 — 주차별 모의고사 번호
- created_at: timestamptz — 생성 시각

---

### test_quiz_questions — 테스트용 퀴즈 문항
- id: uuid (PK) — 문항 ID
- quiz_id: uuid (FK → test_quizzes.id) — 퀴즈 정보 참조
- word_id: uuid (FK → words.id) — 단어 ID
- question_text: text — 문제 지문
- order_index: int4 — 문항 순서

---

### test_quiz_choices — 테스트용 객관식 보기
- id: uuid (PK) — 보기 ID
- question_id: uuid (FK → test_quiz_questions.id) — 문항 참조
- choice_key: text — 선택 키 (A, B, C, D)
- choice_text: text — 보기 내용
- is_correct: bool — 정답 여부
- order_index: int4 — 보기 순서

---

### test_quiz_explanations — 테스트용 문제 해설
- id: uuid (PK) — 해설 ID
- question_id: uuid (FK → test_quiz_questions.id) — 문항 참조
- language: text — 언어 코드 (ko, ja 등)
- explanation: text — 해설 내용
- order_index: int4 — 해설 순서

---

### bookmarks — 단어 북마크
- id: uuid (PK) — 북마크 ID
- user_id: uuid (FK → user_profiles.id) — 사용자
- word_id: uuid (FK → words.id) — 단어
- folder_id: uuid (FK → bookmark_folders.id) — 폴더
- created_at: timestamptz — 생성 시각

---

### bookmark_folders — 북마크 폴더
- id: uuid (PK) — 폴더 ID
- user_id: uuid (FK → user_profiles.id) — 사용자
- name: text — 폴더명
- order_index: int4 — 정렬 순서
- created_at: timestamptz — 생성 시각

---

### user_profiles — 사용자 프로필
- id: uuid (PK) — 사용자 ID
- address: text — 메일 주소 (유저 판별용, UNIQUE)
- username: text — 사용자명
- avatar_url: text — 프로필 이미지
- provider: text — 인증 제공자
- created_at: timestamptz — 생성 시각

---

### user_settings — 사용자 설정
- id: uuid (PK) — 설정 ID
- user_id: uuid (FK → user_profiles.id) — 사용자
- learning_language: text — 학습 언어
- notification_enabled: bool — 알림 여부
- updated_at: timestamptz — 수정 시각

---

### user_progress — 학습 진행도
- id: uuid (PK) — 진행 ID
- user_id: uuid (FK → user_profiles.id) — 사용자
- day: int4 — 학습 Day
- last_card_index: int4 — 마지막 카드
- updated_at: timestamptz — 수정 시각

---

## 2. 관계 요약

- words 1:N word_contents
- words 1:N quiz_questions
- quizzes 1:N quiz_questions
- quiz_questions 1:N quiz_choices
- quiz_questions 1:1 quiz_explanations
- test_quizzes 1:N test_quiz_questions (주차별 모의고사)
- test_quiz_questions 1:N test_quiz_choices
- test_quiz_questions 1:N test_quiz_explanations
- user_profiles 1:N bookmarks
- bookmark_folders 1:N bookmarks
