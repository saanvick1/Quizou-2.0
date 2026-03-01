# Quizou 2.0 - Advanced AI Scholar Bowl Platform

## Overview
Quizou 2.0 is an advanced AI-powered Scholar Bowl practice platform for the Congressional App Challenge. It offers NAQT-style questions, adaptive learning, gamification, and teacher dashboards. The platform aims to provide free, high-quality Quiz Bowl preparation, especially for underfunded schools. Key capabilities include a ChatGPT-style AI Coach, AI-Powered Topic Insights, an Interactive Concept Map, a Simulated Competition Mode, AI tutor explanations, adaptive difficulty, performance analytics with cognitive gap detection, global leaderboards, and a badge system. It also features teacher classrooms, an AI Memory Graph with concept mastery tracking, Behavior Analysis, and Smart Adaptive Difficulty Tuning. Recent additions include an Admin Analytics Dashboard, Quiz Sharing, Mid-Quiz Difficulty Adjustment, Material Upload for question generation, Buzzer Mode, Tournament Round mode, a Daily Challenge system, a Streak System, Voice & Smart Answer Checking with fuzzy matching, Timer Mode, and Learning & Study Tools (Missed Questions Review, Flashcard Mode, Study Sets, Performance Breakdown).

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: Vanilla HTML/CSS/JavaScript.
- **Design Pattern**: Multi-page application with server-side routing and client-side interactivity. Navigation consolidated: History page has subtabs for Question History, Missed Questions Review, and Performance Stats. Old routes (/missed-questions, /performance) redirect to /history#review and /history#stats.
- **UI/UX Approach**: Clean, educational interface with a navy blue/orange color scheme, focused on readability. Features a modern pill-style horizontal navigation.
- **Accessibility**: WCAG-compliant with skip navigation links, ARIA landmarks (role="banner", role="navigation", role="main"), aria-labels on inputs/buttons, aria-live regions for dynamic content, focus-visible outlines, keyboard navigation for flashcards (Space/Enter to flip, Arrow keys to navigate).
### Backend Architecture
- **Framework**: Flask (Python web framework).
- **API Design**: RESTful JSON API for authentication, question generation, and user history.
- **Session Management**: Flask sessions with server-side storage.
- **Password Security**: Werkzeug for password hashing.
- **Error Handling**: API-level validation with appropriate HTTP status codes.

### Data Storage
- **Database**: SQLite with 28 comprehensive tables, including `users`, `questions`, `history`, `explanations`, `user_analytics`, `badges`, `leaderboard`, `classrooms`, `classroom_members`, `assignments`, `class_posts`, dedicated tables for the AI Memory Graph (`concept_nodes`, `concept_edges`, `concept_mastery`, `user_behavior`, `learning_patterns`, `competition_predictions`), Learning Tools tables (`daily_challenges`, `daily_challenge_results`, `study_sets`, `study_set_questions`), Advanced Features tables (`knowledge_decay`, `h2h_challenges`, `question_writing`, `power_training_sessions`), and Innovative Features tables (`debate_sessions`, `timeline_attempts`).
- **Schema Design**: Relational model with foreign keys, automatic timestamps, and UNIQUE constraints.
- **Migration System**: Production-ready idempotent migration script (`migrate_db.py`).
- **Uniqueness Strategy**: Ensures unlimited generation of unique questions per user, answer diversity, and comprehensive topic coverage.

### AI Integration
- **Provider**: Together.AI API utilizing Meta Llama 3.1.
- **AI Study Coach**: Generates personalized study plans by analyzing performance data, behavior patterns, concept mastery, and cognitive gaps.
- **Question Generation Logic**: Produces NAQT-style pyramidal questions (5-7 sentences) with difficulty-based prompt engineering (Easy, Medium, Hard). Enforces answer protection, topic diversity, and uniqueness.
- **Prompt Engineering**: System prompts enforce NAQT formatting, pyramidal progression, and ensure answers are not revealed in the question text.
- **Model Configuration**: Configurable via environment variables (e.g., `MODEL`, `TOGETHER_URL`).

### Authentication Flow
- **Sign Up/Login**: Username uniqueness, password validation, session creation.
- **Session Check**: Client-side session restoration.
- **Logout**: Session destruction and redirection.
- **User Types**: Supports Teacher, Student, and Independent roles. Teachers have full access to all student/independent features (quiz generation, history, competition, etc.) plus classroom management. Students and independents can join teacher classes via 6-character codes.
- **Classroom System**: Teachers create classes with unique codes, post announcements/assignments/resources. Students join via codes, view teacher posts, and can leave classes. Posts support types: announcement, assignment, resource.

