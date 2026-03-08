from flask import Flask, request, jsonify, session, send_from_directory, redirect
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os
import random
import string
import json
from datetime import datetime
from ai import generate_questions, generate_questions_from_material, generate_tournament_round, generate_daily_challenge_questions, generate_power_clues, grade_student_question, generate_packet, analyze_question_autopsy, debate_respond, debate_score, generate_timeline_events
from ai_advanced import (
    generate_explanation, classify_cognitive_gap, get_adaptive_difficulty,
    update_leaderboard, check_and_award_badges,
    update_user_analytics, update_streak
)
from migrate_db import migrate_database
from ai_memory_graph import (
    process_question_for_graph, get_weak_concepts, get_strong_concepts,
    get_concepts_needing_review, get_knowledge_graph_data
)
from behavior_analysis import (
    analyze_learning_patterns, get_behavior_insights
)
from adaptive_difficulty import (
    calculate_adaptive_difficulty, get_smart_question_recommendation
)

app = Flask(__name__, static_folder='static')
CORS(app)

migrate_database()

if not os.environ.get('SESSION_SECRET'):
    raise ValueError("SESSION_SECRET environment variable is required for security. Please set it to a random secret key.")

app.secret_key = os.environ.get('SESSION_SECRET')

DB_NAME = 'scholar_bowl.db'

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    return send_from_directory('static', 'landing.html')

@app.route('/home')
def home():
    return send_from_directory('static', 'home.html')

@app.route('/topic-insights')
def topic_insights():
    return send_from_directory('static', 'topic-insights.html')

@app.route('/concept-map')
def concept_map():
    from flask import redirect
    return redirect('/topic-insights?tab=map')

@app.route('/competition')
def competition():
    return send_from_directory('static', 'competition.html')

@app.route('/daily-challenge')
def daily_challenge_page():
    return send_from_directory('static', 'daily-challenge.html')

@app.route('/questions')
def questions_page():
    return send_from_directory('static', 'questions.html')

@app.route('/missed-questions')
def missed_questions_page():
    return redirect('/history#review')

@app.route('/flashcards')
def flashcards_page():
    return send_from_directory('static', 'flashcards.html')

@app.route('/study-sets')
def study_sets_page():
    return send_from_directory('static', 'study-sets.html')

@app.route('/performance')
def performance_page():
    return redirect('/history#stats')

@app.route('/history')
def history_page():
    return send_from_directory('static', 'history.html')

@app.route('/power-training')
def power_training_page():
    return send_from_directory('static', 'power-training.html')

@app.route('/knowledge-decay')
def knowledge_decay_page():
    return send_from_directory('static', 'knowledge-decay.html')

@app.route('/challenges')
def challenges_page():
    return send_from_directory('static', 'challenges.html')

@app.route('/question-writer')
def question_writer_page():
    return send_from_directory('static', 'question-writer.html')

@app.route('/packet-generator')
def packet_generator_page():
    return send_from_directory('static', 'packet-generator.html')

@app.route('/question-autopsy')
def question_autopsy_page():
    return send_from_directory('static', 'question-autopsy.html')

@app.route('/debate-arena')
def debate_arena_page():
    return send_from_directory('static', 'debate-arena.html')

@app.route('/timeline-builder')
def timeline_builder_page():
    return send_from_directory('static', 'timeline-builder.html')

@app.route('/profile')
def profile_page():
    return send_from_directory('static', 'profile.html')

@app.route('/leaderboard')
def leaderboard_page():
    return send_from_directory('static', 'leaderboard.html')

@app.route('/achievements')
def achievements_page():
    return send_from_directory('static', 'achievements.html')

@app.route('/recommendations')
def recommendations_page():
    return send_from_directory('static', 'recommendations.html')

@app.route('/teacher-dashboard')
def teacher_dashboard_page():
    return send_from_directory('static', 'teacher-dashboard.html')

@app.route('/admin-analytics')
def admin_analytics_page():
    return send_from_directory('static', 'admin-analytics.html')

