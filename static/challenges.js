let currentChallengeId = null;
let challengeQuestions = [];
let userAnswers = [];

async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        if (data.logged_in) {
            document.getElementById('username-display').textContent = data.username;
            loadChallenges();
        } else {
            window.location.href = '/home';
        }
    } catch (e) {
        window.location.href = '/home';
    }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/home';
}

function toggleMenu() {
    document.getElementById('nav-menu').classList.toggle('show');
}

function switchH2HTab(tab, btn) {
    document.querySelectorAll('.h2h-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.h2h-tab-content').forEach(c => c.style.display = 'none');
    btn.classList.add('active');
    document.getElementById('tab-' + tab).style.display = 'block';
    document.getElementById('h2h-play-area').style.display = 'none';
    document.getElementById('h2h-results-area').style.display = 'none';
}

async function createChallenge() {
    const opponent = document.getElementById('opponent-username').value.trim();
    const topic = document.getElementById('challenge-topic').value.trim() || 'General Knowledge';
    const difficulty = document.getElementById('challenge-difficulty').value;
    const errorDiv = document.getElementById('create-error');
    const successDiv = document.getElementById('create-success');
    const btn = document.getElementById('create-challenge-btn');

    errorDiv.textContent = '';
    successDiv.textContent = '';

    if (!opponent) {
        errorDiv.textContent = 'Please enter an opponent username.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating challenge...';

    try {
        const response = await fetch('/api/h2h/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ opponent, topic, difficulty })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            successDiv.textContent = 'Challenge sent successfully! Your opponent will see it in their incoming challenges.';
            document.getElementById('opponent-username').value = '';
            loadChallenges();
        } else {
            errorDiv.textContent = data.error || 'Failed to create challenge.';
        }
    } catch (e) {
        errorDiv.textContent = 'Error creating challenge. Please try again.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Challenge';
    }
}

async function loadChallenges() {
    try {
        const response = await fetch('/api/h2h/pending');
        const data = await response.json();
        if (!data.success) return;

        const challenges = data.challenges;
        const incoming = challenges.filter(c => c.role === 'opponent' && c.status === 'pending');
        const all = challenges;

        const badge = document.getElementById('incoming-badge');
        if (incoming.length > 0) {
            badge.textContent = incoming.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }

        renderIncoming(incoming);
        renderMyChallenges(all);
    } catch (e) {
        console.error('Error loading challenges:', e);
    }
}

function renderIncoming(challenges) {
    const list = document.getElementById('incoming-list');
    const empty = document.getElementById('incoming-empty');

    if (challenges.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    list.innerHTML = challenges.map(c => `
        <div class="h2h-challenge-card h2h-incoming">
            <div class="h2h-challenge-info">
                <div class="h2h-challenge-title">${c.challenger} challenged you!</div>
                <div class="h2h-challenge-meta">${c.topic} &bull; ${c.difficulty} &bull; ${formatDate(c.created_at)}</div>
            </div>
            <div class="h2h-challenge-actions">
                <button onclick="acceptChallenge(${c.id})" class="h2h-accept-btn">Accept</button>
                <button onclick="declineChallenge(${c.id})" class="h2h-decline-btn">Decline</button>
            </div>
        </div>
    `).join('');
}

function renderMyChallenges(challenges) {
    const list = document.getElementById('my-challenges-list');
    const empty = document.getElementById('my-empty');

    if (challenges.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    list.innerHTML = challenges.map(c => {
        const opponent = c.role === 'challenger' ? c.opponent : c.challenger;
        let statusLabel = '';
        let actionBtn = '';

        if (c.status === 'pending') {
            if (c.role === 'challenger') {
                statusLabel = '<span class="h2h-status h2h-status-pending">Waiting for opponent</span>';
            } else {
                statusLabel = '<span class="h2h-status h2h-status-pending">Pending your acceptance</span>';
                actionBtn = `<button onclick="acceptChallenge(${c.id})" class="h2h-accept-btn">Accept</button>`;
            }
        } else if (c.status === 'accepted') {
            if (c.your_score !== null) {
                statusLabel = '<span class="h2h-status h2h-status-waiting">Waiting for opponent to play</span>';
            } else {
                statusLabel = '<span class="h2h-status h2h-status-ready">Ready to play!</span>';
                actionBtn = `<button onclick="playChallenge(${c.id})" class="h2h-accept-btn">Play Now</button>`;
            }
        } else if (c.status === 'completed') {
            const yourScore = c.your_score || 0;
            const theirScore = c.their_score || 0;
            let resultClass = 'h2h-status-draw';
            let resultText = 'Draw';
            if (yourScore > theirScore) { resultClass = 'h2h-status-won'; resultText = 'You Won!'; }
            else if (yourScore < theirScore) { resultClass = 'h2h-status-lost'; resultText = 'You Lost'; }
            statusLabel = `<span class="h2h-status ${resultClass}">${resultText} (${yourScore} - ${theirScore})</span>`;
            actionBtn = `<button onclick="viewResults(${c.id})" class="secondary-btn" style="padding:8px 16px;font-size:0.85rem;">View Results</button>`;
        } else if (c.status === 'declined') {
            statusLabel = '<span class="h2h-status h2h-status-declined">Declined</span>';
        }

        return `
            <div class="h2h-challenge-card">
                <div class="h2h-challenge-info">
                    <div class="h2h-challenge-title">vs ${opponent}</div>
                    <div class="h2h-challenge-meta">${c.topic} &bull; ${c.difficulty} &bull; ${formatDate(c.created_at)}</div>
                    ${statusLabel}
                </div>
                <div class="h2h-challenge-actions">
                    ${actionBtn}
                </div>
            </div>
        `;
    }).join('');
}

async function acceptChallenge(id) {
    try {
        const response = await fetch('/api/h2h/accept/' + id, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            loadChallenges();
            playChallenge(id);
        } else {
            alert(data.error || 'Failed to accept challenge.');
        }
    } catch (e) {
        alert('Error accepting challenge.');
    }
}

async function declineChallenge(id) {
    if (!confirm('Are you sure you want to decline this challenge?')) return;
    try {
        const response = await fetch('/api/h2h/decline/' + id, { method: 'POST' });
        const data = await response.json();
        if (!data.success) {
            alert(data.error || 'Failed to decline challenge');
            return;
        }
        loadChallenges();
    } catch (e) {
        alert('Error declining challenge');
    }
}

async function playChallenge(id) {
    currentChallengeId = id;
    userAnswers = [];

    try {
        const response = await fetch('/api/h2h/questions/' + id);
        const data = await response.json();

        if (!data.success) {
            alert(data.error || 'Cannot load challenge questions.');
            return;
        }

        if (data.already_played) {
            alert('You have already played this challenge. Waiting for your opponent.');
            return;
        }

        challengeQuestions = data.questions;

        document.querySelectorAll('.h2h-tab-content').forEach(c => c.style.display = 'none');
        document.getElementById('h2h-results-area').style.display = 'none';
        document.getElementById('h2h-play-area').style.display = 'block';

        document.getElementById('play-title').textContent = 'Challenge #' + id;
        document.getElementById('play-subtitle').textContent = 'Answer all 5 questions, then submit your answers.';

        const container = document.getElementById('h2h-questions-container');
        container.innerHTML = challengeQuestions.map((q, i) => `
            <div class="question-box h2h-question" id="h2h-q-${i}">
                <div class="question-header">
                    <strong>Question ${i + 1} of ${challengeQuestions.length}</strong>
                    <span class="question-meta">${q.topic || ''} &bull; ${q.difficulty || ''}</span>
                </div>
                <div class="question-text">${q.question}</div>
                <div class="answer-section">
                    <label style="font-weight:600;color:#1e3a8a;">Your Answer:</label>
                    <input type="text" class="h2h-answer-input" id="h2h-answer-${i}" placeholder="Type your answer..." style="margin-top:8px;">
                </div>
            </div>
        `).join('');

        document.getElementById('h2h-submit-area').style.display = 'block';
    } catch (e) {
        alert('Error loading challenge.');
    }
}

async function submitChallengeAnswers() {
    const btn = document.getElementById('submit-challenge-btn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    let score = 0;
    const results = [];

    for (let i = 0; i < challengeQuestions.length; i++) {
        const input = document.getElementById('h2h-answer-' + i);
        const userAnswer = input ? input.value.trim() : '';
        const correctAnswer = challengeQuestions[i].answer;

        let isCorrect = false;
        try {
            const resp = await fetch('/api/check-answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question_id: challengeQuestions[i].id, user_answer: userAnswer })
            });
            const checkData = await resp.json();
            isCorrect = checkData.correct;
        } catch (e) {
            isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);
        }

        if (isCorrect) score++;
        results.push({ userAnswer, correctAnswer, isCorrect });

        const qBox = document.getElementById('h2h-q-' + i);
        if (qBox) {
            qBox.style.borderLeft = '5px solid ' + (isCorrect ? '#48bb78' : '#f5576c');
            const ansSection = qBox.querySelector('.answer-section');
            ansSection.innerHTML += `
                <div class="answer-text" style="margin-top:10px; border-left-color: ${isCorrect ? '#48bb78' : '#f5576c'}; background: ${isCorrect ? 'rgba(72,187,120,0.1)' : 'rgba(245,87,108,0.1)'};">
                    <div>${isCorrect ? '&#10004; Correct!' : '&#10008; Incorrect'}</div>
                    <div style="margin-top:5px;">Answer: <strong>${correctAnswer}</strong></div>
                </div>
            `;
        }
    }

    try {
        await fetch('/api/h2h/submit/' + currentChallengeId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score })
        });
    } catch (e) {}

    document.getElementById('h2h-submit-area').style.display = 'none';

    const inputs = document.querySelectorAll('.h2h-answer-input');
    inputs.forEach(inp => inp.disabled = true);

    btn.disabled = false;
    btn.textContent = 'Submit Answers';

    setTimeout(() => {
        loadChallenges();
        showResultsAfterPlay(score);
    }, 2000);
}