### Question Generation Workflow
- Users select topic, difficulty, and quantity.
- Backend calls Together.AI to return JSON question/answer pairs.
- **Global Answer Deduplication**: No question with the same answer is ever shown twice to the same user across all modes (regular quizzes, packets, tournaments, power training, material upload). Uses two-layer approach:
  - **Prompt-level**: Recent answers sent to AI with instructions to avoid them.
  - **DB-level**: `get_all_user_answers(user_id)` fetches the user's complete answer history for post-generation filtering. Functions affected: `generate_questions`, `generate_questions_from_material`, `generate_packet`, `generate_tournament_round`, `generate_power_clues`.
- Questions stored locally and presented to the user.
- User answers are tracked for historical analysis.

### Advanced Features
- **AI-Powered Topic Insights**: Analyzes incorrect answers, groups mistakes by topic, provides sample mistakes, and identifies difficult areas.
- **Interactive Concept Map**: Visualizes knowledge graph with concept nodes categorized by mastery status (Mastered, Learning, Beginner, Not Started).
- **Simulated Competition Mode**: Generates AI-powered mock tournaments with an AI competitor, real-time scoreboard, and suggested topics based on user history. Supports Standard, Speed, and Expert competition types.
- **Quiz Sharing**: Allows sharing quizzes via 6-character codes.
- **Material Upload**: Generates questions from uploaded `.txt`, `.md`, or `.csv` files.
- **Buzzer Mode**: Progressive word-by-word question reveal with buzz-in functionality and point system.
- **Tournament Round Mode**: Generates NAQT-style toss-up and bonus questions with real-time scoring.
- **Daily Challenge**: Provides 5 mixed-topic questions daily with a leaderboard.
- **Streak System**: Tracks consecutive days of practice.
- **Voice & Smart Answer Checking**: Includes Text-to-Speech, Speech-to-Text, and fuzzy answer matching.
- **Timer Mode**: Configurable per-question countdown timer with visual feedback.
- **Clue-by-Clue Power Training**: Pyramidal question reveal with buzz-in mechanics and power scoring (15/10/5/-5 pts). Tracks career stats (avg buzz depth, total points).
- **Knowledge Decay Tracker**: Exponential decay model tracking topic freshness based on days since practice and accuracy. Color-coded health bars (green/yellow/red) with "Review Now" links that pre-fill topics.
- **Head-to-Head Challenges**: Async PvP quiz battles - create challenges, accept/decline, play 5-question rounds, side-by-side score comparison with win/loss/draw verdicts.
- **AI Question Writer Workshop**: Students write NAQT questions and get AI grading (1-10) on pyramidal structure, clue quality, answer protection, difficulty accuracy, factual accuracy. Report card UI with submission history.
- **Smart Packet Generator**: Generates competition-ready packets (Full 20 toss-ups + bonuses, Half 10, Lightning 30 short-answer) with category distribution, formatted display, and print support.
- **Question Autopsy Lab**: Deep clue-by-clue dissection of missed questions. AI identifies knowledge gaps, provides mini-lessons, and generates targeted recovery quizzes. Accessible from missed questions review via "Dissect" button.
- **AI Debate Arena**: 3-round academic debate against AI. Random side assignment, chat-style UI, scored on factual accuracy, reasoning quality, and evidence use (1-10 each).
- **Visual Timeline Builder**: Drag-and-drop chronological ordering of AI-generated historical events. Scores placement accuracy and reveals dates/context after checking.

## External Dependencies

### Third-Party APIs
- **Together.AI API**: Used for AI inference with Meta Llama 3.1 model.
  - Endpoint: `https://api.together.xyz/v1/chat/completions`
  - Model: `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo`
  - Authentication: Bearer token via `TOGETHER_API_KEY`.
- **Web Speech API**: Used for Text-to-Speech and Speech-to-Text functionalities.

### Python Packages
- **Flask**: Web framework.
- **Flask-CORS**: Cross-Origin Resource Sharing.
- **Werkzeug**: Password hashing.
- **sqlite3**: Database interface.
- **requests**: HTTP library.

### Environment Variables
- **SESSION_SECRET**: Flask session encryption key.
- **TOGETHER_API_KEY**: API authentication for Together.AI.
- **TOGETHER_URL** (Optional): API endpoint URL.
- **MODEL** (Optional): AI model identifier.

### Database
- **SQLite**: Embedded relational database (`scholar_bowl.db`).