import requests
import json
import os
import sqlite3
from typing import List, Dict

DB_NAME = 'scholar_bowl.db'
MAX_RETRY_ATTEMPTS = 3

def _validate_answer_not_in_question(question_text: str, answer: str) -> bool:
    import re
    if not question_text or not answer:
        return True
    
    STOP_WORDS = {'the', 'a', 'an', 'of', 'and', 'in', 'on', 'at', 'to', 'for', 'is', 'was', 'by',
                  'or', 'it', 'its', 'be', 'as', 'are', 'were', 'been', 'has', 'had', 'do', 'did',
                  'this', 'that', 'these', 'those', 'with', 'from', 'not', 'but', 'if', 'no', 'so',
                  'he', 'she', 'his', 'her', 'him', 'they', 'them', 'their', 'who', 'which', 'what'}

    def normalize(s):
        s = s.lower().strip()
        s = re.sub(r'[^\w\s]', '', s)
        return re.sub(r'\s+', ' ', s).strip()
    
    q_norm = normalize(question_text)
    a_norm = normalize(answer)
    
    if len(a_norm) < 3:
        return True
    
    if a_norm in q_norm:
        return False
    
    q_no_stop = re.sub(r'\b(' + '|'.join(STOP_WORDS) + r')\b', ' ', q_norm)
    q_no_stop = re.sub(r'\s+', ' ', q_no_stop).strip()
    a_no_stop = re.sub(r'\b(' + '|'.join(STOP_WORDS) + r')\b', ' ', a_norm)
    a_no_stop = re.sub(r'\s+', ' ', a_no_stop).strip()

    if len(a_no_stop) >= 3 and a_no_stop in q_no_stop:
        return False
    
    a_parts = [p for p in a_norm.split() if len(p) > 2 and p not in STOP_WORDS]
    if len(a_parts) >= 2:
        full_name = ' '.join(a_parts)
        if full_name in q_norm:
            return False
        last_first = a_parts[-1] + ' ' + a_parts[0]
        if last_first in q_norm:
            return False
        significant_found = sum(1 for p in a_parts if re.search(r'\b' + re.escape(p) + r'\b', q_norm))
        if len(a_parts) >= 2 and significant_found == len(a_parts):
            return False
    
    return True


def _validate_question_completeness(question_text: str) -> bool:
    import re
    if not question_text or len(question_text.strip()) < 80:
        return False
    q = question_text.strip()
    if q[-1] not in '.?!':
        return False
    sentences = [s.strip() for s in re.split(r'(?<=[.?!])\s+', q) if s.strip()]
    if len(sentences) < 3:
        return False
    last_two = ' '.join(sentences[-2:]).lower() if len(sentences) >= 2 else sentences[-1].lower()
    closing_patterns = [
        'name this', 'identify this', 'name these', 'identify these',
        'what is this', 'what are these', 'give this', 'name the',
        'what is the name', 'who is this', 'who was this'
    ]
    has_proper_ending = any(p in last_two for p in closing_patterns)
    if not has_proper_ending:
        return False
    return True


