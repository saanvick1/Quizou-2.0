let allHistoryData = [];
let missedQuestions = [];
let perfData = null;
let reviewLoaded = false;
let statsLoaded = false;

async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        if (data.logged_in) {
            document.getElementById('username-display').textContent = data.username;
            loadHistory();
            var hash = window.location.hash;
            if (hash === '#review') {
                switchHistoryTab('review', document.querySelectorAll('.history-subtab')[1]);
            } else if (hash === '#stats') {
                switchHistoryTab('stats', document.querySelectorAll('.history-subtab')[2]);
            }
        } else {
            window.location.href = '/home';
        }
    } catch (error) {
        console.error('Error checking session:', error);
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
    var menu = document.getElementById('nav-menu');
    menu.classList.toggle('show');
}

function switchHistoryTab(tab, btn) {
    document.querySelectorAll('.history-tab-content').forEach(function(el) {
        el.style.display = 'none';
    });
    document.querySelectorAll('.history-subtab').forEach(function(el) {
        el.classList.remove('active');
    });
    document.getElementById('tab-' + tab).style.display = 'block';
    if (btn) btn.classList.add('active');
    window.location.hash = tab === 'history' ? '' : tab;

    if (tab === 'review' && !reviewLoaded) {
        reviewLoaded = true;
        loadMissedQuestions();
    }
    if (tab === 'stats' && !statsLoaded) {
        statsLoaded = true;
        loadPerformance();
    }
}

async function loadHistory() {
    var historyContainer = document.getElementById('history-container');
    var statsContainer = document.getElementById('stats-container');
    historyContainer.innerHTML = '<div class="loading">Loading history...</div>';

    try {
        var response = await fetch('/api/history');
        var data = await response.json();
        if (response.ok) {
            allHistoryData = data.history;
            statsContainer.innerHTML = '';
            var statsBox = document.createElement('div');
            statsBox.className = 'stats-box';

            var totalItem = document.createElement('div');
            totalItem.className = 'stat-item';
            var totalValue = document.createElement('div');
            totalValue.className = 'stat-value';
            totalValue.textContent = data.stats.total;
            var totalLabel = document.createElement('div');
            totalLabel.className = 'stat-label';
            totalLabel.textContent = 'Total Questions';
            totalItem.appendChild(totalValue);
            totalItem.appendChild(totalLabel);

            var correctItem = document.createElement('div');
            correctItem.className = 'stat-item';
            var correctValue = document.createElement('div');
            correctValue.className = 'stat-value';
            correctValue.textContent = data.stats.correct;
            var correctLabel = document.createElement('div');
            correctLabel.className = 'stat-label';
            correctLabel.textContent = 'Correct Answers';
            correctItem.appendChild(correctValue);
            correctItem.appendChild(correctLabel);

            var accuracyItem = document.createElement('div');
            accuracyItem.className = 'stat-item';
            var accuracyValue = document.createElement('div');
            accuracyValue.className = 'stat-value';
            accuracyValue.textContent = data.stats.accuracy + '%';
            var accuracyLabel = document.createElement('div');
            accuracyLabel.className = 'stat-label';
            accuracyLabel.textContent = 'Accuracy';
            accuracyItem.appendChild(accuracyValue);
            accuracyItem.appendChild(accuracyLabel);

            statsBox.appendChild(totalItem);
            statsBox.appendChild(correctItem);
            statsBox.appendChild(accuracyItem);
            statsContainer.appendChild(statsBox);

            loadCognitiveAnalytics();
            populateTopicFilter();
            displayHistory(allHistoryData);
        }
    } catch (error) {
        historyContainer.innerHTML = '<p>Error loading history</p>';
    }
}

function populateTopicFilter() {
    var topicFilter = document.getElementById('topic-filter');
    var uniqueTopics = [];
    var seen = {};
    allHistoryData.forEach(function(item) {
        if (!seen[item.topic]) {
            seen[item.topic] = true;
            uniqueTopics.push(item.topic);
        }
    });
    topicFilter.innerHTML = '<option value="all">All Topics</option>';
    uniqueTopics.forEach(function(topic) {
        var option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        topicFilter.appendChild(option);
    });
}

function applyFilters() {
    var topicFilter = document.getElementById('topic-filter').value;
    var difficultyFilter = document.getElementById('difficulty-filter').value;
    var filteredData = allHistoryData;
    if (topicFilter !== 'all') {
        filteredData = filteredData.filter(function(item) { return item.topic === topicFilter; });
    }
    if (difficultyFilter !== 'all') {
        filteredData = filteredData.filter(function(item) { return item.difficulty === difficultyFilter; });
    }
    displayHistory(filteredData);
}

