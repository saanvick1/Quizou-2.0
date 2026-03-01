import sqlite3
import os
from datetime import datetime

DB_NAME = 'scholar_bowl.db'

def migrate_database():
    """
    Migrate existing database to support all new features.
    This runs automatically on startup and is safe to run multiple times.
    """
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    print("Running database migrations...")
    
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        existing_tables = {row[0] for row in cursor.fetchall()}
        
        if not existing_tables or 'users' not in existing_tables:
            print("  - Creating complete schema (fresh install)...")
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    full_name TEXT,
                    email TEXT,
                    grade TEXT,
                    school TEXT,
                    bio TEXT,
                    language_preference TEXT DEFAULT 'English',
                    is_teacher BOOLEAN DEFAULT 0,
                    role TEXT DEFAULT 'student',
                    scholar_league_points INTEGER DEFAULT 0,
                    current_level INTEGER DEFAULT 1,
                    current_streak INTEGER DEFAULT 0,
                    longest_streak INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS questions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    topic TEXT NOT NULL,
                    difficulty TEXT NOT NULL,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    language TEXT DEFAULT 'English',
                    avg_rating REAL DEFAULT 0,
                    total_ratings INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    question_id INTEGER NOT NULL,
                    correct BOOLEAN,
                    time_taken INTEGER,
                    cognitive_type TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (question_id) REFERENCES questions(id)
                )
            ''')
            print("  - Base tables created with full schema")
            conn.commit()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            existing_tables = {row[0] for row in cursor.fetchall()}
        else:
            cursor.execute("PRAGMA table_info(users)")
            user_columns = {row[1] for row in cursor.fetchall()}
            
            columns_to_add = []
            if 'full_name' not in user_columns:
                columns_to_add.append(('full_name', 'TEXT'))
            if 'email' not in user_columns:
                columns_to_add.append(('email', 'TEXT'))
            if 'grade' not in user_columns:
                columns_to_add.append(('grade', 'TEXT'))
            if 'school' not in user_columns:
                columns_to_add.append(('school', 'TEXT'))
            if 'bio' not in user_columns:
                columns_to_add.append(('bio', 'TEXT'))
            if 'language_preference' not in user_columns:
                columns_to_add.append(('language_preference', 'TEXT DEFAULT "English"'))
            if 'is_teacher' not in user_columns:
                columns_to_add.append(('is_teacher', 'BOOLEAN DEFAULT 0'))
            if 'role' not in user_columns:
                columns_to_add.append(('role', 'TEXT DEFAULT "student"'))
            if 'scholar_league_points' not in user_columns:
                columns_to_add.append(('scholar_league_points', 'INTEGER DEFAULT 0'))
            if 'current_level' not in user_columns:
                columns_to_add.append(('current_level', 'INTEGER DEFAULT 1'))
            if 'current_streak' not in user_columns:
                columns_to_add.append(('current_streak', 'INTEGER DEFAULT 0'))
            if 'longest_streak' not in user_columns:
                columns_to_add.append(('longest_streak', 'INTEGER DEFAULT 0'))
            
            if columns_to_add:
                print(f"  - Adding {len(columns_to_add)} new columns to users table...")
                for col_name, col_type in columns_to_add:
                    cursor.execute(f'ALTER TABLE users ADD COLUMN {col_name} {col_type}')
            
            cursor.execute("PRAGMA table_info(questions)")
            question_columns = {row[1] for row in cursor.fetchall()}
            
            columns_to_add = []
            if 'language' not in question_columns:
                columns_to_add.append(('language', 'TEXT DEFAULT "English"'))
            if 'avg_rating' not in question_columns:
                columns_to_add.append(('avg_rating', 'REAL DEFAULT 0'))
            if 'total_ratings' not in question_columns:
                columns_to_add.append(('total_ratings', 'INTEGER DEFAULT 0'))
            
            if columns_to_add:
                print(f"  - Adding {len(columns_to_add)} new columns to questions table...")
                for col_name, col_type in columns_to_add:
                    cursor.execute(f'ALTER TABLE questions ADD COLUMN {col_name} {col_type}')
            
            cursor.execute("PRAGMA table_info(history)")
            history_columns = {row[1] for row in cursor.fetchall()}
            
            columns_to_add = []
            if 'time_taken' not in history_columns:
                columns_to_add.append(('time_taken', 'INTEGER'))
            if 'cognitive_type' not in history_columns:
                columns_to_add.append(('cognitive_type', 'TEXT'))
            
            if columns_to_add:
                print(f"  - Adding {len(columns_to_add)} new columns to history table...")
                for col_name, col_type in columns_to_add:
                    cursor.execute(f'ALTER TABLE history ADD COLUMN {col_name} {col_type}')
        
        if 'explanations' not in existing_tables:
            print("  - Creating explanations table...")
            cursor.execute('''
                CREATE TABLE explanations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    question_id INTEGER NOT NULL,
                    explanation_text TEXT NOT NULL,
                    wrong_option_1 TEXT,
                    wrong_explanation_1 TEXT,
                    wrong_option_2 TEXT,
                    wrong_explanation_2 TEXT,
                    hint_text TEXT,
                    language TEXT DEFAULT 'English',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (question_id) REFERENCES questions(id)
                )
            ''')
        
        if 'user_analytics' not in existing_tables:
            print("  - Creating user_analytics table...")
            cursor.execute('''
                CREATE TABLE user_analytics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    topic TEXT NOT NULL,
                    difficulty TEXT NOT NULL,
                    recall_gap_count INTEGER DEFAULT 0,
                    inference_gap_count INTEGER DEFAULT 0,
                    comprehension_gap_count INTEGER DEFAULT 0,
                    total_questions INTEGER DEFAULT 0,
                    correct_questions INTEGER DEFAULT 0,
                    avg_speed REAL DEFAULT 0,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE(user_id, topic, difficulty)
                )
            ''')
        
        if 'badges' not in existing_tables:
            print("  - Creating badges table...")
            cursor.execute('''
                CREATE TABLE badges (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    badge_name TEXT NOT NULL,
                    badge_description TEXT,
                    badge_icon TEXT,
                    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')
        
        if 'leaderboard' not in existing_tables:
            print("  - Creating leaderboard table...")
            cursor.execute('''
                CREATE TABLE leaderboard (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    total_points INTEGER DEFAULT 0,
                    total_correct INTEGER DEFAULT 0,
                    total_questions INTEGER DEFAULT 0,
                    accuracy_rate REAL DEFAULT 0,
                    global_rank INTEGER,
                    regional_rank INTEGER,
                    school_rank INTEGER,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE(user_id)
                )
            ''')
        
        if 'classrooms' not in existing_tables:
            print("  - Creating classrooms table...")
            cursor.execute('''
                CREATE TABLE classrooms (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    teacher_id INTEGER NOT NULL,
                    classroom_name TEXT NOT NULL,
                    classroom_code TEXT UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (teacher_id) REFERENCES users(id)
                )
            ''')
        
        if 'classroom_members' not in existing_tables:
            print("  - Creating classroom_members table...")
            cursor.execute('''
                CREATE TABLE classroom_members (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    classroom_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE(classroom_id, user_id)
                )
            ''')
        
        if 'assignments' not in existing_tables:
            print("  - Creating assignments table...")
            cursor.execute('''
                CREATE TABLE assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    classroom_id INTEGER NOT NULL,
                    teacher_id INTEGER NOT NULL,
                    assignment_name TEXT NOT NULL,
                    topic TEXT NOT NULL,
                    difficulty TEXT NOT NULL,
                    num_questions INTEGER NOT NULL,
                    due_date TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
                    FOREIGN KEY (teacher_id) REFERENCES users(id)
                )
            ''')
        
        if 'class_posts' not in existing_tables:
            print("  - Creating class_posts table...")
            cursor.execute('''
                CREATE TABLE class_posts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    classroom_id INTEGER NOT NULL,
                    teacher_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    post_type TEXT DEFAULT 'announcement',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (classroom_id) REFERENCES classrooms(id),
                    FOREIGN KEY (teacher_id) REFERENCES users(id)
                )
            ''')
        
        if 'concept_nodes' not in existing_tables:
            print("  - Creating concept_nodes table...")
            cursor.execute('''
                CREATE TABLE concept_nodes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    concept_name TEXT UNIQUE NOT NULL,
                    category TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
        
        if 'concept_edges' not in existing_tables:
            print("  - Creating concept_edges table...")
            cursor.execute('''
                CREATE TABLE concept_edges (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_id INTEGER NOT NULL,
                    target_id INTEGER NOT NULL,
                    relationship_type TEXT DEFAULT 'related',
                    strength REAL DEFAULT 0.5,
                    FOREIGN KEY (source_id) REFERENCES concept_nodes(id),
                    FOREIGN KEY (target_id) REFERENCES concept_nodes(id),
                    UNIQUE(source_id, target_id)
                )
            ''')
        
        if 'concept_mastery' not in existing_tables:
            print("  - Creating concept_mastery table...")
            cursor.execute('''
                CREATE TABLE concept_mastery (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    concept_id INTEGER NOT NULL,
                    accuracy_rate REAL DEFAULT 0,
                    total_attempts INTEGER DEFAULT 0,
                    correct_attempts INTEGER DEFAULT 0,
                    last_practiced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (concept_id) REFERENCES concept_nodes(id),
                    UNIQUE(user_id, concept_id)
                )
            ''')
        
        if 'page_views' not in existing_tables:
            print("  - Creating page_views table...")
            cursor.execute('''
                CREATE TABLE page_views (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    page TEXT NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')

        if 'shared_quizzes' not in existing_tables:
            print("  - Creating shared_quizzes table...")
            cursor.execute('''
                CREATE TABLE shared_quizzes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    share_code TEXT UNIQUE NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    question_ids TEXT NOT NULL,
                    topic TEXT,
                    difficulty TEXT,
                    view_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')

        if 'uploaded_materials' not in existing_tables:
            print("  - Creating uploaded_materials table...")
            cursor.execute('''
                CREATE TABLE uploaded_materials (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')

        if 'question_feedback' not in existing_tables:
            print("  - Creating question_feedback table...")
            cursor.execute('''
                CREATE TABLE question_feedback (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    question_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
                    feedback_type TEXT,
                    feedback_comment TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (question_id) REFERENCES questions(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')
        
        try:
            cursor.execute("SELECT last_practice_date FROM users LIMIT 1")
        except:
            print("  - Adding last_practice_date to users...")
            cursor.execute("ALTER TABLE users ADD COLUMN last_practice_date TEXT")

        if 'daily_challenges' not in existing_tables:
            print("  - Creating daily_challenges table...")
            cursor.execute('''
                CREATE TABLE daily_challenges (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT UNIQUE NOT NULL,
                    questions_json TEXT NOT NULL,
                    topic TEXT,
                    difficulty TEXT DEFAULT 'Medium',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')

        if 'daily_challenge_results' not in existing_tables:
            print("  - Creating daily_challenge_results table...")
            cursor.execute('''
                CREATE TABLE daily_challenge_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    challenge_date TEXT NOT NULL,
                    score INTEGER DEFAULT 0,
                    total_questions INTEGER DEFAULT 5,
                    correct_answers INTEGER DEFAULT 0,
                    time_taken INTEGER DEFAULT 0,
                    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE(user_id, challenge_date)
                )
            ''')

        if 'study_sets' not in existing_tables:
            print("  - Creating study_sets table...")
            cursor.execute('''
                CREATE TABLE study_sets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')

        if 'study_set_questions' not in existing_tables:
            print("  - Creating study_set_questions table...")
            cursor.execute('''
                CREATE TABLE study_set_questions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    set_id INTEGER NOT NULL,
                    question_id INTEGER NOT NULL,
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (set_id) REFERENCES study_sets(id),
                    FOREIGN KEY (question_id) REFERENCES questions(id),
                    UNIQUE(set_id, question_id)
                )
            ''')

        if 'knowledge_decay' not in existing_tables:
            print("  - Creating knowledge_decay table...")
            cursor.execute('''
                CREATE TABLE knowledge_decay (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    topic TEXT NOT NULL,
                    last_practiced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    decay_score REAL DEFAULT 100.0,
                    review_due_at TIMESTAMP,
                    accuracy REAL DEFAULT 50.0,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE(user_id, topic)
                )
            ''')

        if 'h2h_challenges' not in existing_tables:
            print("  - Creating h2h_challenges table...")
            cursor.execute('''
                CREATE TABLE h2h_challenges (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    challenger_id INTEGER NOT NULL,
                    opponent_id INTEGER NOT NULL,
                    topic TEXT NOT NULL,
                    difficulty TEXT DEFAULT 'Medium',
                    questions_json TEXT NOT NULL,
                    challenger_score INTEGER DEFAULT NULL,
                    opponent_score INTEGER DEFAULT NULL,
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (challenger_id) REFERENCES users(id),
                    FOREIGN KEY (opponent_id) REFERENCES users(id)
                )
            ''')

        if 'question_writing' not in existing_tables:
            print("  - Creating question_writing table...")
            cursor.execute('''
                CREATE TABLE question_writing (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    topic TEXT NOT NULL,
                    difficulty TEXT DEFAULT 'Medium',
                    question_text TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    ai_score REAL DEFAULT NULL,
                    ai_feedback TEXT DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')

        if 'power_training_sessions' not in existing_tables:
            print("  - Creating power_training_sessions table...")
            cursor.execute('''
                CREATE TABLE power_training_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    topic TEXT NOT NULL,
                    total_clues INTEGER DEFAULT 0,
                    buzz_depth INTEGER DEFAULT 0,
                    points_earned INTEGER DEFAULT 0,
                    correct BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')

        if 'debate_sessions' not in existing_tables:
            print("  - Creating debate_sessions table...")
            cursor.execute('''
                CREATE TABLE debate_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    topic TEXT NOT NULL,
                    side TEXT DEFAULT '',
                    rounds_json TEXT DEFAULT '[]',
                    ai_score REAL DEFAULT NULL,
                    feedback_json TEXT DEFAULT NULL,
                    status TEXT DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')

        if 'timeline_attempts' not in existing_tables:
            print("  - Creating timeline_attempts table...")
            cursor.execute('''
                CREATE TABLE timeline_attempts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    topic TEXT NOT NULL,
                    events_json TEXT DEFAULT '[]',
                    score REAL DEFAULT 0,
                    total_events INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')

        conn.commit()
        print("✓ Database migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"✗ Migration error: {str(e)}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_database()