def get_recent_answers(user_id: int, limit: int = 60) -> List[str]:
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT DISTINCT q.answer
        FROM history h
        JOIN questions q ON h.question_id = q.id
        WHERE h.user_id = ?
        ORDER BY h.timestamp DESC
        LIMIT ?
    ''', (user_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [row[0] for row in rows]


def get_all_user_answers(user_id: int) -> set:
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT DISTINCT LOWER(q.answer)
        FROM history h
        JOIN questions q ON h.question_id = q.id
        WHERE h.user_id = ?
    ''', (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return {row[0] for row in rows}

def generate_questions(topic: str, difficulty: str, num_questions: int, user_id: int, subtopic: str = "", language: str = "English", _retry_count: int = 0) -> List[Dict]:
    api_key = os.environ.get('TOGETHER_API_KEY')
    api_url = os.environ.get('TOGETHER_URL', 'https://api.together.xyz/v1/chat/completions')
    model = os.environ.get('MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')
    
    if not api_key:
        raise ValueError("TOGETHER_API_KEY not found in environment variables")
    
    # Get recent answers from the last 6 quizzes (assuming ~10 questions per quiz = 60 questions)
    recent_answers = get_recent_answers(user_id, limit=60)
    
    difficulty_guidelines = {
        'Easy': 'EASY (General High School Level): Straightforward questions focused on broad facts, well-known people, terms, or events. Avoid jargon or technical terms. Target general high school players.',
        'Medium': 'MEDIUM (Advanced High School / AP Level): Include specific or supporting facts requiring limited synthesis or context. More challenging names, terms, or relationships. Target competitive high school players and AP/Honors students.',
        'Hard': 'HARD (College Level): Academic and specific questions with obscure details, theories, or original terminology. Encourage deep subject knowledge or advanced analysis. Target college players or elite national competitors.'
    }
    
    subtopic_instruction = f" Focus specifically on {subtopic}." if subtopic else ""
    
    # Add instruction to avoid recent answers
    avoid_answers_instruction = ""
    if recent_answers:
        avoid_answers_instruction = f"\n\nIMPORTANT - AVOID THESE RECENT ANSWERS:\nThe user has recently seen questions with these answers: {', '.join(recent_answers[:30])}. DO NOT generate questions with any of these answers. Create questions about completely different people, places, events, concepts, or works."
    
    # Add language instruction
    language_instruction = f"\n\nLANGUAGE: Write the entire question and answer in {language}. Use proper grammar, spelling, and cultural context appropriate for {language}-speaking users." if language != "English" else ""
    
    system_prompt = f"""You are a professional NAQT-style quiz bowl question writer. Follow the standards of NAQT.com, QuizDB.org, and Protobowl.com to create high-quality academic questions.{language_instruction}

PYRAMIDAL FORMAT (NAQT-STYLE - CRITICAL):
Use the classic NAQT pyramid structure where questions start with HARDER clues and end with EASIER clues:

1. OPENING: Begin with "This [type]..." to introduce the subject WITHOUT naming it:
   - "This scientist..." / "This novel..." / "This war..." / "This theory..." / "This country..." / "This process..."
   
2. FIRST SENTENCES (Hardest Clues): Present obscure, specific details that only experts or advanced players would know:
   - Lesser-known works, minor achievements, or technical details
   - Specific dates, numbers, original terminology
   - Detailed biographical facts or historical minutiae
   - Academic or scientific specifications
   
3. MIDDLE SENTENCES (Moderate Clues): Progress to more recognizable but still specific information:
   - More well-known works or events
   - Secondary associations or notable facts
   - Supporting details that require some knowledge
   
4. FINAL SENTENCES (Easiest Clues): End with the most obvious, widely-known information:
   - Famous works, achievements, or main claims to fame
   - Popular associations that most people would recognize
   - The "giveaway" clue that clearly identifies the answer
   
5. ENDING QUESTION: Conclude with a direct command asking for the answer:
   - "Name this [person/concept/theory/work/event/country]."
   - "Identify this [scientist/author/process/phenomenon]."
   - For people: "Name this [president/author/scientist/leader]."
   - For things: "Name this [novel/theory/process/war/country]."
   - Use simple, direct phrasing without "For 10 points"

DIFFICULTY LEVEL:
{difficulty_guidelines.get(difficulty, difficulty_guidelines['Medium'])}

ANSWER PROTECTION (MOST CRITICAL RULE - ABSOLUTE):
- The answer MUST NEVER appear anywhere in the question text. This is the #1 rule.
- Do NOT mention the answer's name, title, or any form of it in any sentence of the question.
- Use ONLY indirect references: "This scientist...", "This novel...", "This country...", "He...", "She...", "It..."
- WRONG: "Albert Einstein developed the theory of relativity. Name this physicist." (answer "Albert Einstein" is IN the question!)
- RIGHT: "This physicist developed the theory of relativity. Name this German-born physicist." (answer never appears)
- WRONG: "The Great Gatsby was written by F. Scott Fitzgerald. Name this novel." (answer "The Great Gatsby" is IN the question!)
- RIGHT: "This novel features Jay Gatsby and narrator Nick Carraway on Long Island. Name this F. Scott Fitzgerald novel." (answer never appears)
- Check EVERY sentence to ensure the answer string does not appear in the question text.
- Use pronouns (he, she, it, they, this person, this work) instead of naming the answer.

CRITICAL RULES:
- Write 5-7 sentences per question (longer questions allow better pyramidal progression)
- NEVER reveal the answer in the question text - use descriptive clues WITHOUT stating the answer
- Start with "This [type]..." format: "This scientist...", "This novel...", "This war...", "This theory..."
- Build a narrative flow that progressively reveals easier information
- EVERY question MUST end with a complete closing sentence: "Name this [type]." or "Identify this [type]."
- NEVER leave a question incomplete or cut off mid-sentence - each question must be a fully finished paragraph
- Be factually accurate and verifiable
- Answer should be specific (full names, complete titles)
- Questions must be informative, clear, and grammatically correct
- Make each question educational even without seeing the answer

EXAMPLE QUESTION STRUCTURE:
"This 19th-century scientist conducted experiments with pea plants in a monastery garden. His work on heredity was largely ignored during his lifetime but was rediscovered in 1900. He formulated fundamental principles explaining how traits are inherited through discrete units. His laws include the Law of Segregation and the Law of Independent Assortment. He is now considered the father of modern genetics. Name this Austrian monk and scientist."
(Answer: Gregor Mendel)

DIVERSITY REQUIREMENTS (CRITICAL):
- EXPLORE DIFFERENT ASPECTS: Cover diverse angles of {topic} such as:
  * Different time periods (ancient, medieval, modern, contemporary)
  * Different geographical regions or cultures
  * Different key figures, theories, or works
  * Different events, concepts, or applications
  * Different schools of thought or movements
- UNIQUE ANSWERS: Every question must have a COMPLETELY DIFFERENT answer - no duplicates allowed within this quiz
- VARIED SUBJECT MATTER: Within {topic}, explore as many different subtopics, people, works, and concepts as possible
- AVOID REPETITION: Don't use the same person, work, event, or concept more than once
- BROAD COVERAGE: Think of {topic} as an entire field with many facets - cover different areas, not just the most famous examples

LEGIBILITY AND CLARITY REQUIREMENTS (CRITICAL):
- Write in clear, professional English with proper grammar and punctuation
- Use complete sentences with smooth transitions between clues
- Ensure each sentence flows naturally into the next
- Avoid run-on sentences or overly complex syntax
- Use proper capitalization for names, titles, and places
- Format answers with full proper names or complete titles (e.g., "William Shakespeare" not "Shakespeare", "The Great Gatsby" not "Gatsby")
- Make questions readable and easy to follow, even when read aloud
- Each clue should be a distinct, well-formed sentence

OUTPUT FORMAT - CRITICAL:
You MUST return a valid JSON array in this exact format:
[
  {{"question": "<pyramidal question text>", "answer": "<specific answer>"}},
  {{"question": "<pyramidal question text>", "answer": "<specific answer>"}}
]

IMPORTANT JSON RULES:
- Return ONLY the JSON array, no additional text before or after
- Each question and answer must be properly escaped JSON strings
- Use double quotes for all strings
- Ensure all strings are properly closed
- Do not include any text outside the JSON array
- Make sure the JSON is valid and can be parsed

Generate {num_questions} unique NAQT-style tossup questions about {topic}.{subtopic_instruction}

CRITICAL FINAL INSTRUCTIONS:
- ALL {num_questions} questions MUST have COMPLETELY DIFFERENT answers - NO duplicates allowed
- Cover DIVERSE aspects of {topic} - different time periods, regions, people, works, events, theories, or concepts
- Make questions CLEAR, READABLE, and WELL-FORMATTED with proper grammar and smooth flow
- Follow PYRAMIDAL structure: hard clues first → easier clues last
- Each question should teach something unique about a different facet of {topic}{avoid_answers_instruction}"""
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': f'Generate {num_questions} NAQT questions about {topic}{subtopic_instruction} at {difficulty} difficulty level. Return ONLY valid JSON array with no additional text.'}
        ],
        'temperature': 0.7,
        'max_tokens': 4000
    }
    
    try:
        print(f"Calling API: {api_url}")
        print(f"Model: {model}")
        response = requests.post(api_url, headers=headers, json=payload, timeout=60)
        
        print(f"Response status: {response.status_code}")
        print(f"Response text (first 500 chars): {response.text[:500]}")
        
        # Check if response has content
        if not response.text:
            raise Exception(f"API returned empty response. Status code: {response.status_code}")
        
        # Try to parse JSON response
        try:
            result = response.json()
        except json.JSONDecodeError as e:
            raise Exception(f"API returned non-JSON response (status {response.status_code}): {response.text[:500]}")
        
        # Check for API errors
        if response.status_code != 200:
            error_msg = result.get('error', {}).get('message', response.text[:200])
            raise Exception(f"API error ({response.status_code}): {error_msg}")
        
        # Extract content from response
        if 'choices' not in result or not result['choices']:
            raise Exception(f"Unexpected API response format: {json.dumps(result)[:200]}")
        
        content = result['choices'][0]['message']['content']
        print(f"AI generated content (first 200 chars): {content[:200]}")
        
        # Clean up the content
        content = content.strip()
        
        # Remove markdown code blocks
        if content.startswith('```json'):
            content = content[7:]
        if content.startswith('```'):
            content = content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()
        
        # Try to extract JSON array if embedded in other text
        if '[' in content and ']' in content:
            start_idx = content.find('[')
            end_idx = content.rfind(']')
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                content = content[start_idx:end_idx+1]
        
        print(f"Cleaned content for JSON parsing (first 500 chars): {content[:500]}")
        
        # Try to parse JSON with better error handling
        try:
            questions = json.loads(content)
        except json.JSONDecodeError as e:
            # If JSON parsing fails, retry with a different approach
            if _retry_count < MAX_RETRY_ATTEMPTS:
                print(f"JSON parsing failed (attempt {_retry_count + 1}/{MAX_RETRY_ATTEMPTS}). Retrying...")
                return generate_questions(topic, difficulty, num_questions, user_id, subtopic, language, _retry_count + 1)
            else:
                raise Exception(f"Failed to parse AI response as JSON after {MAX_RETRY_ATTEMPTS} attempts. Error: {str(e)}. Content: {content[:500]}")
        
        # Ensure questions is a list
        if isinstance(questions, dict):
            # If it's a dict, try to extract the list
            if 'questions' in questions:
                questions = questions['questions']
            else:
                questions = [questions]
        
        unique_questions = []
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        all_seen_answers = get_all_user_answers(user_id)
        
        for q in questions:
            if not _validate_question_completeness(q.get('question', '')):
                print(f"REJECTED incomplete question (truncated/missing ending): {q.get('question', '')[:80]}...")
                continue

            if not _validate_answer_not_in_question(q.get('question', ''), q.get('answer', '')):
                print(f"REJECTED: Answer '{q.get('answer')}' found in question text. Filtering out.")
                continue
            
            if q.get('answer', '').lower() in all_seen_answers:
                print(f"Skipping duplicate answer: {q.get('answer')}")
                continue
            
            # Check if this exact question already exists in the database
            cursor.execute('SELECT id FROM questions WHERE question = ?', (q['question'],))
            existing = cursor.fetchone()
            
            if existing:
                # Question exists in database, check if THIS USER has already seen/answered it
                question_id = existing[0]
                cursor.execute('SELECT id FROM history WHERE user_id = ? AND question_id = ?', (user_id, question_id))
                if cursor.fetchone() is None:
                    # User has NEVER seen this question before - safe to reuse
                    unique_questions.append({
                        'id': question_id,
                        'question': q['question'],
                        'answer': q['answer'],
                        'topic': topic,
                        'difficulty': difficulty
                    })
                else:
                    # User has already answered this question - skip it (NEVER show same question twice to same user)
                    print(f"Skipping question user has already seen: {q['question'][:50]}...")
            else:
                # Brand new question - create it in database
                cursor.execute(
                    'INSERT INTO questions (topic, difficulty, question, answer) VALUES (?, ?, ?, ?)',
                    (topic, difficulty, q['question'], q['answer'])
                )
                conn.commit()
                question_id = cursor.lastrowid
                unique_questions.append({
                    'id': question_id,
                    'question': q['question'],
                    'answer': q['answer'],
                    'topic': topic,
                    'difficulty': difficulty
                })
        
        conn.close()
        
        if len(unique_questions) < num_questions and _retry_count < MAX_RETRY_ATTEMPTS:
            remaining = num_questions - len(unique_questions)
            if remaining > 0:
                additional = generate_questions(topic, difficulty, remaining, user_id, subtopic, language, _retry_count + 1)
                unique_questions.extend(additional)
        
        return unique_questions
    
    except requests.exceptions.RequestException as e:
        raise Exception(f"API request failed: {str(e)}")
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse API response: {str(e)}")
    except Exception as e:
        raise Exception(f"Error generating questions: {str(e)}")


