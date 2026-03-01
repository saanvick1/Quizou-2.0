let missedQuestions = [];
let availableTopics = [];

async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        if (data.logged_in) {
            document.getElementById('username-display').textContent = data.username;
            loadMissedQuestions();
        } else {
            window.location.href = '/home';
        }
    } catch (error) {
        window.location.href = '/home';
    }
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/home';
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

function toggleMenu() {
    const nav = document.getElementById('nav-menu');
    if (nav) nav.classList.toggle('nav-open');
}

async function loadMissedQuestions() {
    const container = document.getElementById('missed-questions-container');
    container.innerHTML = '<div class="loading">Loading missed questions...</div>';

    const topicFilter = document.getElementById('topic-filter').value;
    const difficultyFilter = document.getElementById('difficulty-filter').value;

    let url = '/api/missed-questions?';
    const params = [];
    if (topicFilter && topicFilter !== 'all') params.push('topic=' + encodeURIComponent(topicFilter));
    if (difficultyFilter && difficultyFilter !== 'all') params.push('difficulty=' + encodeURIComponent(difficultyFilter));
    url += params.join('&');

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.success) {
            missedQuestions = data.questions || [];
            availableTopics = data.topics || [];
            populateTopicFilter(availableTopics);
            document.getElementById('missed-count').textContent = missedQuestions.length;
            renderQuestions(missedQuestions);
        } else {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#10060;</div><h3>Error Loading Questions</h3><p>' + (data.error || 'Something went wrong.') + '</p></div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#10060;</div><h3>Error Loading Questions</h3><p>Could not connect to the server.</p></div>';
    }
}

function populateTopicFilter(topics) {
    const select = document.getElementById('topic-filter');
    const currentValue = select.value;
    const existingOptions = select.querySelectorAll('option:not([value="all"])');
    if (existingOptions.length > 0) return;

    topics.forEach(function(topic) {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        select.appendChild(option);
    });

    if (currentValue && currentValue !== 'all') {
        select.value = currentValue;
    }
}

function applyFilters() {
    loadMissedQuestions();
}

function renderQuestions(questions) {
    const container = document.getElementById('missed-questions-container');

    if (!questions || questions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#127881;</div><h3>No Missed Questions</h3><p>Great job! You haven\'t missed any questions yet, or none match your filters. <a href="/home">Practice more</a></p></div>';
        return;
    }

    var grouped = {};
    questions.forEach(function(q) {
        var t = q.topic || 'Other';
        if (!grouped[t]) grouped[t] = [];
        grouped[t].push(q);
    });

    var html = '';
    Object.keys(grouped).forEach(function(topic) {
        html += '<div class="missed-topic-group">';
        html += '<h3 class="missed-topic-heading">' + escapeHtml(topic) + ' <span class="missed-topic-count">(' + grouped[topic].length + ')</span></h3>';
        html += '<div class="questions-grid">';
        grouped[topic].forEach(function(q) {
            var diffClass = 'missed-diff-' + (q.difficulty || 'Medium').toLowerCase();
            html += '<div class="question-box missed-card" id="missed-card-' + q.id + '">';
            html += '<div class="question-header">';
            html += '<span class="missed-topic-pill">' + escapeHtml(q.topic || 'Other') + '</span>';
            html += '<span class="missed-difficulty-badge ' + diffClass + '">' + escapeHtml(q.difficulty || 'Medium') + '</span>';
            html += '</div>';
            html += '<div class="question-text">' + escapeHtml(q.question) + '</div>';
            html += '<div class="missed-meta">';
            if (q.date) html += '<span class="missed-date">' + escapeHtml(q.date) + '</span>';
            if (q.time_taken) html += '<span class="missed-time">' + q.time_taken + 's</span>';
            html += '</div>';
            html += '<div class="answer-section">';
            html += '<div class="missed-answer-row">';
            html += '<button class="missed-reveal-btn" onclick="toggleAnswer(' + q.id + ')">Show Correct Answer</button>';
            html += '<button class="missed-retry-btn" onclick="showRetryInput(' + q.id + ')">Try Again</button>';
            html += '</div>';
            html += '<div id="correct-answer-' + q.id + '" class="answer-text" style="display:none;"><strong>Correct Answer:</strong> ' + escapeHtml(q.answer) + '</div>';
            html += '<div id="retry-area-' + q.id + '" class="missed-retry-area" style="display:none;">';
            html += '<div class="answer-input-row">';
            html += '<input type="text" class="answer-input" id="retry-input-' + q.id + '" placeholder="Type your answer..." autocomplete="off">';
            html += '<button class="check-answer-btn" data-qid="' + q.id + '" onclick="retryFromButton(this)">Check</button>';
            html += '</div>';
            html += '<div id="retry-result-' + q.id + '" class="missed-retry-result"></div>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
    });

    container.innerHTML = html;

    container.querySelectorAll('.answer-input').forEach(function(input) {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                var id = input.id.replace('retry-input-', '');
                var q = missedQuestions.find(function(q) { return String(q.id) === id; });
                if (q) retryQuestion(q.id, q.answer);
            }
        });
    });
}

function toggleAnswer(id) {
    var el = document.getElementById('correct-answer-' + id);
    if (!el) return;
    if (el.style.display === 'none') {
        el.style.display = 'block';
        var btn = el.parentElement.querySelector('.missed-reveal-btn');
        if (btn) btn.textContent = 'Hide Correct Answer';
    } else {
        el.style.display = 'none';
        var btn = el.parentElement.querySelector('.missed-reveal-btn');
        if (btn) btn.textContent = 'Show Correct Answer';
    }
}

function showRetryInput(id) {
    var area = document.getElementById('retry-area-' + id);
    if (!area) return;
    if (area.style.display === 'none') {
        area.style.display = 'block';
        document.getElementById('retry-input-' + id).focus();
    } else {
        area.style.display = 'none';
    }
}

function normalizeText(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function levenshteinDistance(a, b) {
    var matrix = [];
    for (var i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (var j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (var i = 1; i <= b.length; i++) {
        for (var j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function fuzzyMatch(userAnswer, correctAnswer) {
    var normUser = normalizeText(userAnswer);
    var normCorrect = normalizeText(correctAnswer);

    if (normUser === normCorrect) return true;
    if (normCorrect.includes(normUser) && normUser.length >= 3) return true;
    if (normUser.includes(normCorrect)) return true;

    var maxLen = Math.max(normUser.length, normCorrect.length);
    if (maxLen === 0) return false;
    var dist = levenshteinDistance(normUser, normCorrect);
    var similarity = 1 - (dist / maxLen);
    return similarity >= 0.65;
}

function retryFromButton(btn) {
    var qid = btn.getAttribute('data-qid');
    var q = missedQuestions.find(function(q) { return String(q.id) === String(qid); });
    if (q) retryQuestion(q.id, q.answer);
}

function retryQuestion(id, correctAnswer) {
    var input = document.getElementById('retry-input-' + id);
    var resultDiv = document.getElementById('retry-result-' + id);
    if (!input || !resultDiv) return;

    var userAnswer = input.value.trim();
    if (!userAnswer) {
        input.focus();
        return;
    }

    var isCorrect = fuzzyMatch(userAnswer, correctAnswer);

    if (isCorrect) {
        resultDiv.className = 'missed-retry-result missed-retry-correct';
        resultDiv.innerHTML = '&#10004; Correct! Great job!';
        input.disabled = true;
    } else {
        resultDiv.className = 'missed-retry-result missed-retry-incorrect';
        resultDiv.innerHTML = '&#10008; Not quite. Try again or reveal the answer.';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

checkSession();
