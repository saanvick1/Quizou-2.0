let currentDebateId = null;
let currentRound = 0;
let userSide = '';
let aiSide = '';

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
            var navMyClasses = document.getElementById('nav-my-classes');
            if (navMyClasses) {
                navMyClasses.style.display = data.role === 'teacher' ? 'inline-flex' : 'none';
            }
            loadPastDebates();
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
    const menu = document.getElementById('nav-menu');
    menu.classList.toggle('show');
}

async function startDebate() {
    const topic = document.getElementById('debate-topic').value.trim();
    const errorDiv = document.getElementById('start-error');
    const btn = document.getElementById('start-debate-btn');
    errorDiv.textContent = '';

    if (!topic) {
        errorDiv.textContent = 'Please enter a debate topic.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Starting debate...';

    try {
        const response = await fetch('/api/debate/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            currentDebateId = data.debate_id;
            userSide = data.user_side;
            aiSide = data.ai_side;
            currentRound = 0;

            document.getElementById('debate-setup').style.display = 'none';
            document.getElementById('debate-scorecard').style.display = 'none';
            document.getElementById('debate-active').style.display = 'block';

            const header = document.getElementById('debate-topic-header');
            header.innerHTML = '<h2>' + escapeHtml(data.topic) + '</h2>' +
                '<div class="debate-sides"><span class="debate-side-user">You: ' + userSide.toUpperCase() + '</span>' +
                '<span class="debate-side-ai">AI: ' + aiSide.toUpperCase() + '</span></div>';

            document.getElementById('debate-chat').innerHTML = '';
            document.getElementById('debate-argument').value = '';
            updateRoundIndicator();
        } else {
            errorDiv.textContent = data.error || 'Failed to start debate.';
        }
    } catch (e) {
        errorDiv.textContent = 'Error starting debate. Please try again.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Start Debate';
    }
}

function updateRoundIndicator() {
    const indicator = document.getElementById('debate-round-indicator');
    const remaining = 3 - currentRound;
    indicator.textContent = 'Round ' + (currentRound + 1) + ' of 3';

    const endBtn = document.getElementById('end-debate-btn');
    const submitBtn = document.getElementById('submit-arg-btn');
    const textarea = document.getElementById('debate-argument');

    if (currentRound >= 3) {
        submitBtn.style.display = 'none';
        textarea.style.display = 'none';
        endBtn.style.display = 'inline-block';
        indicator.textContent = 'All 3 rounds complete!';
    } else {
        submitBtn.style.display = 'inline-block';
        textarea.style.display = 'block';
        if (currentRound > 0) {
            endBtn.style.display = 'inline-block';
        }
    }
}

async function submitArgument() {
    const textarea = document.getElementById('debate-argument');
    const argument = textarea.value.trim();
    const errorDiv = document.getElementById('debate-error');
    const btn = document.getElementById('submit-arg-btn');
    errorDiv.textContent = '';

    if (!argument) {
        errorDiv.textContent = 'Please type your argument before submitting.';
        return;
    }

    addChatBubble(argument, 'user');
    textarea.value = '';
    btn.disabled = true;
    btn.textContent = 'AI is responding...';

    try {
        const response = await fetch('/api/debate/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ debate_id: currentDebateId, argument })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            addChatBubble(data.round.ai, 'ai');
            currentRound = data.rounds_completed;
            updateRoundIndicator();
        } else {
            errorDiv.textContent = data.error || 'Failed to get AI response.';
        }
    } catch (e) {
        errorDiv.textContent = 'Error communicating with AI. Please try again.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Argument';
    }
}

function addChatBubble(text, sender) {
    const chat = document.getElementById('debate-chat');
    const bubble = document.createElement('div');
    bubble.className = 'debate-bubble debate-bubble-' + sender;

    const label = document.createElement('div');
    label.className = 'debate-bubble-label';
    label.textContent = sender === 'user' ? 'You (' + userSide.toUpperCase() + ')' : 'AI (' + aiSide.toUpperCase() + ')';

    const content = document.createElement('div');
    content.className = 'debate-bubble-content';
    content.textContent = text;

    bubble.appendChild(label);
    bubble.appendChild(content);
    chat.appendChild(bubble);
    chat.scrollTop = chat.scrollHeight;
}

async function endDebate() {
    const btn = document.getElementById('end-debate-btn');
    btn.disabled = true;
    btn.textContent = 'Scoring...';

    try {
        const response = await fetch('/api/debate/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ debate_id: currentDebateId })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            showScorecard(data.scores);
            document.getElementById('debate-input-area').style.display = 'none';
        } else {
            document.getElementById('debate-error').textContent = data.error || 'Failed to score debate.';
        }
    } catch (e) {
        document.getElementById('debate-error').textContent = 'Error scoring debate.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'End Debate';
    }
}

function showScorecard(scores) {
    const container = document.getElementById('debate-scorecard');
    const fa = scores.factual_accuracy || {};
    const rq = scores.reasoning_quality || {};
    const eu = scores.evidence_use || {};
    const factual = typeof fa === 'object' ? (fa.score || 5) : fa;
    const factualFb = typeof fa === 'object' ? (fa.feedback || '') : '';
    const reasoning = typeof rq === 'object' ? (rq.score || 5) : rq;
    const reasoningFb = typeof rq === 'object' ? (rq.feedback || '') : '';
    const evidence = typeof eu === 'object' ? (eu.score || 5) : eu;
    const evidenceFb = typeof eu === 'object' ? (eu.feedback || '') : '';
    const overall = scores.overall_score || 5;
    const verdict = scores.verdict || '';
    const strengths = scores.strengths || [];
    const improvements = scores.improvements || [];

    container.innerHTML =
        '<h2>Debate Scorecard</h2>' +
        '<div class="scorecard-grid">' +
            '<div class="scorecard-item">' +
                '<div class="scorecard-category">Factual Accuracy</div>' +
                '<div class="scorecard-score">' + factual + '<span>/10</span></div>' +
                '<div class="scorecard-bar"><div class="scorecard-bar-fill" style="width:' + (factual * 10) + '%;"></div></div>' +
            '</div>' +
            '<div class="scorecard-item">' +
                '<div class="scorecard-category">Reasoning Quality</div>' +
                '<div class="scorecard-score">' + reasoning + '<span>/10</span></div>' +
                '<div class="scorecard-bar"><div class="scorecard-bar-fill" style="width:' + (reasoning * 10) + '%;"></div></div>' +
            '</div>' +
            '<div class="scorecard-item">' +
                '<div class="scorecard-category">Evidence Use</div>' +
                '<div class="scorecard-score">' + evidence + '<span>/10</span></div>' +
                '<div class="scorecard-bar"><div class="scorecard-bar-fill" style="width:' + (evidence * 10) + '%;"></div></div>' +
            '</div>' +
        '</div>' +
        '<div class="scorecard-overall">' +
            '<div class="scorecard-overall-label">Overall Score</div>' +
            '<div class="scorecard-overall-value">' + overall + '<span>/10</span></div>' +
        '</div>' +
        (verdict ? '<div class="scorecard-verdict">' + escapeHtml(verdict) + '</div>' : '') +
        (factualFb || reasoningFb || evidenceFb ?
            '<div class="scorecard-feedback">' +
            (factualFb ? '<p><strong>Factual Accuracy:</strong> ' + escapeHtml(factualFb) + '</p>' : '') +
            (reasoningFb ? '<p><strong>Reasoning:</strong> ' + escapeHtml(reasoningFb) + '</p>' : '') +
            (evidenceFb ? '<p><strong>Evidence:</strong> ' + escapeHtml(evidenceFb) + '</p>' : '') +
            '</div>' : '') +
        (strengths.length > 0 ? '<div class="scorecard-feedback"><strong>Strengths:</strong><ul>' + strengths.map(function(s) { return '<li>' + escapeHtml(s) + '</li>'; }).join('') + '</ul></div>' : '') +
        (improvements.length > 0 ? '<div class="scorecard-feedback"><strong>Areas to Improve:</strong><ul>' + improvements.map(function(s) { return '<li>' + escapeHtml(s) + '</li>'; }).join('') + '</ul></div>' : '') +
        '<div class="scorecard-actions">' +
            '<button onclick="newDebate()" class="btn-generate">New Debate</button>' +
            '<a href="/home" class="secondary-btn" style="text-decoration:none;display:inline-block;text-align:center;">Back to Home</a>' +
        '</div>';

    container.style.display = 'block';
    loadPastDebates();
}

function newDebate() {
    currentDebateId = null;
    currentRound = 0;
    document.getElementById('debate-setup').style.display = 'block';
    document.getElementById('debate-active').style.display = 'none';
    document.getElementById('debate-scorecard').style.display = 'none';
    document.getElementById('debate-input-area').style.display = 'block';
    document.getElementById('debate-topic').value = '';
    document.getElementById('submit-arg-btn').style.display = 'inline-block';
    document.getElementById('end-debate-btn').style.display = 'none';
    document.getElementById('debate-argument').style.display = 'block';
}

async function loadPastDebates() {
    try {
        const response = await fetch('/api/debate/history');
        const data = await response.json();
        if (data.success && data.debates && data.debates.length > 0) {
            const section = document.getElementById('past-debates');
            const list = document.getElementById('past-debates-list');
            section.style.display = 'block';
            list.innerHTML = data.debates.map(function(d) {
                const scoreDisplay = d.status === 'completed' && d.score !== null ? d.score + '/10' : 'In Progress';
                const statusClass = d.status === 'completed' ? 'debate-status-done' : 'debate-status-active';
                return '<div class="past-debate-item">' +
                    '<div class="past-debate-info">' +
                        '<strong>' + escapeHtml(d.topic) + '</strong>' +
                        '<span>Side: ' + (d.side || '').toUpperCase() + ' | Score: <strong>' + scoreDisplay + '</strong></span>' +
                    '</div>' +
                    '<div class="past-debate-meta">' +
                        '<span class="' + statusClass + '">' + d.status + '</span>' +
                        '<small>' + formatDate(d.created_at) + '</small>' +
                    '</div>' +
                '</div>';
            }).join('');
        }
    } catch (e) {}
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return dateStr;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', function() {
    checkSession();
    var ta = document.getElementById('debate-argument');
    if (ta) {
        ta.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.ctrlKey) {
                submitArgument();
            }
        });
    }
});