function displayHistory(historyData) {
    var historyContainer = document.getElementById('history-container');
    if (historyData.length === 0) {
        historyContainer.innerHTML = '<p>No questions match the selected filters.</p>';
    } else {
        historyContainer.innerHTML = '';
        historyData.forEach(function(item) {
            var historyItem = document.createElement('div');
            historyItem.className = 'history-item ' + (item.correct ? 'correct' : 'incorrect');
            var questionDiv = document.createElement('div');
            questionDiv.className = 'history-question';
            questionDiv.textContent = item.question;
            var answerDiv = document.createElement('div');
            answerDiv.className = 'history-answer';
            answerDiv.textContent = 'Answer: ' + item.answer;
            var metaDiv = document.createElement('div');
            metaDiv.className = 'history-meta';
            metaDiv.textContent = item.topic + ' | ' + item.difficulty + ' | ' + (item.correct ? 'Correct' : 'Incorrect') + ' | ' + new Date(item.timestamp).toLocaleDateString();
            historyItem.appendChild(questionDiv);
            historyItem.appendChild(answerDiv);
            historyItem.appendChild(metaDiv);
            historyContainer.appendChild(historyItem);
        });
    }
}

async function loadCognitiveAnalytics() {
    try {
        var response = await fetch('/api/cognitive-analytics');
        if (response.ok) {
            var data = await response.json();
            displayCognitiveAnalytics(data);
        }
    } catch (error) {
        console.log('Cognitive analytics unavailable');
    }
}

function displayCognitiveAnalytics(data) {
    var container = document.getElementById('cognitive-analytics-container');
    if (!data.analytics || data.analytics.length === 0) return;

    var cognitiveBox = document.createElement('div');
    cognitiveBox.className = 'generator-card';
    cognitiveBox.style.marginTop = '20px';
    var header = document.createElement('div');
    header.className = 'card-header';
    var title = document.createElement('h3');
    title.textContent = 'Cognitive Gap Analysis';
    var subtitle = document.createElement('p');
    subtitle.textContent = 'Identify where you need to improve: recall, inference, or comprehension';
    header.appendChild(title);
    header.appendChild(subtitle);
    cognitiveBox.appendChild(header);

    var analyticsGrid = document.createElement('div');
    analyticsGrid.className = 'stats-box';
    analyticsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';

    data.analytics.forEach(function(item) {
        var analyticsItem = document.createElement('div');
        analyticsItem.className = 'stat-item';
        analyticsItem.style.padding = '15px';
        analyticsItem.style.borderLeft = '3px solid #f97316';
        var topicLabel = document.createElement('div');
        topicLabel.style.fontWeight = 'bold';
        topicLabel.style.marginBottom = '10px';
        topicLabel.textContent = item.topic + ' (' + item.difficulty + ')';
        var gapsDiv = document.createElement('div');
        gapsDiv.style.fontSize = '0.9em';
        gapsDiv.style.color = '#666';
        if (item.recall_gap_count > 0) {
            var d = document.createElement('div');
            d.textContent = 'Recall gaps: ' + item.recall_gap_count;
            gapsDiv.appendChild(d);
        }
        if (item.inference_gap_count > 0) {
            var d2 = document.createElement('div');
            d2.textContent = 'Inference gaps: ' + item.inference_gap_count;
            gapsDiv.appendChild(d2);
        }
        if (item.comprehension_gap_count > 0) {
            var d3 = document.createElement('div');
            d3.textContent = 'Comprehension gaps: ' + item.comprehension_gap_count;
            gapsDiv.appendChild(d3);
        }
        var accuracyDiv = document.createElement('div');
        accuracyDiv.style.marginTop = '5px';
        accuracyDiv.style.fontWeight = 'bold';
        var accuracy = Math.round((item.correct_questions / item.total_questions) * 100);
        accuracyDiv.textContent = 'Accuracy: ' + accuracy + '%';
        analyticsItem.appendChild(topicLabel);
        analyticsItem.appendChild(gapsDiv);
        analyticsItem.appendChild(accuracyDiv);
        analyticsGrid.appendChild(analyticsItem);
    });
    cognitiveBox.appendChild(analyticsGrid);
    container.appendChild(cognitiveBox);
}

