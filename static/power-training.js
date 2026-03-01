let currentClues = [];
let currentAnswer = '';
let currentTopic = '';
let clueIndex = 0;
let sessionResults = [];
let questionNumber = 0;
const QUESTIONS_PER_SESSION = 5;

function getPointsForClue(idx, totalClues) {
    if (idx < 2) return 15;
    if (idx < 4) return 10;
    return 5;
}

async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        if (data.logged_in) {
            const hw = document.getElementById('header-welcome');
            const hu = document.getElementById('header-username');
            const ha = document.getElementById('header-actions');
            if (hw) hw.style.display = 'inline';
            if (hu) hu.textContent = data.username;
            if (ha) ha.style.display = 'flex';
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

async function startTraining() {
    const topic = document.getElementById('pt-topic').value.trim();
    const errorDiv = document.getElementById('start-error');
    errorDiv.textContent = '';

    if (!topic) {
        errorDiv.textContent = 'Please enter a topic.';
        return;
    }

    currentTopic = topic;
    questionNumber = 0;
    sessionResults = [];

    document.getElementById('setup-section').style.display = 'none';
    document.getElementById('training-section').style.display = 'block';
    document.getElementById('summary-section').style.display = 'none';

    await loadNextQuestion();
}

async function loadNextQuestion() {
    if (questionNumber >= QUESTIONS_PER_SESSION) {
        showSummary();
        return;
    }

    questionNumber++;
    clueIndex = 0;

    document.getElementById('pt-q-num').textContent = questionNumber;
    document.getElementById('pt-topic-display').textContent = currentTopic;
    document.getElementById('pt-clues-list').innerHTML = '';
    document.getElementById('pt-result').style.display = 'none';
    document.getElementById('pt-next-q-btn').style.display = 'none';
    document.getElementById('pt-answer-section').style.display = 'none';
    document.getElementById('pt-action-buttons').style.display = 'flex';

    const btn = document.getElementById('start-btn');
    const nextClueBtn = document.getElementById('next-clue-btn');
    const buzzBtn = document.getElementById('buzz-btn');
    nextClueBtn.disabled = true;
    buzzBtn.disabled = true;

    try {
        const response = await fetch('/api/power-training/generate?topic=' + encodeURIComponent(currentTopic));
        const data = await response.json();

        if (!response.ok || !data.success) {
            document.getElementById('pt-result').style.display = 'block';
            document.getElementById('pt-result').innerHTML = '<div class="pt-result-wrong">Error: ' + (data.error || 'Failed to generate clues') + '</div>';
            return;
        }

        currentClues = data.clues;
        currentAnswer = data.answer;

        buildClueDots();
        showClue(0);
        updatePointsIndicator();
        nextClueBtn.disabled = false;
        buzzBtn.disabled = false;
    } catch (e) {
        document.getElementById('pt-result').style.display = 'block';
        document.getElementById('pt-result').innerHTML = '<div class="pt-result-wrong">Network error. Please try again.</div>';
    }
}

function buildClueDots() {
    const container = document.getElementById('pt-clue-dots');
    container.innerHTML = '';
    for (let i = 0; i < currentClues.length; i++) {
        const dot = document.createElement('div');
        dot.className = 'pt-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('data-index', i);
        container.appendChild(dot);
    }
}

function showClue(idx) {
    if (idx >= currentClues.length) return;
    clueIndex = idx;

    const list = document.getElementById('pt-clues-list');
    const clueEl = document.createElement('div');
    clueEl.className = 'pt-clue-item pt-clue-reveal';
    clueEl.innerHTML = '<span class="pt-clue-num">Clue ' + (idx + 1) + ':</span> ' + currentClues[idx];
    list.appendChild(clueEl);

    document.getElementById('pt-clue-label').textContent = 'Clue ' + (idx + 1) + ' of ' + currentClues.length;

    const dots = document.querySelectorAll('.pt-dot');
    dots.forEach((d, i) => {
        d.classList.toggle('active', i <= idx);
    });

    updatePointsIndicator();

    if (idx >= currentClues.length - 1) {
        document.getElementById('next-clue-btn').disabled = true;
    }
}

function updatePointsIndicator() {
    const pts = getPointsForClue(clueIndex, currentClues.length);
    const el = document.getElementById('pt-points-value');
    el.textContent = pts + ' pts';

    const indicator = document.getElementById('pt-points-indicator');
    if (pts === 15) {
        indicator.className = 'pt-points-indicator pt-points-power';
    } else if (pts === 10) {
        indicator.className = 'pt-points-indicator pt-points-mid';
    } else {
        indicator.className = 'pt-points-indicator pt-points-low';
    }
}

function nextClue() {
    if (clueIndex < currentClues.length - 1) {
        showClue(clueIndex + 1);
    }
}

function buzz() {
    document.getElementById('pt-action-buttons').style.display = 'none';
    document.getElementById('pt-answer-section').style.display = 'block';
    document.getElementById('pt-answer-input').value = '';
    document.getElementById('pt-answer-input').focus();
}

async function submitBuzz() {
    const userAnswer = document.getElementById('pt-answer-input').value.trim();
    if (!userAnswer) return;

    const submitBtn = document.getElementById('submit-buzz-btn');
    submitBtn.disabled = true;

    const buzzDepth = clueIndex + 1;
    const pts = getPointsForClue(clueIndex, currentClues.length);

    try {
        const checkResp = await fetch('/api/check-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_id: 0, user_answer: userAnswer })
        });

        let isCorrect = false;

        if (checkResp.ok) {
            const checkData = await checkResp.json();
            isCorrect = checkData.correct;
        }

        if (!isCorrect) {
            isCorrect = fuzzyMatch(userAnswer, currentAnswer);
        }

        const pointsEarned = isCorrect ? pts : -5;

        const result = {
            correct: isCorrect,
            buzzDepth: buzzDepth,
            points: pointsEarned,
            answer: currentAnswer,
            userAnswer: userAnswer,
            totalClues: currentClues.length
        };
        sessionResults.push(result);

        const resultDiv = document.getElementById('pt-result');
        resultDiv.style.display = 'block';
        document.getElementById('pt-answer-section').style.display = 'none';

        if (isCorrect) {
            let label = buzzDepth <= 2 ? 'POWER!' : 'Correct!';
            resultDiv.innerHTML = '<div class="pt-result-correct"><div class="pt-result-label">' + label + '</div><div class="pt-result-points">+' + pointsEarned + ' points</div><div class="pt-result-answer">Answer: ' + currentAnswer + '</div><div class="pt-result-depth">Buzzed at clue ' + buzzDepth + ' of ' + currentClues.length + '</div></div>';
        } else {
            resultDiv.innerHTML = '<div class="pt-result-wrong"><div class="pt-result-label">Incorrect</div><div class="pt-result-points">' + pointsEarned + ' points</div><div class="pt-result-answer">Correct answer: ' + currentAnswer + '</div><div class="pt-result-user-answer">Your answer: ' + userAnswer + '</div></div>';
            showRemainingClues();
        }

        await fetch('/api/power-training/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic: currentTopic,
                total_clues: currentClues.length,
                buzz_depth: buzzDepth,
                points_earned: pointsEarned,
                correct: isCorrect
            })
        });

        if (questionNumber < QUESTIONS_PER_SESSION) {
            document.getElementById('pt-next-q-btn').style.display = 'block';
        } else {
            document.getElementById('pt-next-q-btn').style.display = 'block';
            document.getElementById('pt-next-q-btn').querySelector('button').textContent = 'View Summary';
        }

    } catch (e) {
        resultDiv.innerHTML = '<div class="pt-result-wrong">Error submitting answer.</div>';
    } finally {
        submitBtn.disabled = false;
    }
}