@app.route('/promo')
def promo_page():
    return send_from_directory('static', 'promo.html')

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'independent')
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    if role not in ['student', 'teacher', 'independent']:
        return jsonify({'error': 'Invalid role selected'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        hashed = generate_password_hash(password)
        is_teacher = 1 if role == 'teacher' else 0
        cursor.execute('INSERT INTO users (username, password, role, is_teacher, full_name, email) VALUES (?, ?, ?, ?, ?, ?)', 
                      (username, hashed, role, is_teacher, data.get('full_name'), data.get('email')))
        conn.commit()
        user_id = cursor.lastrowid
        session['user_id'] = user_id
        session['username'] = username
        session['role'] = role
        
        conn.close()
        return jsonify({'success': True, 'username': username, 'role': role}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Username already exists'}), 400

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT id, username, password, role FROM users WHERE username = ?', (username,))
    user = cursor.fetchone()
    conn.close()
    
    if user and check_password_hash(user['password'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = user['role'] if user['role'] else 'student'
        return jsonify({'success': True, 'username': user['username'], 'role': session['role']}), 200
    else:
        return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True}), 200

@app.route('/api/check-session', methods=['GET'])
def check_session():
    if 'user_id' in session:
        role = session.get('role', 'student')
        return jsonify({'logged_in': True, 'username': session.get('username'), 'role': role}), 200
    else:
        return jsonify({'logged_in': False}), 200

@app.route('/api/generate', methods=['POST'])
def generate():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    topic = data.get('topic')
    difficulty = data.get('difficulty')
    num_questions = data.get('num_questions', 1)
    subtopic = data.get('subtopic', '')
    
    if not topic or not difficulty:
        return jsonify({'error': 'Topic and difficulty required'}), 400
    
    if num_questions < 1 or num_questions > 10:
        return jsonify({'error': 'Number of questions must be between 1 and 10'}), 400
    
    try:
        user_id = session['user_id']
        
        questions = generate_questions(topic, difficulty, num_questions, user_id, subtopic)
        return jsonify({'success': True, 'questions': questions}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/check-answer', methods=['POST'])
def check_answer_fuzzy():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.json
    question_id = data.get('question_id')
    user_answer = data.get('user_answer', '').strip()

    if not question_id or not user_answer:
        return jsonify({'error': 'Question ID and answer required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT answer FROM questions WHERE id = ?', (question_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({'error': 'Question not found'}), 404

    correct_answer = row['answer']
    result = fuzzy_match_answer(user_answer, correct_answer)
    return jsonify(result), 200


def fuzzy_match_answer(user_answer, correct_answer):
    accepted = [a.strip() for a in correct_answer.replace(';', '/').split('/') if a.strip()]
    user_clean = normalize_answer(user_answer)

    if not user_clean:
        return {'correct': False, 'match_type': 'empty', 'correct_answer': correct_answer}

    for ans in accepted:
        ans_clean = normalize_answer(ans)
        if user_clean == ans_clean:
            return {'correct': True, 'match_type': 'exact', 'correct_answer': correct_answer}

    for ans in accepted:
        ans_clean = normalize_answer(ans)
        if len(ans_clean) < 2:
            continue
        dist = levenshtein_distance(user_clean, ans_clean)
        max_len = max(len(user_clean), len(ans_clean))
        similarity = 1 - (dist / max_len) if max_len > 0 else 0
        if similarity >= 0.65:
            return {'correct': True, 'match_type': 'close', 'correct_answer': correct_answer}

    for ans in accepted:
        ans_clean = normalize_answer(ans)
        ans_words = ans_clean.split()
        if len(ans_words) >= 2 and len(user_clean) >= 3:
            for word in ans_words:
                if len(word) >= 4:
                    dist = levenshtein_distance(user_clean, word)
                    word_len = max(len(user_clean), len(word))
                    if word_len > 0 and (1 - dist / word_len) >= 0.7:
                        return {'correct': True, 'match_type': 'partial', 'correct_answer': correct_answer}

    for ans in accepted:
        ans_clean = normalize_answer(ans)
        if len(user_clean) >= 3 and len(ans_clean) >= 3:
            if ans_clean in user_clean or user_clean in ans_clean:
                shorter = min(len(user_clean), len(ans_clean))
                longer = max(len(user_clean), len(ans_clean))
                if shorter / longer >= 0.5:
                    return {'correct': True, 'match_type': 'partial', 'correct_answer': correct_answer}

    for ans in accepted:
        ans_words = normalize_answer(ans).split()
        user_words = user_clean.split()
        if len(ans_words) >= 2 and len(user_words) >= 1:
            matched = 0
            for aw in ans_words:
                best = min((levenshtein_distance(aw, uw) for uw in user_words), default=999)
                aw_len = max(len(aw), 1)
                if best <= max(1, aw_len // 3):
                    matched += 1
            needed = max(1, len(ans_words) * 0.5)
            if matched >= needed:
                return {'correct': True, 'match_type': 'keyword', 'correct_answer': correct_answer}

    for ans in accepted:
        ans_clean = normalize_answer(ans)
        user_no_spaces = user_clean.replace(' ', '')
        ans_no_spaces = ans_clean.replace(' ', '')
        if len(ans_no_spaces) >= 3:
            dist = levenshtein_distance(user_no_spaces, ans_no_spaces)
            max_len = max(len(user_no_spaces), len(ans_no_spaces))
            if max_len > 0 and (1 - dist / max_len) >= 0.65:
                return {'correct': True, 'match_type': 'close', 'correct_answer': correct_answer}

    return {'correct': False, 'match_type': 'wrong', 'correct_answer': correct_answer}


def normalize_answer(text):
    import re
    text = text.lower().strip()
    text = re.sub(r'^(the|a|an)\s+', '', text)
    text = re.sub(r'[^\w\s]', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def levenshtein_distance(s1, s2):
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (0 if c1 == c2 else 1)))
        prev = curr
    return prev[-1]


@app.route('/api/submit-answer', methods=['POST'])
def submit_answer():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    question_id = data.get('question_id')
    correct = data.get('correct')
    
    if question_id is None or correct is None:
        return jsonify({'error': 'Question ID and correct status required'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        'INSERT INTO history (user_id, question_id, correct) VALUES (?, ?, ?)',
        (session['user_id'], question_id, correct)
    )
    conn.commit()
    conn.close()
    
    return jsonify({'success': True}), 200

@app.route('/api/history', methods=['GET'])
def history():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT h.id, h.correct, h.timestamp, q.question, q.answer, q.topic, q.difficulty, q.id as question_id
        FROM history h
        JOIN questions q ON h.question_id = q.id
        WHERE h.user_id = ?
        ORDER BY h.timestamp DESC
    ''', (session['user_id'],))
    
    rows = cursor.fetchall()
    
    history_data = []
    for row in rows:
        history_data.append({
            'id': row['id'],
            'question_id': row['question_id'],
            'question': row['question'],
            'answer': row['answer'],
            'topic': row['topic'],
            'difficulty': row['difficulty'],
            'correct': bool(row['correct']),
            'timestamp': row['timestamp']
        })
    
    total_questions = len(history_data)
    correct_count = sum(1 for h in history_data if h['correct'])
    accuracy = (correct_count / total_questions * 100) if total_questions > 0 else 0
    
    conn.close()
    
    return jsonify({
        'history': history_data,
        'stats': {
            'total': total_questions,
            'correct': correct_count,
            'accuracy': round(accuracy, 1)
        }
    }), 200

@app.route('/api/profile', methods=['GET'])
def get_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT username, full_name, email, grade, school, bio, language_preference
        FROM users
        WHERE id = ?
    ''', (session['user_id'],))
    
    user = cursor.fetchone()
    conn.close()
    
    if user:
        return jsonify({
            'profile': {
                'username': user['username'],
                'full_name': user['full_name'],
                'email': user['email'],
                'grade': user['grade'],
                'school': user['school'],
                'bio': user['bio'],
                'language_preference': user['language_preference']
            }
        }), 200
    else:
        return jsonify({'error': 'User not found'}), 404

@app.route('/api/profile', methods=['POST'])
def update_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    full_name = data.get('full_name', '')
    email = data.get('email', '')
    grade = data.get('grade', '')
    school = data.get('school', '')
    bio = data.get('bio', '')
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE users
        SET full_name = ?, email = ?, grade = ?, school = ?, bio = ?
        WHERE id = ?
    ''', (full_name, email, grade, school, bio, session['user_id']))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Profile updated successfully'}), 200

@app.route('/api/stats-by-topic', methods=['GET'])
def get_stats_by_topic():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT q.topic, q.difficulty, h.correct
        FROM history h
        JOIN questions q ON h.question_id = q.id
        WHERE h.user_id = ?
    ''', (session['user_id'],))
    
    rows = cursor.fetchall()
    conn.close()
    
    # Calculate statistics by topic and difficulty
    stats = {}
    for row in rows:
        topic = row['topic']
        difficulty = row['difficulty']
        correct = bool(row['correct'])
        
        if topic not in stats:
            stats[topic] = {
                'total': 0,
                'correct': 0,
                'by_difficulty': {
                    'Easy': {'total': 0, 'correct': 0},
                    'Medium': {'total': 0, 'correct': 0},
                    'Hard': {'total': 0, 'correct': 0}
                }
            }
        
        stats[topic]['total'] += 1
        if correct:
            stats[topic]['correct'] += 1
        
        if difficulty in stats[topic]['by_difficulty']:
            stats[topic]['by_difficulty'][difficulty]['total'] += 1
            if correct:
                stats[topic]['by_difficulty'][difficulty]['correct'] += 1
    
    # Calculate accuracy percentages
    for topic in stats:
        total = stats[topic]['total']
        stats[topic]['accuracy'] = round((stats[topic]['correct'] / total * 100), 1) if total > 0 else 0
        
        for difficulty in stats[topic]['by_difficulty']:
            diff_total = stats[topic]['by_difficulty'][difficulty]['total']
            if diff_total > 0:
                accuracy = (stats[topic]['by_difficulty'][difficulty]['correct'] / diff_total * 100)
                stats[topic]['by_difficulty'][difficulty]['accuracy'] = round(accuracy, 1)
            else:
                stats[topic]['by_difficulty'][difficulty]['accuracy'] = 0
    
    return jsonify({'stats': stats}), 200

@app.route('/api/explain', methods=['POST'])
def get_explanation():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    question = data.get('question')
    correct_answer = data.get('correct_answer')
    user_answer = data.get('user_answer', '')
    was_correct = data.get('was_correct', False)
    try:
        explanation = generate_explanation(question, correct_answer, user_answer, was_correct)
        return jsonify({'success': True, 'explanation': explanation}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/submit-answer-advanced', methods=['POST'])
def submit_answer_advanced():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    question_id = data.get('question_id')
    correct = data.get('correct')
    time_taken = data.get('time_taken', 0)
    
    if question_id is None or correct is None:
        return jsonify({'error': 'Question ID and correct status required'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT question, answer, topic FROM questions WHERE id = ?', (question_id,))
    question_data = cursor.fetchone()
    
    if not question_data:
        conn.close()
        return jsonify({'error': 'Question not found'}), 404
    
    question_text = question_data['question']
    correct_answer = question_data['answer']
    topic = question_data['topic']
    
    cognitive_type = classify_cognitive_gap(question_text, correct_answer, time_taken, correct)
    
    cursor.execute(
        'INSERT INTO history (user_id, question_id, correct, time_taken, cognitive_type) VALUES (?, ?, ?, ?, ?)',
        (session['user_id'], question_id, correct, time_taken, cognitive_type)
    )
    conn.commit()
    conn.close()
    
    update_user_analytics(session['user_id'], question_id, correct, time_taken, cognitive_type)
    update_leaderboard(session['user_id'])
    check_and_award_badges(session['user_id'])
    update_streak(session['user_id'])
    
    # Process question for AI Memory Graph
    try:
        process_question_for_graph(
            session['user_id'], question_id, question_text, 
            correct_answer, topic, correct, time_taken
        )
    except Exception as e:
        print(f"Error processing knowledge graph: {e}")
    
    return jsonify({'success': True, 'cognitive_type': cognitive_type}), 200

@app.route('/api/adaptive-difficulty', methods=['GET'])
def adaptive_difficulty():
    """Get adaptive difficulty recommendation based on user performance and behavior."""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    topic = request.args.get('topic', '')
    
    try:
        difficulty = calculate_adaptive_difficulty(session['user_id'], topic)
        return jsonify({'success': True, 'recommended_difficulty': difficulty}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/smart-recommendations', methods=['GET'])
def get_smart_recommendations():
    """Get comprehensive smart recommendations for next practice session."""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    try:
        recommendations = get_smart_question_recommendation(session['user_id'])
        return jsonify({
            'success': True,
            **recommendations
        }), 200
    except Exception as e:
        print(f"Error getting smart recommendations: {str(e)}")
        return jsonify({'error': 'Failed to get recommendations'}), 500

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    leaderboard_type = request.args.get('type', 'global')
    school = request.args.get('school', '')
    
    conn = get_db()
    cursor = conn.cursor()
    
    if leaderboard_type == 'school' and school:
        cursor.execute('''
            SELECT u.username, u.school, l.total_points, l.total_correct, l.total_questions, l.accuracy_rate, l.school_rank
            FROM leaderboard l
            JOIN users u ON l.user_id = u.id
            WHERE u.school = ?
            ORDER BY l.total_points DESC, l.accuracy_rate DESC
            LIMIT 100
        ''', (school,))
    else:
        cursor.execute('''
            SELECT u.username, u.school, l.total_points, l.total_correct, l.total_questions, l.accuracy_rate, l.global_rank
            FROM leaderboard l
            JOIN users u ON l.user_id = u.id
            ORDER BY l.total_points DESC, l.accuracy_rate DESC
            LIMIT 100
        ''')
    
    rows = cursor.fetchall()
    col_names = [desc[0] for desc in cursor.description] if cursor.description else []
    conn.close()
    
    leaderboard_data = []
    for row in rows:
        rank_val = None
        if 'global_rank' in col_names:
            rank_val = row['global_rank']
        elif 'school_rank' in col_names:
            rank_val = row['school_rank']
        leaderboard_data.append({
            'username': row['username'],
            'school': row['school'],
            'points': row['total_points'],
            'correct': row['total_correct'],
            'total': row['total_questions'],
            'accuracy': row['accuracy_rate'],
            'rank': rank_val
        })
    
    return jsonify({'leaderboard': leaderboard_data}), 200

@app.route('/api/badges', methods=['GET'])
def get_badges():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT badge_name, badge_description, badge_icon, earned_at
        FROM badges
        WHERE user_id = ?
        ORDER BY earned_at DESC
    ''', (session['user_id'],))
    
    rows = cursor.fetchall()
    conn.close()
    
    badges = []
    for row in rows:
        badges.append({
            'name': row['badge_name'],
            'description': row['badge_description'],
            'icon': row['badge_icon'],
            'earned_at': row['earned_at']
        })
    
    return jsonify({'badges': badges}), 200

@app.route('/api/gamification-stats', methods=['GET'])
def get_gamification_stats():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT scholar_league_points, current_level, current_streak, longest_streak
        FROM users
        WHERE id = ?
    ''', (session['user_id'],))
    
    user_data = cursor.fetchone()
    conn.close()
    
    return jsonify({
        'stats': {
            'points': user_data['scholar_league_points'] if user_data else 0,
            'level': user_data['current_level'] if user_data else 1,
            'current_streak': user_data['current_streak'] if user_data else 0,
            'longest_streak': user_data['longest_streak'] if user_data else 0
        }
    }), 200

@app.route('/api/user-stats', methods=['GET'])
def get_user_stats():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT scholar_league_points, current_level, current_streak, longest_streak
        FROM users
        WHERE id = ?
    ''', (session['user_id'],))
    
    user_data = cursor.fetchone()
    
    cursor.execute('''
        SELECT topic, difficulty, total_questions, correct_questions,
               recall_gap_count, inference_gap_count, comprehension_gap_count, avg_speed
        FROM user_analytics
        WHERE user_id = ?
    ''', (session['user_id'],))
    
    analytics_rows = cursor.fetchall()
    conn.close()
    
    analytics = []
    for row in analytics_rows:
        analytics.append({
            'topic': row['topic'],
            'difficulty': row['difficulty'],
            'total': row['total_questions'],
            'correct': row['correct_questions'],
            'recall_gaps': row['recall_gap_count'],
            'inference_gaps': row['inference_gap_count'],
            'comprehension_gaps': row['comprehension_gap_count'],
            'avg_speed': row['avg_speed']
        })
    
    return jsonify({
        'points': user_data['scholar_league_points'] if user_data else 0,
        'level': user_data['current_level'] if user_data else 1,
        'current_streak': user_data['current_streak'] if user_data else 0,
        'longest_streak': user_data['longest_streak'] if user_data else 0,
        'analytics': analytics
    }), 200

@app.route('/api/create-classroom', methods=['POST'])
def create_classroom():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    classroom_name = data.get('classroom_name')
    
    if not classroom_name:
        return jsonify({'error': 'Classroom name required'}), 400
    
    classroom_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('UPDATE users SET is_teacher = 1 WHERE id = ?', (session['user_id'],))
    
    cursor.execute(
        'INSERT INTO classrooms (teacher_id, classroom_name, classroom_code) VALUES (?, ?, ?)',
        (session['user_id'], classroom_name, classroom_code)
    )
    
    conn.commit()
    classroom_id = cursor.lastrowid
    conn.close()
    
    return jsonify({'success': True, 'classroom_id': classroom_id, 'classroom_code': classroom_code}), 201

@app.route('/api/my-classrooms', methods=['GET'])
def get_my_classrooms():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT c.id, c.classroom_name, c.classroom_code, u.username as teacher_name
        FROM classroom_members cs
        JOIN classrooms c ON cs.classroom_id = c.id
        JOIN users u ON c.teacher_id = u.id
        WHERE cs.user_id = ?
    ''', (session['user_id'],))
    
    rows = cursor.fetchall()
    conn.close()
    
    classrooms = []
    for row in rows:
        classrooms.append({
            'id': row['id'],
            'classroom_name': row['classroom_name'],
            'classroom_code': row['classroom_code'],
            'teacher_name': row['teacher_name']
        })
    
    return jsonify({'classrooms': classrooms}), 200

@app.route('/api/classrooms', methods=['GET'])
def get_classrooms():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT c.id, c.classroom_name, c.classroom_code, u.username as teacher_name
        FROM classroom_members cs
        JOIN classrooms c ON cs.classroom_id = c.id
        JOIN users u ON c.teacher_id = u.id
        WHERE cs.user_id = ?
    ''', (session['user_id'],))
    
    rows = cursor.fetchall()
    conn.close()
    
    classrooms = []
    for row in rows:
        classrooms.append({
            'id': row['id'],
            'name': row['classroom_name'],
            'code': row['classroom_code'],
            'teacher': row['teacher_name']
        })
    
    return jsonify({'classrooms': classrooms}), 200

@app.route('/api/teacher-classrooms', methods=['GET'])
def get_teacher_classrooms():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT c.id, c.classroom_name, c.classroom_code,
               (SELECT COUNT(*) FROM classroom_members WHERE classroom_id = c.id) as student_count
        FROM classrooms c
        WHERE c.teacher_id = ?
        ORDER BY c.created_at DESC
    ''', (session['user_id'],))
    
    rows = cursor.fetchall()
    conn.close()
    
    classrooms = []
    for row in rows:
        classrooms.append({
            'id': row['id'],
            'name': row['classroom_name'],
            'code': row['classroom_code'],
            'student_count': row['student_count']
        })
    
    return jsonify({'classrooms': classrooms}), 200

@app.route('/api/classroom-students/<int:classroom_id>', methods=['GET'])
def get_classroom_members(classroom_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT id FROM classrooms WHERE id = ? AND teacher_id = ?', 
                   (classroom_id, session['user_id']))
    classroom = cursor.fetchone()
    
    if not classroom:
        conn.close()
        return jsonify({'error': 'Classroom not found or access denied'}), 404
    
    cursor.execute('''
        SELECT u.id, u.username, u.full_name, u.email, u.school, u.grade, u.bio,
               COALESCE((SELECT COUNT(*) FROM history WHERE user_id = u.id), 0) as total_questions,
               COALESCE((SELECT SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) FROM history WHERE user_id = u.id), 0) as correct_answers,
               (SELECT MAX(timestamp) FROM history WHERE user_id = u.id) as last_active
        FROM classroom_members cs
        JOIN users u ON cs.user_id = u.id
        WHERE cs.classroom_id = ?
        ORDER BY u.username
    ''', (classroom_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    students = []
    for row in rows:
        total = row['total_questions']
        correct = row['correct_answers']
        accuracy = round((correct / total * 100) if total > 0 else 0, 1)
        
        last_active = row['last_active']
        if last_active and len(str(last_active)) >= 10:
            last_active = str(last_active)[:10]
        
        students.append({
            'id': row['id'],
            'username': row['username'],
            'full_name': row['full_name'],
            'email': row['email'],
            'school': row['school'],
            'grade': row['grade'],
            'bio': row['bio'],
            'total_questions': total,
            'correct_answers': correct,
            'accuracy': accuracy,
            'last_active': last_active
        })
    
    return jsonify({'success': True, 'students': students}), 200

@app.route('/api/join-classroom', methods=['POST'])
def join_classroom():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    code = (data.get('code') or '').strip().upper()
    
    if not code or len(code) != 6:
        return jsonify({'error': 'Please enter a valid 6-character class code'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT id, classroom_name, teacher_id FROM classrooms WHERE classroom_code = ?', (code,))
    classroom = cursor.fetchone()
    
    if not classroom:
        conn.close()
        return jsonify({'error': 'No class found with that code'}), 404
    
    if classroom['teacher_id'] == session['user_id']:
        conn.close()
        return jsonify({'error': 'You cannot join your own class'}), 400
    
    cursor.execute('SELECT id FROM classroom_members WHERE classroom_id = ? AND user_id = ?',
                   (classroom['id'], session['user_id']))
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': 'You are already in this class'}), 400
    
    cursor.execute('INSERT INTO classroom_members (classroom_id, user_id) VALUES (?, ?)',
                   (classroom['id'], session['user_id']))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'classroom_name': classroom['classroom_name']}), 200

@app.route('/api/leave-classroom/<int:classroom_id>', methods=['POST'])
def leave_classroom(classroom_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM classroom_members WHERE classroom_id = ? AND user_id = ?',
                   (classroom_id, session['user_id']))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'You are not a member of this class'}), 404
    
    cursor.execute('DELETE FROM classroom_members WHERE classroom_id = ? AND user_id = ?',
                   (classroom_id, session['user_id']))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True}), 200

@app.route('/api/class-posts/<int:classroom_id>', methods=['GET'])
def get_class_posts(classroom_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT cm.id FROM classroom_members cm WHERE cm.classroom_id = ? AND cm.user_id = ?
        UNION
        SELECT c.id FROM classrooms c WHERE c.id = ? AND c.teacher_id = ?
    ''', (classroom_id, session['user_id'], classroom_id, session['user_id']))
    
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Access denied'}), 403
    
    cursor.execute('''
        SELECT p.id, p.title, p.content, p.post_type, p.created_at, u.username as teacher_name
        FROM class_posts p
        JOIN users u ON p.teacher_id = u.id
        WHERE p.classroom_id = ?
        ORDER BY p.created_at DESC
    ''', (classroom_id,))
    
    posts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify({'success': True, 'posts': posts}), 200

@app.route('/api/class-posts/<int:classroom_id>', methods=['POST'])
def create_class_post(classroom_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT id FROM classrooms WHERE id = ? AND teacher_id = ?',
                   (classroom_id, session['user_id']))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Only the class teacher can create posts'}), 403
    
    data = request.json
    title = (data.get('title') or '').strip()
    content = (data.get('content') or '').strip()
    post_type = data.get('post_type', 'announcement')
    
    if post_type not in ('announcement', 'assignment', 'resource'):
        post_type = 'announcement'
    
    if not title or not content:
        conn.close()
        return jsonify({'error': 'Title and content are required'}), 400
    
    if len(title) > 200:
        conn.close()
        return jsonify({'error': 'Title must be under 200 characters'}), 400
    
    cursor.execute(
        'INSERT INTO class_posts (classroom_id, teacher_id, title, content, post_type) VALUES (?, ?, ?, ?, ?)',
        (classroom_id, session['user_id'], title, content, post_type)
    )
    conn.commit()
    post_id = cursor.lastrowid
    conn.close()
    
    return jsonify({'success': True, 'post_id': post_id}), 201

@app.route('/api/class-posts/delete/<int:post_id>', methods=['POST'])
def delete_class_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT id FROM class_posts WHERE id = ? AND teacher_id = ?',
                   (post_id, session['user_id']))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Post not found or access denied'}), 404
    
    cursor.execute('DELETE FROM class_posts WHERE id = ?', (post_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True}), 200

@app.route('/api/rate-question', methods=['POST'])
def rate_question():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    question_id = data.get('question_id')
    rating = data.get('rating')
    feedback_type = data.get('feedback_type', '')
    feedback_comment = data.get('feedback_comment', '')
    
    if not question_id or not rating:
        return jsonify({'error': 'Question ID and rating required'}), 400
    
    if rating < 1 or rating > 5:
        return jsonify({'error': 'Rating must be between 1 and 5'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        'INSERT INTO question_feedback (question_id, user_id, rating, feedback_type, feedback_comment) VALUES (?, ?, ?, ?, ?)',
        (question_id, session['user_id'], rating, feedback_type, feedback_comment)
    )
    
    cursor.execute('''
        UPDATE questions
        SET avg_rating = (
            SELECT AVG(rating) FROM question_feedback WHERE question_id = ?
        ),
        total_ratings = total_ratings + 1
        WHERE id = ?
    ''', (question_id, question_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Rating submitted successfully'}), 200

@app.route('/api/get-recommendations', methods=['POST'])
def get_recommendations():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    subject = data.get('subject', '')
    goal = data.get('goal', '')
    
    if not subject or not goal:
        return jsonify({'error': 'Subject and goal required'}), 400
    
    try:
        import os
        import requests
        import json
        
        api_key = os.environ.get('TOGETHER_API_KEY')
        api_url = os.environ.get('TOGETHER_URL', 'https://api.together.xyz/v1/chat/completions')
        model = os.environ.get('MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')
        
        if not api_key:
            return jsonify({'error': 'API key not configured'}), 500
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT h.correct, q.topic, q.difficulty, h.timestamp
            FROM history h
            JOIN questions q ON h.question_id = q.id
            WHERE h.user_id = ?
            ORDER BY h.timestamp DESC
            LIMIT 50
        ''', (session['user_id'],))
        
        history = cursor.fetchall()
        conn.close()
        
        # Get comprehensive behavior analysis
        behavior_insights = get_behavior_insights(session['user_id'])
        behavior_patterns = analyze_learning_patterns(session['user_id'])
        
        # Get concept mastery data
        weak_concepts = get_weak_concepts(session['user_id'], limit=5)
        strong_concepts = get_strong_concepts(session['user_id'], limit=3)
        needs_review = get_concepts_needing_review(session['user_id'], limit=5)
        
        performance_summary = ""
        if history:
            total = len(history)
            correct = sum(1 for h in history if h['correct'])
            accuracy = (correct / total * 100) if total > 0 else 0
            
            topics = {}
            for h in history:
                topic = h['topic']
                if topic not in topics:
                    topics[topic] = {'correct': 0, 'total': 0}
                topics[topic]['total'] += 1
                if h['correct']:
                    topics[topic]['correct'] += 1
            
            performance_summary = f"\n\n=== PERFORMANCE DATA ===\n"
            performance_summary += f"Overall Accuracy: {accuracy:.1f}% ({correct}/{total} questions)\n\n"
            performance_summary += "Performance by Topic:\n"
            for topic, stats in topics.items():
                topic_acc = (stats['correct'] / stats['total'] * 100) if stats['total'] > 0 else 0
                performance_summary += f"  * {topic}: {topic_acc:.1f}% ({stats['correct']}/{stats['total']})\n"
            
            # Add behavior insights
            if behavior_patterns.get('status') != 'insufficient_data':
                performance_summary += f"\n=== BEHAVIOR ANALYSIS ===\n"
                performance_summary += f"Learning Velocity: {behavior_patterns.get('learning_velocity', 0)}% improvement per week\n"
                performance_summary += f"Accuracy Trend: {behavior_patterns.get('accuracy_trend', 'unknown')}\n"
                performance_summary += f"Speed Trend: {behavior_patterns.get('speed_trend', 'unknown')}\n"
                performance_summary += f"Peak Performance Time: {behavior_patterns.get('peak_performance_time', 'unknown')}\n"
                performance_summary += f"Primary Cognitive Gap: {behavior_patterns.get('primary_weakness', 'none')}\n"
                performance_summary += f"Practice Frequency: {behavior_patterns.get('questions_per_day', 0)} questions/day\n"
            
            # Add concept mastery insights
            if weak_concepts:
                performance_summary += f"\n=== WEAK CONCEPTS (Need Focus) ===\n"
                for concept in weak_concepts:
                    performance_summary += f"  * {concept['concept_name']}: {concept['accuracy_rate']:.1f}% accuracy ({concept['mastery_level']})\n"
            
            if strong_concepts:
                performance_summary += f"\n=== STRONG CONCEPTS (Mastered) ===\n"
                for concept in strong_concepts:
                    performance_summary += f"  * {concept['concept_name']}: {concept['accuracy_rate']:.1f}% accuracy ({concept['mastery_level']})\n"
            
            if needs_review:
                performance_summary += f"\n=== CONCEPTS NEEDING REVIEW (Spaced Repetition) ===\n"
                for concept in needs_review:
                    performance_summary += f"  * {concept['concept_name']} ({concept['mastery_level']})\n"
        
        system_prompt = f"""You are an expert AI study coach specializing in personalized learning plans for Quiz Bowl and academic competitions. You analyze user behavior patterns, concept mastery, and learning velocity to create highly accurate, data-driven study recommendations.

IMPORTANT: Use the detailed performance data, behavior analysis, and concept mastery information below to create a truly personalized study plan. Reference specific weak concepts, learning patterns, and behavioral trends in your recommendations.

Based on the user's information below, create a comprehensive, personalized study plan.

Subject: {subject}
Goal: {goal}{performance_summary}

Provide a detailed study plan that includes:

1. **Assessment of Current Level**: Analyze their behavior patterns (learning velocity, accuracy/speed trends, peak performance time) and concept mastery data. Reference specific weak concepts they need to work on.

2. **Personalized Study Path**: Create a learning roadmap that addresses their specific weak concepts and cognitive gaps. Prioritize concepts needing review based on spaced repetition data.

3. **Behavioral Optimization**: Suggest practice times based on their peak performance time. Adjust difficulty recommendations based on their difficulty preference and current trends.

4. **Practice Strategy**: Recommend specific question types and difficulty levels based on their accuracy trend and learning velocity. Address their primary cognitive gap (recall/inference/comprehension).

5. **Time Management**: Provide a schedule considering their practice frequency and learning velocity. Set realistic timelines based on their improvement rate.

6. **Success Metrics**: Define milestones using their current metrics (accuracy rate, learning velocity, concept mastery levels) as baselines.

7. **Motivational Tips**: Provide encouragement tailored to their specific trends (improving/stable/declining) and celebrate their strong concepts.

Format your response in a clear, organized manner with headers and bullet points. Be SPECIFIC - reference actual concepts, trends, and metrics from the data. Make it highly personalized and actionable."""
        
        user_prompt = f"Create a personalized study plan for a student who wants to study {subject} with the goal: {goal}"
        
        response = requests.post(
            api_url,
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': model,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt}
                ],
                'temperature': 0.7,
                'max_tokens': 1500
            },
            timeout=30
        )
        
        if response.status_code != 200:
            return jsonify({'error': f'AI API error: {response.status_code}'}), 500
        
        result = response.json()
        recommendations = result['choices'][0]['message']['content']
        
        return jsonify({
            'success': True,
            'recommendations': recommendations
        }), 200
        
    except Exception as e:
        print(f"Error generating recommendations: {str(e)}")
        return jsonify({'error': 'Failed to generate recommendations'}), 500

@app.route('/api/coach-chat', methods=['POST'])
def coach_chat():
    """ChatGPT-style AI coach that answers questions about user performance."""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    question = data.get('question', '')
    chat_history = data.get('chat_history', [])
    
    if not question:
        return jsonify({'error': 'Question required'}), 400
    
    try:
        import os
        import requests
        
        api_key = os.environ.get('TOGETHER_API_KEY')
        api_url = os.environ.get('TOGETHER_URL', 'https://api.together.xyz/v1/chat/completions')
        model = os.environ.get('MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')
        
        if not api_key:
            return jsonify({'error': 'API key not configured'}), 500
        
        # Get comprehensive user performance data
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT h.correct, q.topic, q.difficulty, h.time_taken, h.timestamp
            FROM history h
            JOIN questions q ON h.question_id = q.id
            WHERE h.user_id = ?
            ORDER BY h.timestamp DESC
            LIMIT 100
        ''', (session['user_id'],))
        
        history = cursor.fetchall()
        conn.close()
        
        # Get behavior analysis
        behavior_insights = get_behavior_insights(session['user_id'])
        behavior_patterns = analyze_learning_patterns(session['user_id'])
        
        # Get concept mastery data
        weak_concepts = get_weak_concepts(session['user_id'], limit=10)
        strong_concepts = get_strong_concepts(session['user_id'], limit=5)
        needs_review = get_concepts_needing_review(session['user_id'], limit=10)
        
        # Build comprehensive performance context
        performance_context = ""
        
        if history:
            total = len(history)
            correct = sum(1 for h in history if h['correct'])
            accuracy = (correct / total * 100) if total > 0 else 0
            
            performance_context += f"OVERALL PERFORMANCE:\n"
            performance_context += f"- Total questions answered: {total}\n"
            performance_context += f"- Overall accuracy: {accuracy:.1f}%\n"
            
            # Topic breakdown
            topic_stats = {}
            for h in history:
                topic = h['topic']
                if topic not in topic_stats:
                    topic_stats[topic] = {'total': 0, 'correct': 0}
                topic_stats[topic]['total'] += 1
                if h['correct']:
                    topic_stats[topic]['correct'] += 1
            
            performance_context += f"\nTOPIC BREAKDOWN:\n"
            for topic, stats in sorted(topic_stats.items(), key=lambda x: x[1]['total'], reverse=True)[:5]:
                topic_acc = (stats['correct'] / stats['total'] * 100) if stats['total'] > 0 else 0
                performance_context += f"  - {topic}: {topic_acc:.1f}% ({stats['correct']}/{stats['total']})\n"
        
        # Add behavior patterns
        if behavior_patterns and behavior_patterns.get('status') != 'insufficient_data':
            performance_context += f"\nBEHAVIOR ANALYSIS:\n"
            performance_context += f"- Learning velocity: {behavior_patterns.get('learning_velocity', 0):.1f}% improvement per week\n"
            performance_context += f"- Accuracy trend: {behavior_patterns.get('accuracy_trend', 'unknown')}\n"
            performance_context += f"- Speed trend: {behavior_patterns.get('speed_trend', 'unknown')}\n"
            performance_context += f"- Peak performance time: {behavior_patterns.get('peak_performance_time', 'unknown')}\n"
            performance_context += f"- Primary weakness: {behavior_patterns.get('primary_weakness', 'none')}\n"
            performance_context += f"- Practice frequency: {behavior_patterns.get('questions_per_day', 0):.1f} questions/day\n"
        
        # Add concept mastery
        if weak_concepts:
            performance_context += f"\nWEAK CONCEPTS (need practice):\n"
            for concept in weak_concepts[:5]:
                performance_context += f"  - {concept['concept_name']}: {concept['accuracy_rate']:.1f}% accuracy, {concept['mastery_level']} level\n"
        
        if strong_concepts:
            performance_context += f"\nSTRONG CONCEPTS (mastered):\n"
            for concept in strong_concepts[:3]:
                performance_context += f"  - {concept['concept_name']}: {concept['accuracy_rate']:.1f}% accuracy, {concept['mastery_level']} level\n"
        
        if needs_review:
            performance_context += f"\nCONCEPTS NEEDING REVIEW (spaced repetition):\n"
            for concept in needs_review[:5]:
                performance_context += f"  - {concept['concept_name']} ({concept['mastery_level']} level)\n"
        
        # Build system prompt
        system_prompt = f"""You are an expert AI Study Coach for Quiz Bowl students. You have access to the user's complete performance data, behavior patterns, and concept mastery levels. Answer their questions about their performance with specific, data-driven insights.

USER PERFORMANCE DATA:
{performance_context}

Guidelines:
- Be conversational and supportive
- Reference SPECIFIC concepts, topics, and metrics from the data
- Provide actionable advice based on their actual performance
- If they ask about weak areas, mention the specific concepts they struggle with
- If they ask about progress, reference their learning velocity and trends
- If they ask what to study, use their weak concepts and spaced repetition data
- If they ask when to practice, mention their peak performance time
- Keep responses concise (2-4 paragraphs) unless they ask for detailed analysis
- Use bullet points for lists
- Be encouraging but honest about areas needing improvement"""
        
        # Build messages array with chat history
        messages = [{'role': 'system', 'content': system_prompt}]
        
        # Add last few messages from chat history for context
        for msg in chat_history[-6:]:  # Last 6 messages (3 exchanges)
            if msg['role'] in ['user', 'assistant']:
                messages.append({
                    'role': msg['role'],
                    'content': msg['content']
                })
        
        # Add current question
        messages.append({'role': 'user', 'content': question})
        
        # Call AI API
        response = requests.post(
            api_url,
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': model,
                'messages': messages,
                'temperature': 0.7,
                'max_tokens': 800
            },
            timeout=30
        )
        
        if response.status_code != 200:
            return jsonify({'error': f'AI API error: {response.status_code}'}), 500
        
        result = response.json()
        answer = result['choices'][0]['message']['content']
        
        return jsonify({
            'success': True,
            'answer': answer
        }), 200
        
    except Exception as e:
        print(f"Error in coach chat: {str(e)}")
        return jsonify({'error': 'Failed to process question'}), 500

@app.route('/api/knowledge-graph', methods=['GET'])
def get_knowledge_graph():
    """Get user's knowledge graph data for visualization."""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    try:
        graph_data = get_knowledge_graph_data(session['user_id'])
        return jsonify({
            'success': True,
            'graph': graph_data
        }), 200
    except Exception as e:
        print(f"Error getting knowledge graph: {str(e)}")
        return jsonify({'error': 'Failed to get knowledge graph'}), 500

@app.route('/api/concept-mastery', methods=['GET'])
def get_concept_mastery_data():
    """Get user's concept mastery summary."""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    try:
        weak = get_weak_concepts(session['user_id'], limit=10)
        strong = get_strong_concepts(session['user_id'], limit=10)
        review = get_concepts_needing_review(session['user_id'], limit=10)
        
        return jsonify({
            'success': True,
            'weak_concepts': weak,
            'strong_concepts': strong,
            'needs_review': review
        }), 200
    except Exception as e:
        print(f"Error getting concept mastery: {str(e)}")
        return jsonify({'error': 'Failed to get concept mastery'}), 500

@app.route('/api/behavior-analysis', methods=['GET'])
def get_user_behavior_analysis():
    """Get comprehensive behavior analysis for the user."""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    try:
        analysis = analyze_learning_patterns(session['user_id'])
        insights = get_behavior_insights(session['user_id'])
        
        return jsonify({
            'success': True,
            'analysis': analysis,
            'insights': insights
        }), 200
    except Exception as e:
        print(f"Error getting behavior analysis: {str(e)}")
        return jsonify({'error': 'Failed to get behavior analysis'}), 500

@app.route('/api/competition-predictor', methods=['GET'])
def predict_competition_readiness():
    """Predict user's competition readiness and provide recommendations."""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    try:
        analysis = analyze_learning_patterns(session['user_id'])
        
        if analysis.get('status') == 'insufficient_data':
            return jsonify({
                'success': False,
                'message': 'Need more practice data to predict competition readiness'
            }), 200
        
        # Calculate readiness score (0-100)
        accuracy_score = min(analysis['overall_accuracy'], 100) * 0.4
        velocity_score = min(max(analysis['learning_velocity'] * 5, 0), 40)
        consistency_score = min(analysis['questions_per_day'] * 5, 20)
        readiness_score = accuracy_score + velocity_score + consistency_score
        
        # Calculate win probability based on readiness and trends
        base_probability = (readiness_score / 100) * 70
        if analysis['accuracy_trend'] == 'improving':
            win_probability = min(base_probability + 15, 95)
        elif analysis['accuracy_trend'] == 'declining':
            win_probability = max(base_probability - 15, 5)
        else:
            win_probability = base_probability
        
        # Get weak and strong topics
        weak = get_weak_concepts(session['user_id'], limit=5)
        strong = get_strong_concepts(session['user_id'], limit=5)
        
        weak_topics = [c['concept_name'] for c in weak]
        strong_topics = [c['concept_name'] for c in strong]
        
        # Generate focus areas
        focus_areas = []
        if weak_topics:
            focus_areas.append(f"Master weak concepts: {', '.join(weak_topics[:3])}")
        if analysis.get('primary_weakness') and analysis['primary_weakness'] != 'none':
            focus_areas.append(f"Improve {analysis['primary_weakness'].replace('_', ' ')}")
        if analysis['questions_per_day'] < 5:
            focus_areas.append("Increase practice frequency to 5+ questions/day")
        
        # Recommended practice
        recommended_practice = []
        if analysis['overall_accuracy'] < 70:
            recommended_practice.append("Focus on easy/medium difficulty to build confidence")
        elif analysis['overall_accuracy'] > 85:
            recommended_practice.append("Challenge yourself with hard difficulty questions")
        else:
            recommended_practice.append("Mix of medium and hard difficulty for balanced growth")
        
        if analysis.get('peak_performance_time') and analysis['peak_performance_time'] != 'unknown':
            recommended_practice.append(f"Practice during your peak time: {analysis['peak_performance_time']}")
        
        # Save prediction
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO competition_predictions
            (user_id, win_probability, readiness_score, focus_areas, weak_topics, strong_topics, recommended_practice)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (session['user_id'], win_probability, readiness_score, 
              '; '.join(focus_areas), ', '.join(weak_topics), ', '.join(strong_topics),
              '; '.join(recommended_practice)))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'win_probability': round(win_probability, 1),
            'readiness_score': round(readiness_score, 1),
            'focus_areas': focus_areas,
            'weak_topics': weak_topics,
            'strong_topics': strong_topics,
            'recommended_practice': recommended_practice,
            'overall_accuracy': analysis['overall_accuracy'],
            'learning_velocity': analysis['learning_velocity'],
            'accuracy_trend': analysis['accuracy_trend']
        }), 200
        
    except Exception as e:
        print(f"Error predicting competition readiness: {str(e)}")
        return jsonify({'error': 'Failed to predict competition readiness'}), 500

@app.route('/api/topic-insights', methods=['GET'])
def get_topic_insights():
    """AI-Powered Topic Insights: Detect patterns in incorrect answers."""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Analyze incorrect answers by topic
        cursor.execute('''
            SELECT q.topic, q.difficulty, q.question, q.answer
            FROM history h
            JOIN questions q ON h.question_id = q.id
            WHERE h.user_id = ? AND h.correct = 0
            ORDER BY h.timestamp DESC
            LIMIT 50
        ''', (session['user_id'],))
        
        incorrect_answers = cursor.fetchall()
        conn.close()
        
        if not incorrect_answers:
            return jsonify({
                'success': True,
                'insights': [],
                'message': 'No incorrect answers to analyze yet. Keep practicing!'
            }), 200
        
        # Group by topic and detect patterns
        topic_patterns = {}
        for answer in incorrect_answers:
            topic = answer['topic']
            if topic not in topic_patterns:
                topic_patterns[topic] = {
                    'count': 0,
                    'difficulty_breakdown': {'Easy': 0, 'Medium': 0, 'Hard': 0},
                    'sample_mistakes': []
                }
            
            topic_patterns[topic]['count'] += 1
            topic_patterns[topic]['difficulty_breakdown'][answer['difficulty']] += 1
            
            if len(topic_patterns[topic]['sample_mistakes']) < 3:
                topic_patterns[topic]['sample_mistakes'].append({
                    'question': answer['question'][:100] + '...',
                    'correct_answer': answer['answer'],
                    'user_answer': 'Incorrect'
                })
        
        # Format insights
        insights = []
        for topic, data in sorted(topic_patterns.items(), key=lambda x: x[1]['count'], reverse=True):
            most_difficult = max(data['difficulty_breakdown'].items(), key=lambda x: x[1])[0]
            insights.append({
                'topic': topic,
                'mistake_count': data['count'],
                'most_difficult_level': most_difficult,
                'difficulty_breakdown': data['difficulty_breakdown'],
                'sample_mistakes': data['sample_mistakes'],
                'insight': f"You've struggled with {data['count']} {topic} questions, especially at {most_difficult} difficulty."
            })
        
        return jsonify({
            'success': True,
            'insights': insights[:10],
            'total_topics_analyzed': len(insights)
        }), 200
        
    except Exception as e:
        print(f"Error getting topic insights: {str(e)}")
        return jsonify({'error': 'Failed to get topic insights'}), 500

@app.route('/api/concept-map', methods=['GET'])
def get_concept_map():
    """Interactive Concept Map: Auto-builds knowledge graph from user's practice history."""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        user_id = session['user_id']
        
        cursor.execute('''
            SELECT q.topic, q.difficulty,
                   COUNT(*) as total,
                   SUM(CASE WHEN h.correct = 1 THEN 1 ELSE 0 END) as correct
            FROM history h
            JOIN questions q ON h.question_id = q.id
            WHERE h.user_id = ?
            GROUP BY q.topic
            ORDER BY COUNT(*) DESC
        ''', (user_id,))
        
        topics = cursor.fetchall()
        
        if not topics:
            conn.close()
            return jsonify({
                'success': True,
                'nodes': [],
                'edges': [],
                'stats': {'total_concepts': 0, 'mastered': 0, 'learning': 0, 'beginner': 0, 'not_started': 0}
            }), 200
        
        category_map = {
            'history': 'Social Studies', 'american history': 'Social Studies', 'world history': 'Social Studies',
            'geography': 'Social Studies', 'government': 'Social Studies', 'economics': 'Social Studies',
            'civics': 'Social Studies', 'politics': 'Social Studies',
            'biology': 'Science', 'chemistry': 'Science', 'physics': 'Science', 'earth science': 'Science',
            'anatomy': 'Science', 'astronomy': 'Science', 'ecology': 'Science', 'genetics': 'Science',
            'literature': 'Language Arts', 'grammar': 'Language Arts', 'writing': 'Language Arts',
            'poetry': 'Language Arts', 'shakespeare': 'Language Arts', 'vocabulary': 'Language Arts',
            'algebra': 'Mathematics', 'geometry': 'Mathematics', 'calculus': 'Mathematics',
            'statistics': 'Mathematics', 'math': 'Mathematics', 'trigonometry': 'Mathematics',
            'art': 'Fine Arts', 'music': 'Fine Arts', 'theater': 'Fine Arts', 'dance': 'Fine Arts',
            'painting': 'Fine Arts', 'sculpture': 'Fine Arts',
            'spanish': 'World Languages', 'french': 'World Languages', 'german': 'World Languages',
            'latin': 'World Languages', 'chinese': 'World Languages', 'japanese': 'World Languages',
            'computer science': 'Technology', 'programming': 'Technology', 'technology': 'Technology',
        }
        
        def get_category(topic_name):
            lower = topic_name.lower().strip()
            for key, cat in category_map.items():
                if key in lower:
                    return cat
            return 'General Knowledge'
        
        nodes = []
        node_ids = {}
        
        for i, topic in enumerate(topics):
            total = topic['total']
            correct = topic['correct'] or 0
            mastery = round((correct / total * 100) if total > 0 else 0, 1)
            
            if mastery >= 80:
                status = 'mastered'
            elif mastery >= 50:
                status = 'learning'
            elif mastery > 0:
                status = 'beginner'
            else:
                status = 'not_started'
            
            node_id = i + 1
            node_ids[topic['topic']] = node_id
            
            nodes.append({
                'id': node_id,
                'name': topic['topic'],
                'category': get_category(topic['topic']),
                'mastery': mastery,
                'exposures': total,
                'correct': correct,
                'status': status
            })
        
        edges = []
        topic_list = list(node_ids.keys())
        for i in range(len(topic_list)):
            for j in range(i + 1, len(topic_list)):
                cat_i = get_category(topic_list[i])
                cat_j = get_category(topic_list[j])
                if cat_i == cat_j:
                    edges.append({
                        'source': node_ids[topic_list[i]],
                        'target': node_ids[topic_list[j]],
                        'relationship_type': 'same category',
                        'strength': 0.8
                    })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'nodes': nodes,
            'edges': edges,
            'stats': {
                'total_concepts': len(nodes),
                'mastered': sum(1 for n in nodes if n['status'] == 'mastered'),
                'learning': sum(1 for n in nodes if n['status'] == 'learning'),
                'beginner': sum(1 for n in nodes if n['status'] == 'beginner'),
                'not_started': sum(1 for n in nodes if n['status'] == 'not_started')
            }
        }), 200
        
    except Exception as e:
        print(f"Error getting concept map: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to get concept map'}), 500

@app.route('/api/topic-analysis', methods=['GET'])
def get_topic_analysis():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    try:
        conn = get_db()
        cursor = conn.cursor()
        user_id = session['user_id']
        cursor.execute('''
            SELECT q.topic, q.difficulty,
                   COUNT(*) as total,
                   SUM(CASE WHEN h.correct = 1 THEN 1 ELSE 0 END) as correct,
                   MAX(h.timestamp) as last_practiced
            FROM history h
            JOIN questions q ON h.question_id = q.id
            WHERE h.user_id = ?
            GROUP BY q.topic, q.difficulty
            ORDER BY MAX(h.timestamp) DESC
        ''', (user_id,))
        rows = cursor.fetchall()
        cursor.execute('''
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN h.correct = 1 THEN 1 ELSE 0 END) as correct
            FROM history h WHERE h.user_id = ?
        ''', (user_id,))
        overall = cursor.fetchone()
        conn.close()
        if not rows:
            return jsonify({'success': True, 'recommendations': [], 'overall': {'total': 0, 'correct': 0, 'accuracy': 0}}), 200
        topic_stats = {}
        for r in rows:
            t = r['topic']
            if t not in topic_stats:
                topic_stats[t] = {'total': 0, 'correct': 0, 'difficulties': {}, 'last_practiced': r['last_practiced']}
            topic_stats[t]['total'] += r['total']
            topic_stats[t]['correct'] += (r['correct'] or 0)
            topic_stats[t]['difficulties'][r['difficulty']] = {
                'total': r['total'], 'correct': r['correct'] or 0,
                'accuracy': round(((r['correct'] or 0) / r['total'] * 100), 1) if r['total'] > 0 else 0
            }
        recommendations = []
        for topic, stats in topic_stats.items():
            acc = round((stats['correct'] / stats['total'] * 100), 1) if stats['total'] > 0 else 0
            rec = {'topic': topic, 'total_questions': stats['total'], 'correct': stats['correct'],
                   'accuracy': acc, 'last_practiced': stats['last_practiced'], 'difficulties': stats['difficulties']}
            if acc < 40:
                rec['priority'] = 'high'
                rec['action'] = f'Focus area: Only {acc}% accuracy. Try easier difficulty first to build foundations.'
                rec['suggested_difficulty'] = 'Easy'
            elif acc < 60:
                rec['priority'] = 'medium'
                rec['action'] = f'Needs work: {acc}% accuracy. Practice more at current level before moving up.'
                rec['suggested_difficulty'] = 'Medium'
            elif acc < 80:
                rec['priority'] = 'low'
                rec['action'] = f'Good progress: {acc}% accuracy. Ready to challenge yourself with harder questions.'
                rec['suggested_difficulty'] = 'Hard'
            else:
                rec['priority'] = 'mastered'
                rec['action'] = f'Strong mastery: {acc}% accuracy. Maintain with occasional review.'
                rec['suggested_difficulty'] = 'Hard'
            weak_diff = None
            worst_acc = 100
            for d, ds in stats['difficulties'].items():
                if ds['total'] >= 2 and ds['accuracy'] < worst_acc:
                    worst_acc = ds['accuracy']
                    weak_diff = d
            if weak_diff:
                rec['weakest_difficulty'] = weak_diff
                rec['weakest_accuracy'] = worst_acc
            recommendations.append(rec)
        recommendations.sort(key=lambda x: ({'high': 0, 'medium': 1, 'low': 2, 'mastered': 3}.get(x['priority'], 4), x['accuracy']))
        overall_total = overall['total'] or 0
        overall_correct = overall['correct'] or 0
        overall_acc = round((overall_correct / overall_total * 100), 1) if overall_total > 0 else 0
        study_tip = _get_study_tip(overall_acc, recommendations)
        return jsonify({
            'success': True,
            'recommendations': recommendations[:15],
            'overall': {'total': overall_total, 'correct': overall_correct, 'accuracy': overall_acc},
            'study_tip': study_tip
        }), 200
    except Exception as e:
        print(f"Error getting topic analysis: {str(e)}")
        return jsonify({'error': 'Failed to get topic analysis'}), 500

def _get_study_tip(overall_acc, recommendations):
    high_priority = [r for r in recommendations if r['priority'] == 'high']
    mastered = [r for r in recommendations if r['priority'] == 'mastered']
    if overall_acc == 0:
        return "Start practicing to get personalized study recommendations!"
    if len(high_priority) > 2:
        topics = ', '.join([r['topic'] for r in high_priority[:3]])
        return f"Focus on building foundations in: {topics}. Start with Easy difficulty."
    if overall_acc < 50:
        return "Work on accuracy before speed. Take time to read each question carefully."
    if overall_acc < 70:
        return "Good progress! Try mixing topics to strengthen connections between subjects."
    if len(mastered) > len(recommendations) / 2:
        return "Excellent mastery! Challenge yourself with harder difficulties and new topics."
    return "Keep practicing consistently. Focus on your weaker topics to become well-rounded."

@app.route('/api/user-topics', methods=['GET'])
def get_user_topics():
    """Get user's most-used topics from their history."""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get topic usage counts
        cursor.execute('''
            SELECT q.topic, COUNT(*) as count
            FROM history h
            JOIN questions q ON h.question_id = q.id
            WHERE h.user_id = ?
            GROUP BY q.topic
            ORDER BY count DESC
            LIMIT 5
        ''', (session['user_id'],))
        
        topics = [{'topic': row['topic'], 'count': row['count']} for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({
            'success': True,
            'topics': topics
        }), 200
        
    except Exception as e:
        print(f"Error getting user topics: {str(e)}")
        return jsonify({'error': 'Failed to get topics'}), 500

@app.route('/api/competition-simulate', methods=['POST'])
def simulate_competition():
    """Simulated Competition Mode: AI-powered mock tournament."""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    try:
        import os
        import requests
        import json
        from datetime import datetime
        
        data = request.json
        competition_type = data.get('type', 'standard')  # standard, speed, expert
        num_questions = data.get('questions', 10)
        
        # Get user's current performance level
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                AVG(CASE WHEN h.correct = 1 THEN 1.0 ELSE 0.0 END) as accuracy,
                AVG(h.time_taken) as avg_time
            FROM history h
            WHERE h.user_id = ?
        ''', (session['user_id'],))
        
        perf = cursor.fetchone()
        
        conn.close()
        
        accuracy = perf['accuracy'] if perf and perf['accuracy'] else 0.5
        
        # Determine difficulty based on competition type and user skill
        if competition_type == 'speed':
            difficulty = 'Medium'
            time_pressure = True
        elif competition_type == 'expert':
            difficulty = 'Hard'
            time_pressure = False
        else:
            difficulty = 'Medium' if accuracy >= 0.6 else 'Easy'
            time_pressure = False
        
        # Generate competition-style questions using AI
        api_key = os.environ.get('TOGETHER_API_KEY')
        api_url = os.environ.get('TOGETHER_URL', 'https://api.together.xyz/v1/chat/completions')
        model = os.environ.get('MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')
        
        if not api_key:
            return jsonify({'error': 'API key not configured'}), 500
        
        system_prompt = f"""You are an expert Quiz Bowl competition question generator.

Generate {num_questions} NAQT-style pyramidal questions for a {competition_type} competition.

Competition Details:
- Type: {competition_type}
- Difficulty: {difficulty}
Requirements:
- Pyramidal structure: Start with hardest clues, end with easiest
- 5-7 sentences long
- Mix of topics: History, Science, Literature, Arts, Geography
- Competition-quality questions (challenging but fair)
- Never reveal the answer in the question

Return ONLY valid JSON array:
[
  {{"question": "...", "answer": "...", "topic": "...", "difficulty": "{difficulty}"}},
  ...
]"""
        
        user_prompt = f"Generate {num_questions} competition-style Quiz Bowl questions"
        
        response = requests.post(
            api_url,
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': model,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt}
                ],
                'temperature': 0.9,
                'max_tokens': 3000
            },
            timeout=45
        )
        
        if response.status_code != 200:
            return jsonify({'error': f'AI API error: {response.status_code}'}), 500
        
        result = response.json()
        content = result['choices'][0]['message']['content']
        
        content = content.strip()
        if content.startswith('```json'):
            content = content[7:]
        if content.startswith('```'):
            content = content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()
        
        try:
            questions = json.loads(content)
        except json.JSONDecodeError:
            import re
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                try:
                    questions = json.loads(json_match.group())
                except json.JSONDecodeError:
                    cleaned = re.sub(r',\s*([}\]])', r'\1', json_match.group())
                    questions = json.loads(cleaned)
            else:
                return jsonify({'error': 'AI returned invalid format'}), 500
        
        return jsonify({
            'success': True,
            'questions': questions,
            'competition_info': {
                'type': competition_type,
                'difficulty': difficulty,
                'time_pressure': time_pressure,
                'total_questions': len(questions),
                'recommended_time_per_question': 30 if time_pressure else 60
            }
        }), 200
        
    except Exception as e:
        print(f"Error simulating competition: {str(e)}")
        return jsonify({'error': 'Failed to simulate competition'}), 500