def generate_questions_from_material(material_content: str, num_questions: int, difficulty: str, user_id: int, language: str = "English") -> List[Dict]:
    api_key = os.environ.get('TOGETHER_API_KEY')
    api_url = os.environ.get('TOGETHER_URL', 'https://api.together.xyz/v1/chat/completions')
    model = os.environ.get('MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')

    if not api_key:
        raise ValueError("TOGETHER_API_KEY not found in environment variables")

    content_preview = material_content[:6000]

    recent_answers = get_recent_answers(user_id, limit=60)
    avoid_instruction = ""
    if recent_answers:
        avoid_instruction = f"\n\nDO NOT use any of these as answers (already seen by this user): {', '.join(recent_answers[:30])}.\nChoose different subjects from the material."

    difficulty_guidelines = {
        'Easy': 'EASY: Straightforward questions about the main ideas and key facts from the material.',
        'Medium': 'MEDIUM: Questions requiring understanding of specific details, relationships, and supporting facts from the material.',
        'Hard': 'HARD: Questions about subtle details, implications, or connections between concepts in the material.'
    }

    language_instruction = f"\n\nLANGUAGE: Write everything in {language}." if language != "English" else ""

    system_prompt = f"""You are a professional NAQT-style quiz bowl question writer. Generate questions BASED ON the study material provided by the user.

ANSWER PROTECTION (MOST CRITICAL RULE - ABSOLUTE):
- The answer MUST NEVER appear anywhere in the question text. This is the #1 rule.
- Do NOT mention the answer's name, title, or any form of it in any sentence.
- Use ONLY indirect references: "This scientist...", "This novel...", "He...", "She...", "It..."
- WRONG: "Albert Einstein developed relativity. Name this physicist." (answer IN question!)
- RIGHT: "This physicist developed the theory of relativity. Name this German-born physicist."

RULES:
- Create questions ONLY from facts and information found in the provided material
- Use NAQT pyramidal format: start with harder clues, end with easier giveaway clues
- Start each question with "This [type]..." format
- Write 5-7 sentences per question
- EVERY question MUST end with a complete closing sentence: "Name this [type]." or "Identify this [type]."
- NEVER leave a question incomplete or cut off mid-sentence - each question must be fully finished
- The answer must NOT appear anywhere in the question text
- Each question must have a DIFFERENT answer

DIFFICULTY: {difficulty_guidelines.get(difficulty, difficulty_guidelines['Medium'])}
{language_instruction}{avoid_instruction}

OUTPUT FORMAT:
Return ONLY a valid JSON array:
[
  {{"question": "<pyramidal question text>", "answer": "<specific answer>"}},
  {{"question": "<pyramidal question text>", "answer": "<specific answer>"}}
]

Return ONLY the JSON array, no additional text."""

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': f'Here is my study material:\n\n{content_preview}\n\nGenerate {num_questions} NAQT-style questions at {difficulty} difficulty based on this material. Return ONLY valid JSON.'}
        ],
        'temperature': 0.7,
        'max_tokens': 4000
    }

    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=60)

        if not response.text:
            raise Exception("API returned empty response")

        result = response.json()

        if 'error' in result:
            raise Exception(f"API error: {result['error']}")

        content = result.get('choices', [{}])[0].get('message', {}).get('content', '')

        if not content:
            raise Exception("API returned empty content")

        content = content.strip()
        if content.startswith('```json'):
            content = content[7:]
        if content.startswith('```'):
            content = content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()

        start = content.find('[')
        end = content.rfind(']')
        if start != -1 and end != -1:
            content = content[start:end + 1]

        questions_data = json.loads(content)

        if isinstance(questions_data, dict) and 'questions' in questions_data:
            questions_data = questions_data['questions']

        if not isinstance(questions_data, list):
            raise Exception("Invalid response format")

        all_seen_answers = get_all_user_answers(user_id)

        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        result_questions = []

        for q in questions_data:
            if not isinstance(q, dict) or 'question' not in q or 'answer' not in q:
                continue
            if not _validate_question_completeness(q['question']):
                print(f"REJECTED incomplete material question: {q['question'][:80]}...")
                continue
            if not _validate_answer_not_in_question(q['question'], q['answer']):
                print(f"REJECTED material question: Answer '{q['answer']}' found in question text.")
                continue
            if q['answer'].lower() in all_seen_answers:
                print(f"Skipping duplicate material answer: {q['answer']}")
                continue
            cursor.execute('SELECT id FROM questions WHERE question = ?', (q['question'],))
            existing = cursor.fetchone()
            if existing:
                question_id = existing[0]
                cursor.execute('SELECT id FROM history WHERE user_id = ? AND question_id = ?', (user_id, question_id))
                if cursor.fetchone() is not None:
                    print(f"Skipping material question user has already seen: {q['question'][:50]}...")
                    continue
            else:
                cursor.execute(
                    'INSERT INTO questions (topic, difficulty, question, answer, language) VALUES (?, ?, ?, ?, ?)',
                    ('Uploaded Material', difficulty, q['question'], q['answer'], language)
                )
                conn.commit()
                question_id = cursor.lastrowid
            result_questions.append({
                'id': question_id,
                'question': q['question'],
                'answer': q['answer'],
                'topic': 'Uploaded Material',
                'difficulty': difficulty
            })

        conn.close()
        return result_questions

    except requests.exceptions.RequestException as e:
        raise Exception(f"API request failed: {str(e)}")
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse response: {str(e)}")
    except Exception as e:
        raise Exception(f"Error generating questions from material: {str(e)}")