async function loadMissedQuestions() {
    var container = document.getElementById('missed-questions-container');
    container.innerHTML = '<div class="loading">Loading missed questions...</div>';

    var topicFilter = document.getElementById('missed-topic-filter').value;
    var difficultyFilter = document.getElementById('missed-difficulty-filter').value;

    var url = '/api/missed-questions?';
    var params = [];
    if (topicFilter && topicFilter !== 'all') params.push('topic=' + encodeURIComponent(topicFilter));
    if (difficultyFilter && difficultyFilter !== 'all') params.push('difficulty=' + encodeURIComponent(difficultyFilter));
    url += params.join('&');

    try {
        var response = await fetch(url);
        var data = await response.json();
        if (data.success) {
            missedQuestions = data.questions || [];
            populateMissedTopicFilter(data.topics || []);
            document.getElementById('missed-count').textContent = missedQuestions.length;
            renderMissedQuestions(missedQuestions);
        } else {
            container.innerHTML = '<div class="empty-state"><h3>Error</h3><p>' + (data.error || 'Something went wrong.') + '</p></div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><h3>Error</h3><p>Could not connect to the server.</p></div>';
    }
}

function populateMissedTopicFilter(topics) {
    var select = document.getElementById('missed-topic-filter');
    var existing = select.querySelectorAll('option:not([value="all"])');
    if (existing.length > 0) return;
    topics.forEach(function(topic) {
        var option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        select.appendChild(option);
    });
}

function applyMissedFilters() {
    loadMissedQuestions();
}

function renderMissedQuestions(questions) {
    var container = document.getElementById('missed-questions-container');
    if (!questions || questions.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No Missed Questions</h3><p>Great job! You haven\'t missed any questions, or none match your filters.</p></div>';
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
            html += '<button class="missed-reveal-btn" onclick="toggleMissedAnswer(' + q.id + ')" type="button">Show Answer</button>';
            html += '<button class="missed-retry-btn" onclick="showRetryInput(' + q.id + ')" type="button">Try Again</button>';
            html += '<a class="missed-autopsy-btn" href="/question-autopsy?question=' + encodeURIComponent(q.question) + '&answer=' + encodeURIComponent(q.answer) + '&user_answer=' + encodeURIComponent(q.user_answer || '') + '&topic=' + encodeURIComponent(q.topic || '') + '">Dissect</a>';
            html += '</div>';
            html += '<div id="correct-answer-' + q.id + '" class="answer-text" style="display:none;"><strong>Correct Answer:</strong> ' + escapeHtml(q.answer) + '</div>';
            html += '<div id="retry-area-' + q.id + '" class="missed-retry-area" style="display:none;">';
            html += '<div class="answer-input-row">';
            html += '<input type="text" class="answer-input" id="retry-input-' + q.id + '" placeholder="Type your answer..." autocomplete="off" aria-label="Retry answer">';
            html += '<button class="check-answer-btn" data-qid="' + q.id + '" onclick="retryFromButton(this)" type="button">Check</button>';
            html += '</div>';
            html += '<div id="retry-result-' + q.id + '" class="missed-retry-result" aria-live="polite"></div>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
        });
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

function toggleMissedAnswer(id) {
    var el = document.getElementById('correct-answer-' + id);
    if (!el) return;
    if (el.style.display === 'none') {
        el.style.display = 'block';
        var btn = el.parentElement.querySelector('.missed-reveal-btn');
        if (btn) btn.textContent = 'Hide Answer';
    } else {
        el.style.display = 'none';
        var btn = el.parentElement.querySelector('.missed-reveal-btn');
        if (btn) btn.textContent = 'Show Answer';
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
    if (!userAnswer) { input.focus(); return; }
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

function normalizeText(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function levenshteinDistance(a, b) {
    var matrix = [];
    for (var i = 0; i <= b.length; i++) matrix[i] = [i];
    for (var j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (var i = 1; i <= b.length; i++) {
        for (var j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
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
    return (1 - (dist / maxLen)) >= 0.65;
}

async function loadPerformance() {
    try {
        var res = await fetch('/api/performance-breakdown');
        var data = await res.json();
        if (data.success) {
            perfData = data;
            renderPerfOverall(data);
            renderPerfDifficulties(data);
            renderPerfTopics(data);
            renderPerfRecentActivity(data);
            document.getElementById('perf-loading').style.display = 'none';
            document.getElementById('perf-content').style.display = 'block';
        } else {
            document.getElementById('perf-loading').textContent = 'Failed to load performance data.';
        }
    } catch (e) {
        document.getElementById('perf-loading').textContent = 'Error loading performance data.';
    }
}

function renderPerfOverall(data) {
    var o = data.overall || {};
    document.getElementById('perf-overall-stats').innerHTML =
        '<div class="perf-overall-grid">' +
        '<div class="perf-overall-card"><div class="perf-overall-value">' + (o.total || 0) + '</div><div class="perf-overall-label">Total Questions</div></div>' +
        '<div class="perf-overall-card"><div class="perf-overall-value">' + (o.correct || 0) + '</div><div class="perf-overall-label">Correct</div></div>' +
        '<div class="perf-overall-card"><div class="perf-overall-value">' + (o.accuracy || 0).toFixed(1) + '%</div><div class="perf-overall-label">Accuracy</div></div>' +
        '<div class="perf-overall-card"><div class="perf-overall-value">' + (o.topics_practiced || 0) + '</div><div class="perf-overall-label">Topics</div></div>' +
        '</div>';
}

function renderPerfDifficulties(data) {
    var d = data.difficulties || {};
    var levels = [
        { key: 'Easy', color: '#48bb78' },
        { key: 'Medium', color: '#f97316' },
        { key: 'Hard', color: '#f5576c' }
    ];
    var html = '<div class="perf-diff-grid">';
    levels.forEach(function(l) {
        var info = d[l.key] || { total: 0, correct: 0, accuracy: 0 };
        html += '<div class="perf-diff-card" style="border-top:4px solid ' + l.color + ';">' +
            '<h4>' + l.key + '</h4>' +
            '<div class="perf-diff-accuracy">' + (info.accuracy || 0).toFixed(1) + '%</div>' +
            '<div class="perf-diff-detail">' + (info.correct || 0) + ' / ' + (info.total || 0) + ' correct</div>' +
            '<div class="perf-progress-bar"><div class="perf-progress-fill" style="width:' + (info.accuracy || 0) + '%;background:' + l.color + ';"></div></div>' +
            '</div>';
    });
    html += '</div>';
    document.getElementById('perf-difficulty-breakdown').innerHTML = html;
}

function renderPerfTopics(data, sortField) {
    var topics = data.topics || [];
    var field = sortField || 'accuracy';
    var sorted = topics.slice().sort(function(a, b) { return (b[field] || 0) - (a[field] || 0); });
    var container = document.getElementById('perf-topic-breakdown');
    if (sorted.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No topic data yet. Start practicing!</p></div>';
        return;
    }
    var html = '';
    sorted.forEach(function(t) {
        var avgTime = t.avg_time != null ? t.avg_time.toFixed(1) + 's' : 'N/A';
        html += '<div class="perf-topic-row">' +
            '<div class="perf-topic-name">' + escapeHtml(t.topic) + '</div>' +
            '<div class="perf-topic-stats">' +
            '<span class="perf-topic-count">' + t.total + ' questions</span>' +
            '<span class="perf-topic-acc">' + (t.accuracy || 0).toFixed(1) + '%</span>' +
            '<span class="perf-topic-time">' + avgTime + '</span>' +
            '</div>' +
            '<div class="perf-progress-bar"><div class="perf-progress-fill" style="width:' + (t.accuracy || 0) + '%;background:linear-gradient(90deg,#1e3a8a,#f97316);"></div></div>' +
            '</div>';
    });
    container.innerHTML = html;
}

function renderPerfRecentActivity(data) {
    var activity = data.recent_activity || [];
    var container = document.getElementById('perf-recent-activity');
    if (activity.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No recent activity yet.</p></div>';
        return;
    }
    var html = '<div class="perf-timeline">';
    activity.forEach(function(a) {
        var topicsList = (a.topics || []).join(', ') || 'Various';
        html += '<div class="perf-timeline-item">' +
            '<div class="perf-timeline-date">' + escapeHtml(a.date) + '</div>' +
            '<div class="perf-timeline-details">' +
            '<div class="perf-timeline-topics">' + escapeHtml(topicsList) + '</div>' +
            '<div class="perf-timeline-score">' + (a.correct || 0) + ' / ' + (a.total || 0) + ' correct</div>' +
            '</div></div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

function sortPerfTopics(field) {
    if (perfData) renderPerfTopics(perfData, field);
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', async function() {
    checkSession();
    fetch('/api/track-pageview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({page: window.location.pathname}) }).catch(function() {});
});