@app.route('/shared-quiz/<code>')
def shared_quiz_page(code):
    return send_from_directory('static', 'shared-quiz.html')

@app.route('/api/upload-material', methods=['POST'])
def upload_material():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400

    allowed_ext = {'.txt', '.md', '.csv'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        return jsonify({'error': 'Unsupported file type. Please upload .txt, .md, or .csv files'}), 400

    try:
        content = file.read().decode('utf-8', errors='ignore')
    except Exception:
        return jsonify({'error': 'Could not read file content'}), 400

    if len(content.strip()) < 50:
        return jsonify({'error': 'File content is too short. Please upload a file with more study material (at least 50 characters).'}), 400

    if len(content) > 50000:
        content = content[:50000]

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO uploaded_materials (user_id, filename, content) VALUES (?, ?, ?)',
                   (session['user_id'], file.filename, content))
    conn.commit()
    material_id = cursor.lastrowid
    conn.close()

    return jsonify({'success': True, 'material_id': material_id, 'filename': file.filename,
                    'content_length': len(content)}), 200

@app.route('/api/generate-from-material', methods=['POST'])
def generate_from_material():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.json
    material_text = data.get('material_text', '')
    difficulty = data.get('difficulty', 'Medium')
    num_questions = data.get('num_questions', 5)

    if not material_text or len(material_text.strip()) < 50:
        return jsonify({'error': 'Material text is too short'}), 400

    if num_questions < 1 or num_questions > 10:
        return jsonify({'error': 'Number of questions must be between 1 and 10'}), 400

    try:
        user_id = session['user_id']

        questions = generate_questions_from_material(material_text, num_questions, difficulty, user_id)
        return jsonify({'success': True, 'questions': questions}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/share-quiz', methods=['POST'])
def share_quiz():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.json
    question_ids = data.get('question_ids', [])
    title = data.get('title', '')
    description = data.get('description', '')

    if not question_ids or len(question_ids) == 0:
        return jsonify({'error': 'No questions to share'}), 400
    if not title:
        return jsonify({'error': 'Please provide a title for the shared quiz'}), 400

    share_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

    conn = get_db()
    cursor = conn.cursor()

    first_q = cursor.execute('SELECT topic, difficulty FROM questions WHERE id = ?', (question_ids[0],)).fetchone()
    topic = first_q['topic'] if first_q else ''
    difficulty = first_q['difficulty'] if first_q else ''

    cursor.execute(
        'INSERT INTO shared_quizzes (user_id, share_code, title, description, question_ids, topic, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (session['user_id'], share_code, title, description, json.dumps(question_ids), topic, difficulty)
    )
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'share_code': share_code}), 200