def generate_tournament_round(topic: str, num_tossups: int, user_id: int, language: str = "English") -> dict:
    api_key = os.environ.get('TOGETHER_API_KEY')
    api_url = os.environ.get('TOGETHER_URL', 'https://api.together.xyz/v1/chat/completions')
    model = os.environ.get('MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')
    if not api_key:
        raise ValueError("TOGETHER_API_KEY not found")

    recent_answers = get_recent_answers(user_id, limit=60)
    avoid = ""
    if recent_answers:
        avoid = f"\nAVOID these recent answers: {', '.join(recent_answers[:20])}. Use completely different answers."

    lang_inst = f"\nWrite everything in {language}." if language != "English" else ""

    system_prompt = f"""You are a professional NAQT-style quiz bowl question writer creating a tournament round.{lang_inst}

ANSWER PROTECTION (MOST CRITICAL RULE - ABSOLUTE):
- The answer MUST NEVER appear anywhere in the question text. This is the #1 rule.
- Do NOT mention the answer's name, title, or any form of it in any sentence of the question.
- Use ONLY indirect references: "This scientist...", "This novel...", "He...", "She...", "It..."
- WRONG: "Albert Einstein developed the theory of relativity. Name this physicist." (answer is IN the question!)
- RIGHT: "This physicist developed the theory of relativity. Name this German-born physicist."
- For bonus questions too: NEVER include the answer word in the question sentence.

A tournament round has TOSS-UP questions each followed by a 3-part BONUS set.

TOSS-UP FORMAT:
- Standard NAQT pyramidal question (5-7 sentences, hard clues first, easy clues last)
- Start with "This [type]..." format
- EVERY toss-up MUST end with a complete closing sentence: "Name this [type]." or "Identify this [type]."
- NEVER leave a question incomplete or cut off mid-sentence
- The answer must NOT appear in the toss-up text
- Worth 10 points

BONUS FORMAT (follows each toss-up):
- 3 related sub-questions on the SAME topic/theme as the toss-up
- Each bonus question is 1-2 sentences, direct and factual
- The answer to each bonus must NOT appear in that bonus question's text
- Each worth 10 points (30 total per bonus set)
- Bonus questions should be progressively harder: easy, medium, hard
- Label them as Part A, Part B, Part C

DIVERSITY: Cover different subtopics within {topic}. Each toss-up should be about a completely different subject.{avoid}

OUTPUT FORMAT - Return ONLY valid JSON:
[
  {{
    "tossup": {{"question": "<pyramidal question>", "answer": "<answer>"}},
    "bonus": [
      {{"part": "A", "question": "<easy bonus question>", "answer": "<answer>"}},
      {{"part": "B", "question": "<medium bonus question>", "answer": "<answer>"}},
      {{"part": "C", "question": "<hard bonus question>", "answer": "<answer>"}}
    ]
  }}
]

Generate {num_tossups} toss-up + bonus sets about {topic}."""

    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': f'Generate {num_tossups} tournament round toss-up + bonus sets about {topic}. Return ONLY valid JSON.'}
        ],
        'temperature': 0.8,
        'max_tokens': 6000
    }

    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=90)
        if not response.text:
            raise Exception("Empty API response")
        result = response.json()
        content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
        content = content.strip()
        if content.startswith('```'):
            content = content.split('\n', 1)[1] if '\n' in content else content[3:]
            if content.endswith('```'):
                content = content[:-3]
            content = content.strip()
        rounds = json.loads(content)
        if not isinstance(rounds, list):
            raise Exception("Response is not a list")
        all_seen_answers = get_all_user_answers(user_id)
        validated_rounds = []
        seen_answers = set()
        for r in rounds:
            tossup = r.get('tossup', {})
            tossup_answer = tossup.get('answer', '')
            tossup_text = tossup.get('question', '')
            if not _validate_question_completeness(tossup_text):
                print(f"REJECTED incomplete tournament tossup: {tossup_text[:80]}...")
                continue
            if not _validate_answer_not_in_question(tossup.get('question', ''), tossup_answer):
                print(f"REJECTED tournament tossup: Answer '{tossup_answer}' found in question text.")
                continue
            if tossup_answer.lower() in all_seen_answers:
                print(f"Skipping duplicate tournament tossup answer: {tossup_answer}")
                continue
            if tossup_answer.lower() in seen_answers:
                print(f"Skipping duplicate answer within packet: {tossup_answer}")
                continue
            seen_answers.add(tossup_answer.lower())
            bonus = r.get('bonus', [])
            clean_bonus = []
            for b in bonus:
                if _validate_answer_not_in_question(b.get('question', ''), b.get('answer', '')):
                    clean_bonus.append(b)
                else:
                    print(f"REJECTED tournament bonus: Answer '{b.get('answer')}' found in question text.")
            r['bonus'] = clean_bonus
            validated_rounds.append(r)
        if not validated_rounds:
            raise Exception("All generated tournament questions contained answers in text")
        return validated_rounds
    except json.JSONDecodeError:
        raise Exception("Failed to parse tournament round response")
    except Exception as e:
        raise Exception(f"Error generating tournament round: {str(e)}")