function showResultsAfterPlay(yourScore) {
    document.getElementById('h2h-play-area').style.display = 'none';
    document.getElementById('h2h-results-area').style.display = 'block';

    document.getElementById('result-you-name').textContent = 'You';
    document.getElementById('result-you-score').textContent = yourScore + '/' + challengeQuestions.length;
    document.getElementById('result-them-name').textContent = 'Opponent';
    document.getElementById('result-them-score').textContent = 'Pending...';
    document.getElementById('result-verdict').textContent = 'Your score has been submitted. Waiting for your opponent to play!';
    document.getElementById('result-verdict').className = 'h2h-verdict h2h-verdict-waiting';
}

async function viewResults(id) {
    try {
        const response = await fetch('/api/h2h/pending');
        const data = await response.json();
        if (!data.success) return;

        const challenge = data.challenges.find(c => c.id === id);
        if (!challenge) return;

        document.querySelectorAll('.h2h-tab-content').forEach(c => c.style.display = 'none');
        document.getElementById('h2h-play-area').style.display = 'none';
        document.getElementById('h2h-results-area').style.display = 'block';

        const opponent = challenge.role === 'challenger' ? challenge.opponent : challenge.challenger;
        const yourScore = challenge.your_score || 0;
        const theirScore = challenge.their_score || 0;

        document.getElementById('result-you-name').textContent = 'You';
        document.getElementById('result-you-score').textContent = yourScore + '/5';
        document.getElementById('result-them-name').textContent = opponent;
        document.getElementById('result-them-score').textContent = theirScore + '/5';

        const verdict = document.getElementById('result-verdict');
        if (yourScore > theirScore) {
            verdict.textContent = 'You won! Congratulations!';
            verdict.className = 'h2h-verdict h2h-verdict-won';
        } else if (yourScore < theirScore) {
            verdict.textContent = 'You lost. Better luck next time!';
            verdict.className = 'h2h-verdict h2h-verdict-lost';
        } else {
            verdict.textContent = "It's a draw!";
            verdict.className = 'h2h-verdict h2h-verdict-draw';
        }
    } catch (e) {}
}

function backToList() {
    document.getElementById('h2h-results-area').style.display = 'none';
    document.getElementById('h2h-play-area').style.display = 'none';
    document.querySelectorAll('.h2h-tab-content').forEach(c => c.style.display = 'none');
    document.getElementById('tab-my').style.display = 'block';
    document.querySelectorAll('.h2h-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.h2h-tab')[2].classList.add('active');
    loadChallenges();
}

function normalizeAnswer(text) {
    return text.toLowerCase().trim().replace(/^(the|a|an)\s+/, '').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return diff + 'm ago';
    if (diff < 1440) return Math.floor(diff / 60) + 'h ago';
    return d.toLocaleDateString();
}

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});