@app.route('/api/shared-quiz/<code>', methods=['GET'])
def get_shared_quiz(code):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM shared_quizzes WHERE share_code = ?', (code,))
    quiz = cursor.fetchone()

    if not quiz:
        conn.close()
        return jsonify({'error': 'Quiz not found'}), 404

    cursor.execute('UPDATE shared_quizzes SET view_count = view_count + 1 WHERE share_code = ?', (code,))
    conn.commit()

    question_ids = json.loads(quiz['question_ids'])
    placeholders = ','.join('?' for _ in question_ids)
    cursor.execute(f'SELECT id, question, answer, topic, difficulty FROM questions WHERE id IN ({placeholders})', question_ids)
    questions = [dict(row) for row in cursor.fetchall()]

    creator = cursor.execute('SELECT username FROM users WHERE id = ?', (quiz['user_id'],)).fetchone()
    creator_name = creator['username'] if creator else 'Unknown'

    conn.close()

    return jsonify({
        'success': True,
        'title': quiz['title'],
        'description': quiz['description'] or '',
        'creator': creator_name,
        'topic': quiz['topic'] or '',
        'difficulty': quiz['difficulty'] or '',
        'questions': questions,
        'view_count': quiz['view_count'],
        'created_at': quiz['created_at']
    }), 200