def generate_daily_challenge_questions(language: str = "English") -> list:
    api_key = os.environ.get('TOGETHER_API_KEY')
    api_url = os.environ.get('TOGETHER_URL', 'https://api.together.xyz/v1/chat/completions')
    model = os.environ.get('MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')
    if not api_key:
        raise ValueError("TOGETHER_API_KEY not found")

    topics = ["History", "Science", "Literature", "Geography", "Fine Arts"]
    import random as rnd
    rnd.shuffle(topics)

    lang_inst = f"\nWrite everything in {language}." if language != "English" else ""

    system_prompt = f"""You are a professional NAQT-style quiz bowl question writer creating a Daily Challenge.{lang_inst}

Create 5 NAQT-style pyramidal questions, one from each of these topics: {', '.join(topics)}.

ANSWER PROTECTION (MOST CRITICAL RULE - ABSOLUTE):
- The answer MUST NEVER appear anywhere in the question text. This is the #1 rule.
- Do NOT mention the answer's name, title, or any form of it in any sentence.
- Use ONLY indirect references: "This scientist...", "This novel...", "He...", "She...", "It..."
- WRONG: "Albert Einstein developed relativity. Name this physicist." (answer IN question!)
- RIGHT: "This physicist developed the theory of relativity. Name this German-born physicist."

RULES:
- Each question: 5-7 sentences, pyramidal format (hard clues first, easy last)
- Start with "This [type]..." format
- EVERY question MUST end with a complete closing sentence: "Name this [type]." or "Identify this [type]."
- NEVER leave a question incomplete or cut off mid-sentence
- Medium difficulty (competitive high school level)
- Each question on a DIFFERENT topic from the list
- Make questions interesting and educational
- The answer must NOT appear in the question text

OUTPUT: Return ONLY valid JSON array:
[
  {{"question": "<text>", "answer": "<answer>", "topic": "<topic>"}},
  ...
]"""

    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': 'Generate 5 daily challenge questions. Return ONLY valid JSON.'}
        ],
        'temperature': 0.9,
        'max_tokens': 4000
    }

    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=60)
        result = response.json()
        content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
        content = content.strip()
        if content.startswith('```'):
            content = content.split('\n', 1)[1] if '\n' in content else content[3:]
            if content.endswith('```'):
                content = content[:-3]
            content = content.strip()
        questions = json.loads(content)
        if not isinstance(questions, list):
            raise Exception("Not a list")
        validated = [q for q in questions if _validate_question_completeness(q.get('question', '')) and _validate_answer_not_in_question(q.get('question', ''), q.get('answer', ''))]
        for q in questions:
            if q not in validated:
                print(f"REJECTED daily challenge question: Answer '{q.get('answer')}' found in question text.")
        return validated if validated else questions[:5]
    except Exception as e:
        raise Exception(f"Error generating daily challenge: {str(e)}")


