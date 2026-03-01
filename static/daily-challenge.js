let questions = [];
let currentIndex = 0;
let correctCount = 0;
let score = 0;
let startTime = 0;
let timerInterval = null;
let elapsedSeconds = 0;
let alreadyCompleted = false;

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

async function loadDailyChallenge() {
    try {
        const response = await fetch('/api/daily-challenge');
        const data = await response.json();

        if (!data.success) {
            document.getElementById('loading-state').textContent = data.error || 'Failed to load challenge';
            return;
        }

        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('challenge-header').style.display = 'flex';

        const dateStr = new Date(data.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        document.getElementById('challenge-date').textContent = dateStr;

        questions = data.questions;

        if (data.already_completed && data.user_result) {
            alreadyCompleted = true;
            showCompletedState(data.user_result);
        } else {
            startChallenge();
        }

        loadLeaderboard();
    } catch (error) {
        document.getElementById('loading-state').textContent = 'Error loading challenge. Please try again.';
    }
}

function showCompletedState(result) {
    document.getElementById('already-completed').style.display = 'block';
    document.getElementById('result-score').textContent = result.score;
    document.getElementById('result-correct').textContent = result.correct_answers + '/' + result.total_questions;
    document.getElementById('result-time').textContent = formatTime(result.time_taken);
    document.getElementById('challenge-timer').style.display = 'none';
}

function startChallenge() {
    document.getElementById('questions-area').style.display = 'block';
    document.getElementById('total-q-num').textContent = questions.length;
    startTime = Date.now();
    startTimer();
    showQuestion(0);
}

function startTimer() {
    timerInterval = setInterval(() => {
        elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById('timer-display').textContent = formatTime(elapsedSeconds);
    }, 1000);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
}

function showQuestion(index) {
    currentIndex = index;
    const q = questions[index];
    document.getElementById('current-q-num').textContent = index + 1;
    document.getElementById('progress-fill').style.width = ((index) / questions.length * 100) + '%';
    document.getElementById('question-topic').textContent = q.topic || 'Mixed';
    document.getElementById('question-text').textContent = q.question;
    document.getElementById('answer-input').value = '';
    document.getElementById('answer-input').disabled = false;
    document.getElementById('submit-answer-btn').disabled = false;
    document.getElementById('submit-answer-btn').style.display = '';
    document.getElementById('answer-feedback').style.display = 'none';
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('answer-input').focus();
}

function submitAnswer() {
    const input = document.getElementById('answer-input');
    const userAnswer = input.value.trim();
    if (!userAnswer) return;

    input.disabled = true;
    document.getElementById('submit-answer-btn').disabled = true;

    const q = questions[currentIndex];
    const correctAnswer = q.answer;
    const isCorrect = checkAnswer(userAnswer, correctAnswer);

    if (isCorrect) {
        correctCount++;
        score += 20;
    }

    const feedback = document.getElementById('answer-feedback');
    feedback.style.display = 'block';
    if (isCorrect) {
        feedback.className = 'daily-feedback correct';
        feedback.innerHTML = '<strong>Correct!</strong> ' + correctAnswer;
    } else {
        feedback.className = 'daily-feedback incorrect';
        feedback.innerHTML = '<strong>Incorrect.</strong> The answer was: <strong>' + correctAnswer + '</strong>';
    }

    document.getElementById('submit-answer-btn').style.display = 'none';

    if (currentIndex < questions.length - 1) {
        document.getElementById('next-btn').style.display = 'block';
    } else {
        setTimeout(finishChallenge, 1500);
    }
}

function checkAnswer(userAnswer, correctAnswer) {
    const normalize = (s) => s.toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const userNorm = normalize(userAnswer);
    const accepted = correctAnswer.replace(/;/g, '/').split('/').map(a => normalize(a.trim())).filter(a => a);

    for (const ans of accepted) {
        if (userNorm === ans) return true;
        if (ans.length >= 3 && userNorm.length >= 3) {
            if (ans.includes(userNorm) || userNorm.includes(ans)) {
                const shorter = Math.min(userNorm.length, ans.length);
                const longer = Math.max(userNorm.length, ans.length);
                if (shorter / longer >= 0.5) return true;
            }
        }
        const dist = levenshtein(userNorm, ans);
        const maxLen = Math.max(userNorm.length, ans.length);
        if (maxLen > 0 && (1 - dist / maxLen) >= 0.65) return true;
    }
    return false;
}

function levenshtein(a, b) {
    if (a.length < b.length) return levenshtein(b, a);
    if (b.length === 0) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 0; i < a.length; i++) {
        const curr = [i + 1];
        for (let j = 0; j < b.length; j++) {
            curr.push(Math.min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (a[i] === b[j] ? 0 : 1)));
        }
        prev = curr;
    }
    return prev[b.length];
}

function nextQuestion() {
    if (currentIndex < questions.length - 1) {
        showQuestion(currentIndex + 1);
    }
}

async function finishChallenge() {
    clearInterval(timerInterval);
    const totalTime = Math.floor((Date.now() - startTime) / 1000);

    document.getElementById('questions-area').style.display = 'none';
    document.getElementById('final-results').style.display = 'block';
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-correct').textContent = correctCount + '/' + questions.length;
    document.getElementById('final-time').textContent = formatTime(totalTime);
    document.getElementById('progress-fill').style.width = '100%';

    try {
        await fetch('/api/daily-challenge/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                score: score,
                correct_answers: correctCount,
                total_questions: questions.length,
                time_taken: totalTime
            })
        });
    } catch (e) {
        console.error('Failed to submit results:', e);
    }

    loadLeaderboard();
}

async function loadLeaderboard() {
    try {
        const response = await fetch('/api/daily-challenge/leaderboard');
        const data = await response.json();

        document.getElementById('leaderboard-section').style.display = 'block';

        if (!data.success || !data.leaderboard || data.leaderboard.length === 0) {
            document.getElementById('leaderboard-empty').style.display = 'block';
            document.getElementById('leaderboard-list').style.display = 'none';
            return;
        }

        document.getElementById('leaderboard-empty').style.display = 'none';
        const list = document.getElementById('leaderboard-list');
        list.style.display = 'block';
        list.innerHTML = '';

        data.leaderboard.forEach(entry => {
            const item = document.createElement('div');
            item.className = 'daily-leaderboard-item';

            let rankClass = '';
            if (entry.rank === 1) rankClass = 'gold';
            else if (entry.rank === 2) rankClass = 'silver';
            else if (entry.rank === 3) rankClass = 'bronze';

            item.innerHTML =
                '<div class="daily-lb-rank ' + rankClass + '">' + entry.rank + '</div>' +
                '<div class="daily-lb-info">' +
                    '<div class="daily-lb-name">' + escapeHtml(entry.full_name || entry.username) + '</div>' +
                    '<div class="daily-lb-details">' + entry.correct_answers + '/' + entry.total_questions + ' correct &middot; ' + formatTime(entry.time_taken) + '</div>' +
                '</div>' +
                '<div class="daily-lb-score">' + entry.score + ' pts</div>';

            list.appendChild(item);
        });
    } catch (e) {
        console.error('Failed to load leaderboard:', e);
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const submitBtn = document.getElementById('submit-answer-btn');
        const nextBtn = document.getElementById('next-btn');
        if (nextBtn && nextBtn.style.display !== 'none') {
            nextQuestion();
        } else if (submitBtn && !submitBtn.disabled && submitBtn.style.display !== 'none') {
            submitAnswer();
        }
    }
});

(async function init() {
    const authed = await checkAuth();
    if (authed) {
        loadDailyChallenge();
    }
})();