@app.route('/api/my-shared-quizzes', methods=['GET'])
def my_shared_quizzes():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT id, share_code, title, topic, difficulty, view_count, created_at FROM shared_quizzes WHERE user_id = ? ORDER BY created_at DESC',
        (session['user_id'],)
    )
    quizzes = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({'success': True, 'quizzes': quizzes}), 200

ADMIN_USERNAME = 'Chakrs12@gmail.com'

@app.route('/api/track-pageview', methods=['POST'])
def track_pageview():
    data = request.json or {}
    page = data.get('page', '/')
    user_id = session.get('user_id')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO page_views (user_id, page, ip_address, user_agent) VALUES (?, ?, ?, ?)',
        (user_id, page, request.remote_addr, str(request.headers.get('User-Agent', ''))[:200])
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True}), 200

@app.route('/api/admin/analytics', methods=['GET'])
def admin_analytics():
    if 'user_id' not in session or session.get('username') != ADMIN_USERNAME:
        return jsonify({'error': 'Unauthorized'}), 403

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) FROM users')
    total_users = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM users WHERE created_at >= date('now', '-7 days')")
    new_users_week = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM users WHERE created_at >= date('now', '-30 days')")
    new_users_month = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM questions')
    total_questions = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM history')
    total_answers = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM history WHERE correct = 1')
    total_correct = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM page_views")
    total_page_views = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM page_views WHERE created_at >= date('now', '-1 day')")
    views_today = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM page_views WHERE created_at >= date('now', '-7 days')")
    views_week = cursor.fetchone()[0]

    cursor.execute('''
        SELECT page, COUNT(*) as cnt FROM page_views
        GROUP BY page ORDER BY cnt DESC LIMIT 10
    ''')
    top_pages = [{'page': r['page'], 'views': r['cnt']} for r in cursor.fetchall()]

    cursor.execute('''
        SELECT date(created_at) as day, COUNT(*) as cnt
        FROM page_views
        WHERE created_at >= date('now', '-30 days')
        GROUP BY day ORDER BY day
    ''')
    daily_views = [{'date': r['day'], 'views': r['cnt']} for r in cursor.fetchall()]

    cursor.execute('''
        SELECT date(created_at) as day, COUNT(*) as cnt
        FROM users
        GROUP BY day ORDER BY day
    ''')
    signups_over_time = [{'date': r['day'], 'count': r['cnt']} for r in cursor.fetchall()]

    cursor.execute('''
        SELECT id, username, full_name, email, role, school, grade,
               created_at,
               (SELECT COUNT(*) FROM history WHERE history.user_id = users.id) as questions_answered,
               (SELECT COUNT(*) FROM history WHERE history.user_id = users.id AND correct = 1) as correct_answers
        FROM users ORDER BY created_at DESC
    ''')
    users_list = []
    for r in cursor.fetchall():
        users_list.append({
            'id': r['id'], 'username': r['username'],
            'full_name': r['full_name'] or '', 'email': r['email'] or '',
            'role': r['role'] or 'student', 'school': r['school'] or '',
            'grade': r['grade'] or '',
            'joined': r['created_at'],
            'questions_answered': r['questions_answered'],
            'correct_answers': r['correct_answers'],
            'accuracy': round(r['correct_answers'] / r['questions_answered'] * 100, 1) if r['questions_answered'] > 0 else 0
        })

    cursor.execute('''
        SELECT topic, COUNT(*) as cnt, 
               SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) as correct
        FROM history JOIN questions ON history.question_id = questions.id
        GROUP BY topic ORDER BY cnt DESC LIMIT 15
    ''')
    topic_stats = [{'topic': r['topic'], 'total': r['cnt'], 'correct': r['correct'],
                     'accuracy': round(r['correct'] / r['cnt'] * 100, 1) if r['cnt'] > 0 else 0}
                    for r in cursor.fetchall()]

    cursor.execute('''
        SELECT DISTINCT COUNT(DISTINCT user_id) FROM page_views
        WHERE created_at >= datetime('now', '-1 hour')
    ''')
    active_recent = cursor.fetchone()[0]

    conn.close()

    return jsonify({
        'success': True,
        'overview': {
            'total_users': total_users,
            'new_users_week': new_users_week,
            'new_users_month': new_users_month,
            'total_questions_generated': total_questions,
            'total_answers': total_answers,
            'total_correct': total_correct,
            'overall_accuracy': round(total_correct / total_answers * 100, 1) if total_answers > 0 else 0,
            'total_page_views': total_page_views,
            'views_today': views_today,
            'views_this_week': views_week,
            'active_last_hour': active_recent
        },
        'top_pages': top_pages,
        'daily_views': daily_views,
        'signups_over_time': signups_over_time,
        'users': users_list,
        'topic_stats': topic_stats
    }), 200

