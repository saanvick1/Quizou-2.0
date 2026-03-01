async function checkAuth() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        if (!data.logged_in) {
            window.location.href = '/';
            return false;
        }
        document.getElementById('username-display').textContent = data.username;
        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/';
        return false;
    }
}

function logout() {
    fetch('/api/logout', { method: 'POST' })
        .then(() => window.location.href = '/');
}

function toggleMenu() {
    document.getElementById('nav-menu').classList.toggle('active');
}

let competitionData = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let aiAnswers = [];
let startTime = null;
let userScore = 0;
let aiScore = 0;

async function loadSuggestedTopics() {
    try {
        const response = await fetch('/api/user-topics');
        const data = await response.json();
        
        const container = document.getElementById('suggested-topics');
        
        if (data.success && data.topics && data.topics.length > 0) {
            container.innerHTML = data.topics.map(t => 
                `<span class="topic-badge">${t.topic} (${t.count})</span>`
            ).join('');
        } else {
            container.innerHTML = '<p class="info-text">Start practicing to see your favorite topics here!</p>';
        }
    } catch (error) {
        console.error('Error loading topics:', error);
        document.getElementById('suggested-topics').innerHTML = '<p class="info-text">Unable to load topics</p>';
    }
}

function simulateAIAnswer(question, difficulty) {
    const baseAccuracy = {
        'Easy': 0.85,
        'Medium': 0.70,
        'Hard': 0.55
    };
    
    const accuracy = baseAccuracy[difficulty] || 0.70;
    const correct = Math.random() < accuracy;
    
    const timeRange = difficulty === 'Easy' ? [3000, 6000] : 
                      difficulty === 'Medium' ? [5000, 10000] : 
                      [8000, 15000];
    const timeTaken = Math.floor(Math.random() * (timeRange[1] - timeRange[0])) + timeRange[0];
    
    return {
        correct: correct,
        timeTaken: timeTaken,
        answer: correct ? question.answer : `Wrong answer ${Math.floor(Math.random() * 100)}`
    };
}

async function startCompetition(evt) {
    const type = document.getElementById('competition-type').value;
    const questions = parseInt(document.getElementById('num-questions').value);
    
    const button = evt.target;
    button.disabled = true;
    button.textContent = 'Generating competition...';
    
    try {
        const response = await fetch('/api/competition-simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, questions })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            showError(data.error || 'Failed to start competition');
            button.disabled = false;
            button.textContent = 'Start Competition';
            return;
        }
        
        competitionData = data;
        currentQuestionIndex = 0;
        userAnswers = [];
        aiAnswers = [];
        userScore = 0;
        aiScore = 0;
        startTime = Date.now();
        
        document.getElementById('competition-setup').style.display = 'none';
        document.getElementById('competition-session').style.display = 'block';
        document.getElementById('scoreboard').style.display = 'flex';
        
        updateScoreboard();
        displayCompetitionInfo();
        displayQuestion();
        
    } catch (error) {
        console.error('Error starting competition:', error);
        showError('Failed to start competition');
        button.disabled = false;
        button.textContent = 'Start Competition';
    }
}

function displayCompetitionInfo() {
    const info = competitionData.competition_info;
    const infoDiv = document.getElementById('competition-info');
    
    infoDiv.innerHTML = `
        <div class="competition-header">
            <h3>${info.type.toUpperCase()} Competition</h3>
            <p>Difficulty: ${info.difficulty} | ${info.time_pressure ? `Time: ${info.recommended_time_per_question}s per question` : 'No time limit'}</p>
        </div>
    `;
}

function displayQuestion() {
    const question = competitionData.questions[currentQuestionIndex];
    const container = document.getElementById('questions-container');
    
    container.innerHTML = `
        <div class="question-card">
            <div class="question-header">
                <span class="question-number">Question ${currentQuestionIndex + 1} of ${competitionData.questions.length}</span>
                <span class="question-topic">${question.topic}</span>
            </div>
            
            <div class="question-text">${question.question}</div>
            
            <div class="answer-section">
                <input type="text" id="answer-input" placeholder="Type your answer..." 
                       onkeypress="if(event.key === 'Enter') submitAnswer()">
                <button onclick="submitAnswer()" class="submit-btn">Submit Answer</button>
            </div>
        </div>
    `;
    
    document.getElementById('answer-input').focus();
}

function submitAnswer() {
    const answerInput = document.getElementById('answer-input');
    const userAnswer = answerInput.value.trim();
    
    const question = competitionData.questions[currentQuestionIndex];
    const correct = userAnswer.toLowerCase() === question.answer.toLowerCase();
    
    if (correct) {
        userScore++;
        updateScoreboard();
    }
    
    userAnswers.push({
        question: question.question,
        correct_answer: question.answer,
        user_answer: userAnswer,
        correct: correct,
        topic: question.topic
    });
    
    const aiResult = simulateAIAnswer(question, question.difficulty);
    
    setTimeout(() => {
        if (aiResult.correct) {
            aiScore++;
        }
        aiAnswers.push(aiResult);
        updateScoreboard();
        
        if (aiAnswers.length === competitionData.questions.length) {
            displayResults();
        }
    }, aiResult.timeTaken);
    
    currentQuestionIndex++;
    
    if (currentQuestionIndex < competitionData.questions.length) {
        displayQuestion();
    }
}

function updateScoreboard() {
    document.getElementById('user-score').textContent = userScore;
    document.getElementById('ai-score').textContent = aiScore;
}

function displayResults() {
    const container = document.getElementById('results-container');
    const questionsContainer = document.getElementById('questions-container');
    questionsContainer.style.display = 'none';
    
    const correctCount = userAnswers.filter(a => a.correct).length;
    const totalQuestions = userAnswers.length;
    const score = ((correctCount / totalQuestions) * 100).toFixed(1);
    const timeElapsed = Math.floor((Date.now() - startTime) / 1000);
    
    container.innerHTML = `
        <div class="results-card">
            <h2>Competition Complete!</h2>
            
            <div class="score-summary">
                <div class="score-big">${score}%</div>
                <p>${correctCount} out of ${totalQuestions} correct</p>
                <p>Time: ${formatTime(timeElapsed)}</p>
            </div>
            
            <h3>Question Review</h3>
            <div class="answers-review">
                ${userAnswers.map((answer, idx) => `
                    <div class="answer-review-item ${answer.correct ? 'correct' : 'incorrect'}">
                        <div class="review-header">
                            <span class="review-number">Q${idx + 1}</span>
                            <span class="review-topic">${answer.topic}</span>
                            <span class="review-result">${answer.correct ? 'Correct' : 'Incorrect'}</span>
                        </div>
                        <p class="review-question">${answer.question}</p>
                        <p class="review-answer correct-answer">Correct: ${answer.correct_answer}</p>
                        ${!answer.correct ? `<p class="review-answer your-answer">Your answer: ${answer.user_answer || 'No answer'}</p>` : ''}
                    </div>
                `).join('')}
            </div>
            
            <div class="results-actions">
                <button onclick="location.reload()" class="action-btn">Try Another Competition</button>
                <button onclick="location.href='/home'" class="action-btn secondary">Back to Home</button>
            </div>
        </div>
    `;
    
    container.style.display = 'block';
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.generator-card').insertBefore(errorDiv, document.querySelector('.generator-card').firstChild);
    setTimeout(() => errorDiv.remove(), 5000);
}

window.onload = async function() {
    fetch('/api/track-pageview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({page: window.location.pathname}) }).catch(() => {});
    if (await checkAuth()) {
        loadSuggestedTopics();
    }
};