def generate_power_clues(topic, user_id=None, _retry_count=0):
    api_key = os.environ.get('TOGETHER_API_KEY')
    api_url = os.environ.get('TOGETHER_URL', 'https://api.together.xyz/v1/chat/completions')
    model = os.environ.get('MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')
    if not api_key:
        raise ValueError("TOGETHER_API_KEY not found")

    recent_answers = get_recent_answers(user_id, limit=60) if user_id else []
    avoid_instruction = ""
    if recent_answers:
        avoid_instruction = f"\n\nDO NOT use any of these as the answer (already seen by this user): {', '.join(recent_answers[:30])}.\nPick a completely different subject."

    prompt = f"""Generate a single NAQT-style pyramidal toss-up question about {topic}.
The question MUST be split into exactly 6 individual clues, ordered from HARDEST (most obscure) to EASIEST (giveaway).

Return ONLY valid JSON:
{{
  "answer": "the correct answer",
  "clues": [
    "Most obscure clue that only experts would recognize...",
    "Difficult clue requiring deep knowledge...",
    "Moderately difficult clue...",
    "Standard knowledge clue...",
    "Easy clue most students would know...",
    "Giveaway clue that directly identifies the answer..."
  ]
}}

CRITICAL RULES:
- The answer must NEVER appear in any clue text
- Clues must progress from hardest to easiest (pyramidal structure)
- Each clue should be 1-2 complete sentences - NEVER cut off mid-sentence
- The final (easiest) clue should end with "Name this [type]." or "Identify this [type]."
- The topic is: {topic}{avoid_instruction}"""

    response = requests.post(api_url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }, json={
        'model': model,
        'messages': [
            {'role': 'system', 'content': 'You generate NAQT scholar bowl questions in pyramidal clue format. Return ONLY valid JSON.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.8,
        'max_tokens': 800
    })

    if response.status_code != 200:
        raise Exception(f"API error: {response.status_code}")

    content = response.json()['choices'][0]['message']['content'].strip()
    start = content.find('{')
    end = content.rfind('}') + 1
    if start == -1 or end == 0:
        raise Exception("No JSON in response")
    data = json.loads(content[start:end])
    if 'clues' not in data or 'answer' not in data:
        raise Exception("Missing clues or answer")
    combined_clue_text = ' '.join(data['clues'])
    if not _validate_answer_not_in_question(combined_clue_text, data['answer']):
        print(f"REJECTED power clue: Answer '{data['answer']}' found in clue text, regenerating...")
        if _retry_count < 3:
            return generate_power_clues(topic, user_id, _retry_count + 1)
    if user_id and _retry_count < 3:
        all_seen = get_all_user_answers(user_id)
        if data['answer'].lower() in all_seen:
            print(f"Power clue answer '{data['answer']}' already seen by user, regenerating (attempt {_retry_count + 1})...")
            return generate_power_clues(topic, user_id, _retry_count + 1)
    return data


def grade_student_question(topic, difficulty, question_text, answer):
    api_key = os.environ.get('TOGETHER_API_KEY')
    api_url = os.environ.get('TOGETHER_URL', 'https://api.together.xyz/v1/chat/completions')
    model = os.environ.get('MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')
    if not api_key:
        raise ValueError("TOGETHER_API_KEY not found")

    prompt = f"""You are an expert NAQT question writer and judge. A student wrote the following scholar bowl question. Grade it.

Topic: {topic}
Intended Difficulty: {difficulty}
Question: {question_text}
Answer: {answer}

Return ONLY valid JSON:
{{
  "overall_score": 7.5,
  "pyramidal_structure": {{"score": 8, "feedback": "..."}},
  "clue_quality": {{"score": 7, "feedback": "..."}},
  "answer_protection": {{"score": 9, "feedback": "..."}},
  "difficulty_accuracy": {{"score": 7, "feedback": "..."}},
  "factual_accuracy": {{"score": 8, "feedback": "..."}},
  "overall_feedback": "Detailed 2-3 sentence overall assessment...",
  "improvement_suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}}

Score each category 1-10. Be constructive but honest."""

    response = requests.post(api_url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }, json={
        'model': model,
        'messages': [
            {'role': 'system', 'content': 'You are an NAQT question quality judge. Return ONLY valid JSON.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.5,
        'max_tokens': 800
    })

    if response.status_code != 200:
        raise Exception(f"API error: {response.status_code}")

    content = response.json()['choices'][0]['message']['content'].strip()
    start = content.find('{')
    end = content.rfind('}') + 1
    data = json.loads(content[start:end])
    return data


def generate_packet(packet_type, difficulty, user_id=None):
    api_key = os.environ.get('TOGETHER_API_KEY')
    api_url = os.environ.get('TOGETHER_URL', 'https://api.together.xyz/v1/chat/completions')
    model = os.environ.get('MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')
    if not api_key:
        raise ValueError("TOGETHER_API_KEY not found")

    recent_answers = get_recent_answers(user_id, limit=100) if user_id else []
    avoid_instruction = ""
    if recent_answers:
        avoid_instruction = f"\n\nCRITICAL - DO NOT REUSE THESE ANSWERS (the user has already seen them): {', '.join(recent_answers[:50])}.\nGenerate questions about completely different subjects, people, events, works, and concepts."

    categories = ["Science", "History", "Literature", "Fine Arts", "Social Science", "Geography", "Current Events", "Mythology"]

    if packet_type == 'lightning':
        count = 30
        prompt = f"""Generate {count} short-answer lightning round questions for a scholar bowl competition.
Distribute evenly across these categories: {', '.join(categories)}.
Difficulty: {difficulty}.

Return ONLY a JSON array:
[{{"category": "Science", "question": "Short question text...", "answer": "Answer"}}]

Rules:
- Each question should be 1-2 sentences max
- Answers should be 1-3 words
- Never include the answer in the question
- Mix categories evenly
- ALL {count} questions must have UNIQUE answers - no duplicate answers allowed{avoid_instruction}"""
    else:
        count = 10 if packet_type == 'half' else 20
        prompt = f"""Generate {count} NAQT-style toss-up questions for a scholar bowl packet.
Each toss-up should have a 3-part bonus question set.
Distribute evenly across: {', '.join(categories)}.
Difficulty: {difficulty}.

Return ONLY a JSON array:
[{{
  "number": 1,
  "category": "Science",
  "tossup": "Full pyramidal toss-up question text (5-7 sentences, hardest to easiest)...",
  "tossup_answer": "Answer",
  "bonus_leadin": "Bonus lead-in related to tossup topic...",
  "bonus_parts": [
    {{"part": "a", "question": "Bonus part A question...", "answer": "Answer A"}},
    {{"part": "b", "question": "Bonus part B question...", "answer": "Answer B"}},
    {{"part": "c", "question": "Bonus part C question...", "answer": "Answer C"}}
  ]
}}]

CRITICAL: Never include answers in question text. Use pyramidal structure for toss-ups.
ALL {count} toss-ups must have UNIQUE answers - no duplicate answers allowed.{avoid_instruction}"""

    response = requests.post(api_url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }, json={
        'model': model,
        'messages': [
            {'role': 'system', 'content': 'You generate competition-ready scholar bowl packets. Return ONLY valid JSON arrays.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.8,
        'max_tokens': 4000
    })

    if response.status_code != 200:
        raise Exception(f"API error: {response.status_code}")

    content = response.json()['choices'][0]['message']['content'].strip()
    start = content.find('[')
    end = content.rfind(']') + 1
    if start == -1 or end == 0:
        raise Exception("No JSON array in response")
    data = json.loads(content[start:end])

    validated_data = []
    for q in data:
        if packet_type == 'lightning':
            if not _validate_answer_not_in_question(q.get('question', ''), q.get('answer', '')):
                print(f"REJECTED packet question: Answer '{q.get('answer')}' found in question text.")
                continue
        else:
            if not _validate_question_completeness(q.get('tossup', '')):
                print(f"REJECTED incomplete packet tossup: {q.get('tossup', '')[:80]}...")
                continue
            if not _validate_answer_not_in_question(q.get('tossup', ''), q.get('tossup_answer', '')):
                print(f"REJECTED packet tossup: Answer '{q.get('tossup_answer')}' found in tossup text.")
                continue
            bonus_parts = q.get('bonus_parts', [])
            clean_bonus = [b for b in bonus_parts if _validate_answer_not_in_question(b.get('question', ''), b.get('answer', ''))]
            for b in bonus_parts:
                if b not in clean_bonus:
                    print(f"REJECTED packet bonus: Answer '{b.get('answer')}' found in bonus text.")
            q['bonus_parts'] = clean_bonus
        validated_data.append(q)
    data = validated_data

    if user_id:
        all_seen = get_all_user_answers(user_id)
        if packet_type == 'lightning':
            data = [q for q in data if q.get('answer', '').lower() not in all_seen]
        else:
            data = [q for q in data if q.get('tossup_answer', '').lower() not in all_seen]
        seen_answers = set()
        unique_data = []
        for q in data:
            ans = (q.get('answer') or q.get('tossup_answer', '')).lower()
            if ans not in seen_answers:
                seen_answers.add(ans)
                unique_data.append(q)
        data = unique_data

    return data


def analyze_question_autopsy(question_text, correct_answer, user_answer, topic):
    api_key = os.environ.get('TOGETHER_API_KEY')
    api_url = os.environ.get('TOGETHER_URL', 'https://api.together.xyz/v1/chat/completions')
    model = os.environ.get('MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')
    if not api_key:
        raise ValueError("TOGETHER_API_KEY not found")

    prompt = f"""A student was asked a scholar bowl question and got it wrong. Analyze the question to help them learn.

Topic: {topic}
Question: {question_text}
Correct Answer: {correct_answer}
Student's Wrong Answer: {user_answer}

Break down the question clue-by-clue and provide a learning analysis. Return ONLY valid JSON:
{{
  "clue_breakdown": [
    {{"clue_number": 1, "clue_text": "The first clue from the question...", "what_it_hinted": "This clue referred to X because..."}},
    {{"clue_number": 2, "clue_text": "The second clue...", "what_it_hinted": "This pointed toward..."}}
  ],
  "knowledge_gap": "The student likely confused X with Y because...",
  "mini_lesson": [
    "Key fact 1 about the correct answer",
    "Key fact 2 that distinguishes it from the wrong answer",
    "Key fact 3 for deeper understanding",
    "Key fact 4 connecting to broader context"
  ],
  "recovery_questions": [
    {{"question": "A targeted question about the correct answer...", "answer": "Answer"}},
    {{"question": "A question testing the distinguishing knowledge...", "answer": "Answer"}},
    {{"question": "A question on related context...", "answer": "Answer"}}
  ]
}}"""

    response = requests.post(api_url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }, json={
        'model': model,
        'messages': [
            {'role': 'system', 'content': 'You are an expert educational analyst. Break down quiz questions to help students understand their mistakes. Return ONLY valid JSON.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.6,
        'max_tokens': 1200
    })

    if response.status_code != 200:
        raise Exception(f"API error: {response.status_code}")

    content = response.json()['choices'][0]['message']['content'].strip()
    start = content.find('{')
    end = content.rfind('}') + 1
    if start == -1 or end == 0:
        raise Exception("No JSON in response")
    return json.loads(content[start:end])


def debate_respond(topic, user_side, rounds, user_argument):
    api_key = os.environ.get('TOGETHER_API_KEY')
    api_url = os.environ.get('TOGETHER_URL', 'https://api.together.xyz/v1/chat/completions')
    model = os.environ.get('MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')
    if not api_key:
        raise ValueError("TOGETHER_API_KEY not found")

    ai_side = "against" if user_side == "for" else "for"
    round_num = len(rounds) + 1
    history = ""
    for r in rounds:
        history += f"\nRound {r['round']}:\nUser ({user_side}): {r['user']}\nAI ({ai_side}): {r['ai']}\n"

    prompt = f"""You are in an academic debate about: "{topic}"
You are arguing {ai_side} the topic. The student is arguing {user_side} it.
This is round {round_num} of 3.
{history}
The student's latest argument:
"{user_argument}"

Respond with a strong counter-argument (3-5 sentences). Be factual, cite specific evidence, and directly address their points. Be challenging but educational.

Return ONLY valid JSON:
{{"response": "Your counter-argument text here..."}}"""

    response = requests.post(api_url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }, json={
        'model': model,
        'messages': [
            {'role': 'system', 'content': 'You are a knowledgeable academic debater. Argue your position firmly with evidence. Return ONLY valid JSON.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.7,
        'max_tokens': 500
    })

    if response.status_code != 200:
        raise Exception(f"API error: {response.status_code}")

    content = response.json()['choices'][0]['message']['content'].strip()
    start = content.find('{')
    end = content.rfind('}') + 1
    return json.loads(content[start:end])


def debate_score(topic, user_side, rounds):
    api_key = os.environ.get('TOGETHER_API_KEY')
    api_url = os.environ.get('TOGETHER_URL', 'https://api.together.xyz/v1/chat/completions')
    model = os.environ.get('MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')
    if not api_key:
        raise ValueError("TOGETHER_API_KEY not found")

    ai_side = "against" if user_side == "for" else "for"
    history = ""
    for r in rounds:
        history += f"\nRound {r['round']}:\nStudent ({user_side}): {r['user']}\nAI ({ai_side}): {r['ai']}\n"

    prompt = f"""Score this academic debate about: "{topic}"
The student argued {user_side} the topic.
{history}

Score the STUDENT's performance. Return ONLY valid JSON:
{{
  "factual_accuracy": {{"score": 7, "feedback": "The student correctly cited..."}},
  "reasoning_quality": {{"score": 6, "feedback": "Their logical chain was..."}},
  "evidence_use": {{"score": 8, "feedback": "They effectively used..."}},
  "overall_score": 7.0,
  "verdict": "Well-argued debate. The student showed strong knowledge of...",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["area to improve 1", "area to improve 2"]
}}

Score each 1-10. Be constructive and educational."""

    response = requests.post(api_url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }, json={
        'model': model,
        'messages': [
            {'role': 'system', 'content': 'You are a fair academic debate judge. Score student performance honestly. Return ONLY valid JSON.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.5,
        'max_tokens': 800
    })

    if response.status_code != 200:
        raise Exception(f"API error: {response.status_code}")

    content = response.json()['choices'][0]['message']['content'].strip()
    start = content.find('{')
    end = content.rfind('}') + 1
    return json.loads(content[start:end])


def generate_timeline_events(topic):
    api_key = os.environ.get('TOGETHER_API_KEY')
    api_url = os.environ.get('TOGETHER_URL', 'https://api.together.xyz/v1/chat/completions')
    model = os.environ.get('MODEL', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')
    if not api_key:
        raise ValueError("TOGETHER_API_KEY not found")

    prompt = f"""Generate a chronological timeline of 10 important events related to: "{topic}"

Return ONLY a valid JSON array of events in CORRECT chronological order:
[
  {{"event": "Name/description of the event", "date": "1776", "context": "Brief 1-2 sentence explanation of significance"}},
  {{"event": "Another event", "date": "1789", "context": "Why this matters..."}}
]

RULES:
- Exactly 10 events
- Events must be in correct chronological order (earliest first)
- Dates can be years, specific dates, or approximate ("c. 500 BC")
- Events should be significant and well-known enough for students to potentially know
- Cover a reasonable time span for the topic
- Each event description should be clear and concise (not give away the date)"""

    response = requests.post(api_url, headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }, json={
        'model': model,
        'messages': [
            {'role': 'system', 'content': 'You generate educational timeline events. Return ONLY valid JSON arrays.'},
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.7,
        'max_tokens': 1200
    })

    if response.status_code != 200:
        raise Exception(f"API error: {response.status_code}")

    content = response.json()['choices'][0]['message']['content'].strip()
    start = content.find('[')
    end = content.rfind(']') + 1
    if start == -1 or end == 0:
        raise Exception("No JSON array in response")
    return json.loads(content[start:end])