@app.route('/api/generate-tournament-round', methods=['POST'])
def api_generate_tournament_round():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json
    topic = data.get('topic', 'General Knowledge')
    num_tossups = min(int(data.get('num_tossups', 5)), 10)
    try:
        rounds = generate_tournament_round(topic, num_tossups, session['user_id'])
        return jsonify({'success': True, 'rounds': rounds, 'topic': topic}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/daily-challenge', methods=['GET'])
def get_daily_challenge():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    from datetime import date
    today = date.today().isoformat()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM daily_challenges WHERE date = ?', (today,))
    challenge = cursor.fetchone()
    if not challenge:
        try:
            questions = generate_daily_challenge_questions()
            cursor.execute(
                'INSERT INTO daily_challenges (date, questions_json, topic, difficulty) VALUES (?, ?, ?, ?)',
                (today, json.dumps(questions), 'Mixed', 'Medium')
            )
            conn.commit()
            challenge_id = cursor.lastrowid
        except Exception as e:
            conn.close()
            return jsonify({'error': f'Failed to generate daily challenge: {str(e)}'}), 500
    else:
        questions = json.loads(challenge['questions_json'])
    cursor.execute(
        'SELECT * FROM daily_challenge_results WHERE user_id = ? AND challenge_date = ?',
        (session['user_id'], today)
    )
    existing_result = cursor.fetchone()
    already_completed = existing_result is not None
    user_result = None
    if already_completed:
        user_result = {
            'score': existing_result['score'],
            'correct_answers': existing_result['correct_answers'],
            'total_questions': existing_result['total_questions'],
            'time_taken': existing_result['time_taken']
        }
    conn.close()
    return jsonify({
        'success': True,
        'date': today,
        'questions': questions,
        'already_completed': already_completed,
        'user_result': user_result
    }), 200

@app.route('/api/daily-challenge/submit', methods=['POST'])
def submit_daily_challenge():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    from datetime import date
    today = date.today().isoformat()
    data = request.json
    score = data.get('score', 0)
    correct_answers = data.get('correct_answers', 0)
    total_questions = data.get('total_questions', 5)
    time_taken = data.get('time_taken', 0)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT id FROM daily_challenge_results WHERE user_id = ? AND challenge_date = ?',
        (session['user_id'], today)
    )
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Already completed today\'s challenge'}), 400
    cursor.execute(
        'INSERT INTO daily_challenge_results (user_id, challenge_date, score, correct_answers, total_questions, time_taken) VALUES (?, ?, ?, ?, ?, ?)',
        (session['user_id'], today, score, correct_answers, total_questions, time_taken)
    )
    conn.commit()
    conn.close()
    update_streak(session['user_id'])
    return jsonify({'success': True}), 200

@app.route('/api/daily-challenge/leaderboard', methods=['GET'])
def daily_challenge_leaderboard():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    from datetime import date
    today = date.today().isoformat()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT u.username, u.full_name, r.score, r.correct_answers, r.total_questions, r.time_taken
        FROM daily_challenge_results r
        JOIN users u ON r.user_id = u.id
        WHERE r.challenge_date = ?
        ORDER BY r.score DESC, r.time_taken ASC
        LIMIT 50
    ''', (today,))
    rows = cursor.fetchall()
    leaderboard = []
    for i, row in enumerate(rows):
        leaderboard.append({
            'rank': i + 1,
            'username': row['username'],
            'full_name': row['full_name'] or row['username'],
            'score': row['score'],
            'correct_answers': row['correct_answers'],
            'total_questions': row['total_questions'],
            'time_taken': row['time_taken']
        })
    conn.close()
    return jsonify({'success': True, 'leaderboard': leaderboard, 'date': today}), 200

@app.route('/api/streak', methods=['GET'])
def get_streak():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    from datetime import date, timedelta
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT current_streak, longest_streak, last_practice_date FROM users WHERE id = ?', (session['user_id'],))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'User not found'}), 404
    current_streak = row['current_streak'] or 0
    longest_streak = row['longest_streak'] or 0
    last_practice = row['last_practice_date']
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    streak_active = last_practice in (today, yesterday)
    if not streak_active:
        current_streak = 0
    return jsonify({
        'success': True,
        'current_streak': current_streak,
        'longest_streak': longest_streak,
        'last_practice_date': last_practice,
        'streak_active': streak_active
    }), 200

@app.route('/api/missed-questions', methods=['GET'])
def get_missed_questions():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    topic_filter = request.args.get('topic', '')
    difficulty_filter = request.args.get('difficulty', '')
    conn = get_db()
    cursor = conn.cursor()
    query = '''
        SELECT q.id, q.question, q.answer, q.topic, q.difficulty,
               h.timestamp, h.time_taken
        FROM history h
        JOIN questions q ON h.question_id = q.id
        WHERE h.user_id = ? AND h.correct = 0
    '''
    params = [session['user_id']]
    if topic_filter:
        query += ' AND q.topic = ?'
        params.append(topic_filter)
    if difficulty_filter:
        query += ' AND q.difficulty = ?'
        params.append(difficulty_filter)
    query += ' ORDER BY h.timestamp DESC'
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.execute('''
        SELECT DISTINCT q.topic FROM history h
        JOIN questions q ON h.question_id = q.id
        WHERE h.user_id = ? AND h.correct = 0
    ''', (session['user_id'],))
    topics = [r['topic'] for r in cursor.fetchall()]
    conn.close()
    questions = []
    seen_ids = set()
    for r in rows:
        if r['id'] not in seen_ids:
            seen_ids.add(r['id'])
            questions.append({
                'id': r['id'],
                'question': r['question'],
                'answer': r['answer'],
                'topic': r['topic'],
                'difficulty': r['difficulty'],
                'date': r['timestamp'],
                'time_taken': r['time_taken']
            })
    return jsonify({'success': True, 'questions': questions, 'topics': topics}), 200

@app.route('/api/flashcard-questions', methods=['GET'])
def get_flashcard_questions():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    filter_type = request.args.get('filter', 'all')
    topic = request.args.get('topic', '')
    conn = get_db()
    cursor = conn.cursor()
    if filter_type == 'missed':
        query = '''
            SELECT DISTINCT q.id, q.question, q.answer, q.topic, q.difficulty
            FROM history h JOIN questions q ON h.question_id = q.id
            WHERE h.user_id = ? AND h.correct = 0
        '''
        params = [session['user_id']]
    else:
        query = '''
            SELECT DISTINCT q.id, q.question, q.answer, q.topic, q.difficulty
            FROM history h JOIN questions q ON h.question_id = q.id
            WHERE h.user_id = ?
        '''
        params = [session['user_id']]
    if topic:
        query += ' AND q.topic = ?'
        params.append(topic)
    query += ' ORDER BY h.timestamp DESC LIMIT 200'
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.execute('''
        SELECT DISTINCT q.topic FROM history h
        JOIN questions q ON h.question_id = q.id
        WHERE h.user_id = ?
    ''', (session['user_id'],))
    topics = [r['topic'] for r in cursor.fetchall()]
    conn.close()
    questions = [{'id': r['id'], 'question': r['question'], 'answer': r['answer'],
                  'topic': r['topic'], 'difficulty': r['difficulty']} for r in rows]
    return jsonify({'success': True, 'questions': questions, 'topics': topics}), 200

@app.route('/api/study-sets', methods=['GET'])
def get_study_sets():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.id, s.name, s.description, s.created_at,
               COUNT(sq.id) as question_count
        FROM study_sets s
        LEFT JOIN study_set_questions sq ON s.id = sq.set_id
        WHERE s.user_id = ?
        GROUP BY s.id
        ORDER BY s.created_at DESC
    ''', (session['user_id'],))
    sets = [{'id': r['id'], 'name': r['name'], 'description': r['description'],
             'created_at': r['created_at'], 'question_count': r['question_count']} for r in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'sets': sets}), 200