function showRemainingClues() {
    for (let i = clueIndex + 1; i < currentClues.length; i++) {
        showClue(i);
    }
}

function fuzzyMatch(userAnswer, correctAnswer) {
    const normalize = (s) => s.toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const user = normalize(userAnswer);
    const accepted = correctAnswer.replace(/;/g, '/').split('/').map(a => normalize(a.trim())).filter(a => a);

    for (const ans of accepted) {
        if (user === ans) return true;

        const dist = levenshtein(user, ans);
        const maxLen = Math.max(user.length, ans.length);
        if (maxLen > 0 && (1 - dist / maxLen) >= 0.65) return true;

        if (ans.includes(user) || user.includes(ans)) {
            const shorter = Math.min(user.length, ans.length);
            const longer = Math.max(user.length, ans.length);
            if (shorter >= 3 && shorter / longer >= 0.5) return true;
        }
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

function showSummary() {
    document.getElementById('training-section').style.display = 'none';
    document.getElementById('summary-section').style.display = 'block';

    const totalPts = sessionResults.reduce((s, r) => s + r.points, 0);
    const correctCount = sessionResults.filter(r => r.correct).length;
    const accuracy = sessionResults.length > 0 ? Math.round(correctCount / sessionResults.length * 100) : 0;
    const avgDepth = sessionResults.length > 0 ? (sessionResults.reduce((s, r) => s + r.buzzDepth, 0) / sessionResults.length).toFixed(1) : 0;
    const powers = sessionResults.filter(r => r.correct && r.buzzDepth <= 2).length;

    document.getElementById('sum-total-pts').textContent = totalPts;
    document.getElementById('sum-accuracy').textContent = accuracy + '%';
    document.getElementById('sum-avg-depth').textContent = avgDepth;
    document.getElementById('sum-powers').textContent = powers;

    const breakdown = document.getElementById('sum-breakdown');
    breakdown.innerHTML = '<h3>Question Breakdown</h3>' + sessionResults.map((r, i) =>
        '<div class="pt-breakdown-item ' + (r.correct ? 'pt-breakdown-correct' : 'pt-breakdown-wrong') + '">' +
        '<span class="pt-breakdown-num">Q' + (i + 1) + '</span>' +
        '<span class="pt-breakdown-answer">' + r.answer + '</span>' +
        '<span class="pt-breakdown-detail">' +
        (r.correct ? 'Clue ' + r.buzzDepth + '/' + r.totalClues : 'Wrong') +
        ' | ' + (r.points > 0 ? '+' : '') + r.points + ' pts</span>' +
        '</div>'
    ).join('');
}

function resetTraining() {
    document.getElementById('summary-section').style.display = 'none';
    document.getElementById('setup-section').style.display = 'block';
    document.getElementById('career-stats').style.display = 'none';
    sessionResults = [];
    questionNumber = 0;
}

document.addEventListener('DOMContentLoaded', async () => {
    checkSession();

    document.getElementById('pt-answer-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitBuzz();
    });

    document.getElementById('pt-topic').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startTraining();
    });
});
