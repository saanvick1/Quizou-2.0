async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        if (!data.logged_in) {
            window.location.href = '/home';
            return;
        }
        document.getElementById('username-display').textContent = data.username;
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
    const menu = document.getElementById('nav-menu');
    menu.classList.toggle('show');
}

function switchTab(tab) {
    document.querySelectorAll('.qw-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-write').style.display = tab === 'write' ? 'block' : 'none';
    document.getElementById('tab-history').style.display = tab === 'history' ? 'block' : 'none';

    const tabs = document.querySelectorAll('.qw-tab');
    if (tab === 'write') {
        tabs[0].classList.add('active');
    } else {
        tabs[1].classList.add('active');
        loadHistory();
    }
}

async function submitQuestion() {
    const topic = document.getElementById('qw-topic').value.trim();
    const difficulty = document.getElementById('qw-difficulty').value;
    const questionText = document.getElementById('qw-question').value.trim();
    const answer = document.getElementById('qw-answer').value.trim();
    const errorDiv = document.getElementById('qw-error');
    const btn = document.getElementById('qw-submit-btn');

    errorDiv.textContent = '';

    if (!topic) {
        errorDiv.textContent = 'Please enter a topic.';
        return;
    }
    if (!questionText || questionText.length < 20) {
        errorDiv.textContent = 'Please write a question (at least 20 characters).';
        return;
    }
    if (!answer) {
        errorDiv.textContent = 'Please provide an answer.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Submitting for AI review...';

    try {
        const response = await fetch('/api/question-writer/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, difficulty, question_text: questionText, answer })
        });
        const data = await response.json();

        if (response.ok && data.feedback) {
            displayFeedback(data.feedback);
        } else {
            errorDiv.textContent = data.error || 'Error submitting question for review.';
        }
    } catch (error) {
        errorDiv.textContent = 'Error connecting to server. Please try again.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit for AI Review';
    }
}

function displayFeedback(feedback) {
    const container = document.getElementById('qw-feedback');
    const scoreEl = document.getElementById('qw-overall-score');
    const gridEl = document.getElementById('qw-criteria-grid');
    const detailEl = document.getElementById('qw-detailed-feedback');

    const score = feedback.overall_score || 0;
    scoreEl.textContent = score + '/10';

    if (score >= 8) {
        scoreEl.className = 'qw-overall-score qw-score-great';
    } else if (score >= 5) {
        scoreEl.className = 'qw-overall-score qw-score-good';
    } else {
        scoreEl.className = 'qw-overall-score qw-score-needs-work';
    }

    const criteria = [
        { key: 'pyramidal_structure', label: 'Pyramidal Structure', icon: '△' },
        { key: 'clue_progression', label: 'Clue Progression', icon: '↓' },
        { key: 'answer_protection', label: 'Answer Protection', icon: '🛡' },
        { key: 'difficulty_alignment', label: 'Difficulty Alignment', icon: '⚖' },
        { key: 'factual_accuracy', label: 'Factual Accuracy', icon: '✓' },
        { key: 'clarity', label: 'Clarity & Style', icon: '✎' }
    ];

    let gridHTML = '';
    criteria.forEach(c => {
        const val = feedback[c.key];
        if (val !== undefined && val !== null) {
            const numVal = typeof val === 'object' ? (val.score || 0) : val;
            const comment = typeof val === 'object' ? (val.comment || '') : '';
            const scoreClass = numVal >= 8 ? 'qw-criteria-great' : numVal >= 5 ? 'qw-criteria-good' : 'qw-criteria-needs-work';
            gridHTML += '<div class="qw-criteria-item ' + scoreClass + '">' +
                '<div class="qw-criteria-icon">' + c.icon + '</div>' +
                '<div class="qw-criteria-label">' + c.label + '</div>' +
                '<div class="qw-criteria-score">' + numVal + '/10</div>' +
                (comment ? '<div class="qw-criteria-comment">' + comment + '</div>' : '') +
                '</div>';
        }
    });
    gridEl.innerHTML = gridHTML;

    let detailHTML = '';
    if (feedback.strengths) {
        detailHTML += '<div class="qw-feedback-section qw-strengths">' +
            '<h3>Strengths</h3>' +
            '<p>' + feedback.strengths + '</p>' +
            '</div>';
    }
    if (feedback.improvements) {
        detailHTML += '<div class="qw-feedback-section qw-improvements">' +
            '<h3>Areas for Improvement</h3>' +
            '<p>' + feedback.improvements + '</p>' +
            '</div>';
    }
    if (feedback.suggestions) {
        detailHTML += '<div class="qw-feedback-section qw-suggestions">' +
            '<h3>Suggestions</h3>' +
            '<p>' + feedback.suggestions + '</p>' +
            '</div>';
    }
    if (feedback.overall_feedback) {
        detailHTML += '<div class="qw-feedback-section">' +
            '<h3>Overall Feedback</h3>' +
            '<p>' + feedback.overall_feedback + '</p>' +
            '</div>';
    }
    detailEl.innerHTML = detailHTML;

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadHistory() {
    const listEl = document.getElementById('qw-history-list');
    listEl.innerHTML = '<div class="loading">Loading submissions...</div>';

    try {
        const response = await fetch('/api/question-writer/history');
        const data = await response.json();

        if (!data.success || !data.submissions || data.submissions.length === 0) {
            listEl.innerHTML = '<div class="empty-state">' +
                '<div class="empty-icon">✍</div>' +
                '<h3>No Submissions Yet</h3>' +
                '<p>Write your first question and submit it for AI review!</p>' +
                '</div>';
            return;
        }

        let html = '';
        data.submissions.forEach(function(item) {
            const scoreClass = item.ai_score >= 8 ? 'qw-score-great' : item.ai_score >= 5 ? 'qw-score-good' : 'qw-score-needs-work';
            const date = item.created_at ? new Date(item.created_at).toLocaleDateString() : '';

            html += '<div class="qw-history-item" onclick="toggleHistoryDetail(this)">' +
                '<div class="qw-history-header">' +
                '<div class="qw-history-meta">' +
                '<strong>' + (item.topic || 'Unknown') + '</strong>' +
                '<span class="question-meta">' + (item.difficulty || '') + '</span>' +
                '<span class="qw-history-date">' + date + '</span>' +
                '</div>' +
                '<div class="qw-history-score ' + scoreClass + '">' + (item.ai_score || 0) + '/10</div>' +
                '</div>' +
                '<div class="qw-history-detail" style="display: none;">' +
                '<div class="qw-history-question"><strong>Question:</strong> ' + (item.question_text || '') + '</div>' +
                '<div class="qw-history-answer"><strong>Answer:</strong> ' + (item.answer || '') + '</div>';

            if (item.feedback) {
                html += '<div class="qw-history-feedback">';
                if (item.feedback.strengths) {
                    html += '<p><strong>Strengths:</strong> ' + item.feedback.strengths + '</p>';
                }
                if (item.feedback.improvements) {
                    html += '<p><strong>Improvements:</strong> ' + item.feedback.improvements + '</p>';
                }
                if (item.feedback.overall_feedback) {
                    html += '<p><strong>Feedback:</strong> ' + item.feedback.overall_feedback + '</p>';
                }
                html += '</div>';
            }

            html += '</div></div>';
        });

        listEl.innerHTML = html;
    } catch (error) {
        listEl.innerHTML = '<div class="error">Error loading history. Please try again.</div>';
    }
}

function toggleHistoryDetail(el) {
    const detail = el.querySelector('.qw-history-detail');
    if (detail) {
        detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    checkSession();
});