@app.route('/api/study-sets', methods=['POST'])
def create_study_set():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    if not name:
        return jsonify({'error': 'Set name is required'}), 400
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO study_sets (user_id, name, description) VALUES (?, ?, ?)',
                   (session['user_id'], name, description))
    conn.commit()
    set_id = cursor.lastrowid
    conn.close()
    return jsonify({'success': True, 'id': set_id, 'name': name}), 200

@app.route('/api/study-sets/<int:set_id>/add', methods=['POST'])
def add_to_study_set(set_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json
    question_id = data.get('question_id')
    if not question_id:
        return jsonify({'error': 'Question ID required'}), 400
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM study_sets WHERE id = ? AND user_id = ?', (set_id, session['user_id']))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Study set not found'}), 404
    cursor.execute('SELECT id FROM study_set_questions WHERE set_id = ? AND question_id = ?', (set_id, question_id))
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Question already in this set'}), 400
    cursor.execute('INSERT INTO study_set_questions (set_id, question_id) VALUES (?, ?)', (set_id, question_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True}), 200

@app.route('/api/study-sets/<int:set_id>/remove/<int:question_id>', methods=['DELETE'])
def remove_from_study_set(set_id, question_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM study_sets WHERE id = ? AND user_id = ?', (set_id, session['user_id']))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Study set not found'}), 404
    cursor.execute('DELETE FROM study_set_questions WHERE set_id = ? AND question_id = ?', (set_id, question_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True}), 200

@app.route('/api/study-sets/<int:set_id>/questions', methods=['GET'])
def get_study_set_questions(set_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name FROM study_sets WHERE id = ? AND user_id = ?', (set_id, session['user_id']))
    study_set = cursor.fetchone()
    if not study_set:
        conn.close()
        return jsonify({'error': 'Study set not found'}), 404
    cursor.execute('''
        SELECT q.id, q.question, q.answer, q.topic, q.difficulty
        FROM study_set_questions sq
        JOIN questions q ON sq.question_id = q.id
        WHERE sq.set_id = ?
        ORDER BY sq.added_at DESC
    ''', (set_id,))
    questions = [{'id': r['id'], 'question': r['question'], 'answer': r['answer'],
                  'topic': r['topic'], 'difficulty': r['difficulty']} for r in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'set_name': study_set['name'], 'questions': questions}), 200

@app.route('/api/study-sets/<int:set_id>', methods=['DELETE'])
def delete_study_set(set_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM study_sets WHERE id = ? AND user_id = ?', (set_id, session['user_id']))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Study set not found'}), 404
    cursor.execute('DELETE FROM study_set_questions WHERE set_id = ?', (set_id,))
    cursor.execute('DELETE FROM study_sets WHERE id = ?', (set_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True}), 200

@app.route('/api/performance-breakdown', methods=['GET'])
def get_performance_breakdown():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT COUNT(*) as total, SUM(CASE WHEN h.correct=1 THEN 1 ELSE 0 END) as correct
        FROM history h WHERE h.user_id = ?
    ''', (session['user_id'],))
    overall = cursor.fetchone()
    total = overall['total']
    correct = overall['correct']
    cursor.execute('''
        SELECT q.topic,
               COUNT(*) as total,
               SUM(CASE WHEN h.correct=1 THEN 1 ELSE 0 END) as correct,
               AVG(h.time_taken) as avg_time
        FROM history h JOIN questions q ON h.question_id = q.id
        WHERE h.user_id = ?
        GROUP BY q.topic ORDER BY total DESC
    ''', (session['user_id'],))
    topics = []
    for r in cursor.fetchall():
        topics.append({
            'topic': r['topic'],
            'total': r['total'],
            'correct': r['correct'],
            'accuracy': round(r['correct'] / r['total'] * 100, 1) if r['total'] > 0 else 0,
            'avg_time': round(r['avg_time'], 1) if r['avg_time'] else 0
        })
    cursor.execute('''
        SELECT q.difficulty,
               COUNT(*) as total,
               SUM(CASE WHEN h.correct=1 THEN 1 ELSE 0 END) as correct
        FROM history h JOIN questions q ON h.question_id = q.id
        WHERE h.user_id = ?
        GROUP BY q.difficulty
    ''', (session['user_id'],))
    difficulties = {}
    for r in cursor.fetchall():
        difficulties[r['difficulty']] = {
            'total': r['total'],
            'correct': r['correct'],
            'accuracy': round(r['correct'] / r['total'] * 100, 1) if r['total'] > 0 else 0
        }
    cursor.execute('''
        SELECT DATE(h.timestamp) as day,
               q.topic,
               COUNT(*) as total,
               SUM(CASE WHEN h.correct=1 THEN 1 ELSE 0 END) as correct
        FROM history h JOIN questions q ON h.question_id = q.id
        WHERE h.user_id = ?
        GROUP BY day, q.topic
        ORDER BY day DESC
        LIMIT 50
    ''', (session['user_id'],))
    recent_rows = cursor.fetchall()
    recent = []
    current_day = None
    day_entry = None
    for r in recent_rows:
        if r['day'] != current_day:
            if day_entry:
                recent.append(day_entry)
            current_day = r['day']
            day_entry = {'date': r['day'], 'topics': [], 'total': 0, 'correct': 0}
        day_entry['topics'].append(r['topic'])
        day_entry['total'] += r['total']
        day_entry['correct'] += r['correct']
    if day_entry:
        recent.append(day_entry)
    conn.close()
    return jsonify({
        'success': True,
        'overall': {
            'total': total,
            'correct': correct,
            'accuracy': round(correct / total * 100, 1) if total > 0 else 0,
            'topics_practiced': len(topics)
        },
        'topics': topics,
        'difficulties': difficulties,
        'recent_activity': recent[:10]
    }), 200

@app.route('/api/power-training/generate', methods=['GET'])
def power_training_generate():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    topic = request.args.get('topic', 'General Knowledge')
    try:
        data = generate_power_clues(topic, user_id=session['user_id'])
        return jsonify({'success': True, 'answer': data['answer'], 'clues': data['clues'], 'topic': topic}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/power-training/submit', methods=['POST'])
def power_training_submit():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json
    topic = data.get('topic', '')
    total_clues = data.get('total_clues', 0)
    buzz_depth = data.get('buzz_depth', 0)
    points = data.get('points_earned', 0)
    correct = data.get('correct', False)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO power_training_sessions (user_id, topic, total_clues, buzz_depth, points_earned, correct) VALUES (?, ?, ?, ?, ?, ?)',
                   (session['user_id'], topic, total_clues, buzz_depth, points, 1 if correct else 0))
    conn.commit()
    cursor.execute('SELECT COUNT(*) as total, SUM(correct) as wins, AVG(buzz_depth) as avg_depth, SUM(points_earned) as total_pts FROM power_training_sessions WHERE user_id = ?', (session['user_id'],))
    row = cursor.fetchone()
    conn.close()
    return jsonify({
        'success': True,
        'career_stats': {
            'total_buzzes': row[0],
            'correct': row[1] or 0,
            'avg_buzz_depth': round(row[2] or 0, 1),
            'total_points': row[3] or 0
        }
    }), 200

@app.route('/api/knowledge-decay', methods=['GET'])
def knowledge_decay_get():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    import math
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT q.topic,
               COUNT(*) as total,
               SUM(CASE WHEN h.correct = 1 THEN 1 ELSE 0 END) as correct_count,
               MAX(h.timestamp) as last_practiced
        FROM history h
        JOIN questions q ON h.question_id = q.id
        WHERE h.user_id = ? AND q.topic IS NOT NULL AND q.topic != ''
        GROUP BY q.topic
    ''', (session['user_id'],))
    rows = cursor.fetchall()
    conn.close()
    topics = []
    now = datetime.now()
    for row in rows:
        topic, total, correct_count, last_practiced = row
        if not topic or topic == 'packet_generated':
            continue
        accuracy = (correct_count / total * 100) if total > 0 else 50
        try:
            last_dt = datetime.strptime(last_practiced, '%Y-%m-%d %H:%M:%S') if last_practiced else now
        except:
            last_dt = now
        days_since = (now - last_dt).total_seconds() / 86400
        decay_rate = 0.15 if accuracy < 50 else 0.1 if accuracy < 75 else 0.07
        health = min(100, max(0, 100 * math.exp(-decay_rate * days_since) * (accuracy / 100)))
        urgency = 'critical' if health < 30 else 'warning' if health < 60 else 'good'
        topics.append({
            'topic': topic,
            'health': round(health, 1),
            'accuracy': round(accuracy, 1),
            'total_questions': total,
            'days_since_practice': round(days_since, 1),
            'urgency': urgency,
            'last_practiced': last_practiced
        })
    topics.sort(key=lambda x: x['health'])
    review_plan = [t for t in topics if t['health'] < 60]
    return jsonify({'success': True, 'topics': topics, 'review_plan': review_plan}), 200

@app.route('/api/h2h/create', methods=['POST'])
def h2h_create():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json
    opponent_username = data.get('opponent', '').strip()
    topic = data.get('topic', 'General Knowledge')
    difficulty = data.get('difficulty', 'Medium')
    if not opponent_username:
        return jsonify({'error': 'Opponent username required'}), 400
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM users WHERE username = ?', (opponent_username,))
    opp = cursor.fetchone()
    if not opp:
        conn.close()
        return jsonify({'error': 'Opponent not found'}), 404
    if opp[0] == session['user_id']:
        conn.close()
        return jsonify({'error': 'Cannot challenge yourself'}), 400
    try:
        questions = generate_questions(topic, difficulty, 5, session['user_id'])
        q_json = json.dumps(questions)
    except Exception as e:
        conn.close()
        return jsonify({'error': f'Failed to generate questions: {str(e)}'}), 500
    cursor.execute('INSERT INTO h2h_challenges (challenger_id, opponent_id, topic, difficulty, questions_json) VALUES (?, ?, ?, ?, ?)',
                   (session['user_id'], opp[0], topic, difficulty, q_json))
    conn.commit()
    cid = cursor.lastrowid
    conn.close()
    return jsonify({'success': True, 'challenge_id': cid}), 200

