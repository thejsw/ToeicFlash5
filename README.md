# TOEIC Flash5

AI-powered TOEIC Vocabulary Learning App

TOEIC Flash5 is a mobile application designed to help learners efficiently memorize TOEIC vocabulary through flashcards, quizzes, bookmarks, and AI-generated practice questions.

TOEIC learning platform is an available

WEB: https://toeicflash5.vercel.app/

Google Play: https://play.google.com/store/apps/details?id=com.thejsw.toeicflashcardvoca

## Features

### 📚 Daily Vocabulary Learning
- Learn TOEIC vocabulary organized by Day
- Flashcard-based learning experience
- Example sentences and multilingual meanings
- Resume learning from previous progress

### 🤖 AI Quiz Generation
- Generate TOEIC-style vocabulary questions using OpenAI
- Multiple-choice questions with explanations
- Automatic quiz generation through Supabase Edge Functions

### 📝 Weekly Mock Exams
- Weekly TOEIC Part 5 vocabulary quizzes
- Automatically generated every week
- Shared quiz sets for all users

### 🔖 Bookmark System
- Save difficult words
- Organize vocabulary into custom folders
- Review bookmarked words anytime

### 👤 User Account
- Google Login
- Learning progress synchronization
- Personalized settings
- Account deletion support

### 🌏 Multi-language Support
- Korean and Japanese learning content
- Language-specific explanations and meanings

---

## Tech Stack

### Frontend
- Expo
- React Native
- Expo Router
- TypeScript

### Backend
- Supabase
  - PostgreSQL
  - Authentication
  - Storage
  - Edge Functions

### AI
- OpenAI API

### Cloud
- Supabase Edge Functions
- Cron Jobs (pg_cron)

---

## Architecture

```text
Mobile App (Expo)
        │
        ▼
 Supabase Auth
        │
        ▼
 PostgreSQL
        │
        ├── Vocabulary Data
        ├── User Progress
        ├── Bookmarks
        └── Quiz Data
        │
        ▼
 Supabase Edge Functions
        │
        ▼
    OpenAI API