@app.route('/api/h2h/pending', methods=['GET'])
def h2h_pending():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    conn = get_db()
    cursor = conn.cursor()
    uid = session['user_id']
    cursor.execute('''
        SELECT c.id, c.topic, c.difficulty, c.status, c.created_at, c.challenger_score, c.opponent_score,
               u1.username as challenger, u2.username as opponent, c.challenger_id, c.opponent_id
        FROM h2h_challenges c
        JOIN users u1 ON c.challenger_id = u1.id
        JOIN users u2 ON c.opponent_id = u2.id
        WHERE c.challenger_id = ? OR c.opponent_id = ?
        ORDER BY c.created_at DESC LIMIT 20
    ''', (uid, uid))
    rows = cursor.fetchall()
    conn.close()
    challenges = []
    for r in rows:
        is_challenger = r[9] == uid
        challenges.append({
            'id': r[0], 'topic': r[1], 'difficulty': r[2], 'status': r[3],
            'created_at': r[4], 'challenger_score': r[5], 'opponent_score': r[6],
            'challenger': r[7], 'opponent': r[8],
            'role': 'challenger' if is_challenger else 'opponent',
            'your_score': r[5] if is_challenger else r[6],
            'their_score': r[6] if is_challenger else r[5]
        })
    return jsonify({'success': True, 'challenges': challenges}), 200

@app.route('/api/h2h/accept/<int:challenge_id>', methods=['POST'])
def h2h_accept(challenge_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM h2h_challenges WHERE id = ? AND opponent_id = ? AND status = ?',
                   (challenge_id, session['user_id'], 'pending'))
    ch = cursor.fetchone()
    if not ch:
        conn.close()
        return jsonify({'error': 'Challenge not found'}), 404
    cursor.execute('UPDATE h2h_challenges SET status = ? WHERE id = ?', ('accepted', challenge_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True}), 200

@app.route('/api/h2h/decline/<int:challenge_id>', methods=['POST'])
def h2h_decline(challenge_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM h2h_challenges WHERE id = ? AND opponent_id = ? AND status = ?',
                   (challenge_id, session['user_id'], 'pending'))
    ch = cursor.fetchone()
    if not ch:
        conn.close()
        return jsonify({'error': 'Challenge not found'}), 404
    cursor.execute('UPDATE h2h_challenges SET status = ? WHERE id = ?', ('declined', challenge_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True}), 200

@app.route('/api/h2h/questions/<int:challenge_id>', methods=['GET'])
def h2h_questions(challenge_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT questions_json, challenger_id, opponent_id, status, challenger_score, opponent_score FROM h2h_challenges WHERE id = ?', (challenge_id,))
    ch = cursor.fetchone()
    conn.close()
    if not ch:
        return jsonify({'error': 'Not found'}), 404
    uid = session['user_id']
    if uid != ch[1] and uid != ch[2]:
        return jsonify({'error': 'Not your challenge'}), 403
    if ch[3] == 'pending' and uid == ch[2]:
        return jsonify({'error': 'Accept the challenge first'}), 400
    is_challenger = uid == ch[1]
    already_played = (is_challenger and ch[4] is not None) or (not is_challenger and ch[5] is not None)
    questions = json.loads(ch[0])
    return jsonify({'success': True, 'questions': questions, 'already_played': already_played}), 200

@app.route('/api/h2h/submit/<int:challenge_id>', methods=['POST'])
def h2h_submit(challenge_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json
    score = data.get('score', 0)
    if not isinstance(score, int) or score < 0 or score > 5:
        return jsonify({'error': 'Invalid score'}), 400
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT challenger_id, opponent_id, status, challenger_score, opponent_score FROM h2h_challenges WHERE id = ?', (challenge_id,))
    ch = cursor.fetchone()
    if not ch:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    uid = session['user_id']
    if uid != ch[0] and uid != ch[1]:
        conn.close()
        return jsonify({'error': 'Not your challenge'}), 403
    if ch[2] == 'declined':
        conn.close()
        return jsonify({'error': 'Challenge was declined'}), 400
    is_challenger = uid == ch[0]
    if is_challenger and ch[3] is not None:
        conn.close()
        return jsonify({'error': 'You already submitted your score'}), 400
    if not is_challenger and ch[4] is not None:
        conn.close()
        return jsonify({'error': 'You already submitted your score'}), 400
    if is_challenger:
        cursor.execute('UPDATE h2h_challenges SET challenger_score = ? WHERE id = ?', (score, challenge_id))
    else:
        cursor.execute('UPDATE h2h_challenges SET opponent_score = ? WHERE id = ?', (score, challenge_id))
    cursor.execute('SELECT challenger_score, opponent_score FROM h2h_challenges WHERE id = ?', (challenge_id,))
    updated = cursor.fetchone()
    if updated[0] is not None and updated[1] is not None:
        cursor.execute('UPDATE h2h_challenges SET status = ? WHERE id = ?', ('completed', challenge_id))
    elif ch[2] == 'pending':
        cursor.execute('UPDATE h2h_challenges SET status = ? WHERE id = ?', ('accepted', challenge_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True}), 200

@app.route('/api/question-writer/submit', methods=['POST'])
def question_writer_submit():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json
    topic = data.get('topic', '').strip()
    difficulty = data.get('difficulty', 'Medium')
    question_text = data.get('question_text', '').strip()
    answer = data.get('answer', '').strip()
    if not question_text or not answer or not topic:
        return jsonify({'error': 'Topic, question, and answer are required'}), 400
    try:
        feedback = grade_student_question(topic, difficulty, question_text, answer)
        overall_score = feedback.get('overall_score', 5)
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('INSERT INTO question_writing (user_id, topic, difficulty, question_text, answer, ai_score, ai_feedback) VALUES (?, ?, ?, ?, ?, ?, ?)',
                       (session['user_id'], topic, difficulty, question_text, answer, overall_score, json.dumps(feedback)))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'feedback': feedback}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/question-writer/history', methods=['GET'])
def question_writer_history():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, topic, difficulty, question_text, answer, ai_score, ai_feedback, created_at FROM question_writing WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', (session['user_id'],))
    rows = cursor.fetchall()
    conn.close()
    items = []
    for r in rows:
        fb = None
        try:
            fb = json.loads(r[6]) if r[6] else None
        except:
            pass
        items.append({
            'id': r[0], 'topic': r[1], 'difficulty': r[2], 'question_text': r[3],
            'answer': r[4], 'ai_score': r[5], 'feedback': fb, 'created_at': r[7]
        })
    return jsonify({'success': True, 'submissions': items}), 200

@app.route('/api/packet-generator', methods=['POST'])
def packet_generator_api():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json
    packet_type = data.get('packet_type', 'half')
    difficulty = data.get('difficulty', 'Medium')
    if packet_type not in ('full', 'half', 'lightning'):
        return jsonify({'error': 'Invalid packet type'}), 400
    if difficulty not in ('Easy', 'Medium', 'Hard'):
        return jsonify({'error': 'Invalid difficulty'}), 400
    try:
        packet = generate_packet(packet_type, difficulty, user_id=session['user_id'])
        from ai import get_user_packet_count_today, MAX_PACKETS_PER_DAY
        remaining = MAX_PACKETS_PER_DAY - get_user_packet_count_today(session['user_id'])
        return jsonify({'success': True, 'packet': packet, 'packet_type': packet_type, 'packets_remaining_today': remaining}), 200
    except ValueError as e:
        err_msg = str(e)
        if 'Daily packet limit' in err_msg:
            return jsonify({'error': err_msg}), 429
        return jsonify({'error': err_msg}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/packet-generator/remaining', methods=['GET'])
def packet_remaining_api():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    from ai import get_user_packet_count_today, MAX_PACKETS_PER_DAY
    used = get_user_packet_count_today(session['user_id'])
    return jsonify({'used': used, 'limit': MAX_PACKETS_PER_DAY, 'remaining': MAX_PACKETS_PER_DAY - used})

@app.route('/api/autopsy/analyze', methods=['POST'])
def autopsy_analyze():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json
    question_text = data.get('question_text', '').strip()
    correct_answer = data.get('answer', '').strip()
    user_answer = data.get('user_answer', '').strip()
    topic = data.get('topic', '').strip()
    if not question_text or not correct_answer:
        return jsonify({'error': 'Question and correct answer are required'}), 400
    if not user_answer:
        user_answer = '(no answer given)'
    try:
        result = analyze_question_autopsy(question_text, correct_answer, user_answer, topic or 'General')
        return jsonify({'success': True, 'analysis': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/debate/start', methods=['POST'])
def debate_start():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json
    topic = data.get('topic', '').strip()
    if not topic:
        return jsonify({'error': 'Topic is required'}), 400
    sides = ['for', 'against']
    user_side = random.choice(sides)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO debate_sessions (user_id, topic, side, rounds_json, status) VALUES (?, ?, ?, ?, ?)',
                   (session['user_id'], topic, user_side, '[]', 'active'))
    conn.commit()
    debate_id = cursor.lastrowid
    conn.close()
    ai_side = 'against' if user_side == 'for' else 'for'
    return jsonify({
        'success': True,
        'debate_id': debate_id,
        'topic': topic,
        'user_side': user_side,
        'ai_side': ai_side,
        'message': f'You are arguing {user_side.upper()} the topic: "{topic}". Present your opening argument!'
    }), 200

@app.route('/api/debate/respond', methods=['POST'])
def debate_respond_api():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json
    debate_id = data.get('debate_id')
    user_argument = data.get('argument', '').strip()
    if not debate_id or not user_argument:
        return jsonify({'error': 'Debate ID and argument are required'}), 400
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT topic, side, rounds_json, status FROM debate_sessions WHERE id = ? AND user_id = ?',
                   (debate_id, session['user_id']))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Debate not found'}), 404
    if row[3] != 'active':
        conn.close()
        return jsonify({'error': 'Debate is already finished'}), 400
    topic = row[0]
    user_side = row[1]
    rounds = json.loads(row[2])
    if len(rounds) >= 3:
        conn.close()
        return jsonify({'error': 'Debate already has 3 rounds'}), 400
    try:
        ai_response = debate_respond(topic, user_side, rounds, user_argument)
        new_round = {
            'round': len(rounds) + 1,
            'user': user_argument,
            'ai': ai_response.get('response', '')
        }
        rounds.append(new_round)
        cursor.execute('UPDATE debate_sessions SET rounds_json = ? WHERE id = ?',
                       (json.dumps(rounds), debate_id))
        conn.commit()
        conn.close()
        return jsonify({
            'success': True,
            'round': new_round,
            'rounds_completed': len(rounds),
            'rounds_remaining': 3 - len(rounds)
        }), 200
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/debate/finish', methods=['POST'])
def debate_finish():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json
    debate_id = data.get('debate_id')
    if not debate_id:
        return jsonify({'error': 'Debate ID required'}), 400
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT topic, side, rounds_json, status FROM debate_sessions WHERE id = ? AND user_id = ?',
                   (debate_id, session['user_id']))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Debate not found'}), 404
    if row[3] != 'active':
        conn.close()
        return jsonify({'error': 'Debate already scored'}), 400
    topic = row[0]
    user_side = row[1]
    rounds = json.loads(row[2])
    if len(rounds) == 0:
        conn.close()
        return jsonify({'error': 'No rounds played yet'}), 400
    try:
        scores = debate_score(topic, user_side, rounds)
        overall = scores.get('overall_score', 5)
        cursor.execute('UPDATE debate_sessions SET ai_score = ?, feedback_json = ?, status = ? WHERE id = ?',
                       (overall, json.dumps(scores), 'completed', debate_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'scores': scores}), 200
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/debate/history', methods=['GET'])
def debate_history():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, topic, side, ai_score, status, created_at FROM debate_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
                   (session['user_id'],))
    rows = cursor.fetchall()
    conn.close()
    debates = []
    for r in rows:
        debates.append({
            'id': r[0], 'topic': r[1], 'side': r[2],
            'score': r[3], 'status': r[4], 'created_at': r[5]
        })
    return jsonify({'success': True, 'debates': debates}), 200

@app.route('/api/timeline/generate', methods=['GET'])
def timeline_generate():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    topic = request.args.get('topic', '').strip()
    if not topic:
        return jsonify({'error': 'Topic is required'}), 400
    try:
        events = generate_timeline_events(topic)
        return jsonify({'success': True, 'events': events, 'topic': topic}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/timeline/submit', methods=['POST'])
def timeline_submit():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    data = request.json
    topic = data.get('topic', '')
    user_order = data.get('user_order', [])
    correct_order = data.get('correct_order', [])
    if not user_order or not correct_order:
        return jsonify({'error': 'Order data required'}), 400
    correct_count = 0
    total = len(correct_order)
    for i, event in enumerate(user_order):
        if i < total and event.get('event') == correct_order[i].get('event'):
            correct_count += 1
    score = round(correct_count / total * 100, 1) if total > 0 else 0
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO timeline_attempts (user_id, topic, events_json, score, total_events) VALUES (?, ?, ?, ?, ?)',
                   (session['user_id'], topic, json.dumps(user_order), score, total))
    conn.commit()
    conn.close()
    return jsonify({
        'success': True,
        'correct_count': correct_count,
        'total': total,
        'score': score
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
