let currentSetId = null;

async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        if (!data.logged_in) {
            window.location.href = '/home';
        }
    } catch (error) {
        window.location.href = '/home';
    }
}

function toggleMenu() {
    const menu = document.getElementById('nav-menu');
    menu.classList.toggle('show');
}

async function loadSets() {
    try {
        const response = await fetch('/api/study-sets');
        const data = await response.json();
        if (data.success) {
            renderSets(data.sets);
        }
    } catch (error) {
        console.error('Error loading study sets:', error);
    }
}

function renderSets(sets) {
    const list = document.getElementById('sets-list');
    const empty = document.getElementById('empty-state');

    if (!sets || sets.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    list.innerHTML = sets.map(function(s) {
        return '<div class="study-set-card" onclick="openSet(' + s.id + ', \'' + escapeAttr(s.name) + '\')">' +
            '<div class="study-set-info">' +
            '<h4>' + escapeHtml(s.name) + '</h4>' +
            (s.description ? '<p>' + escapeHtml(s.description) + '</p>' : '') +
            '</div>' +
            '<div class="study-set-meta">' +
            '<span class="study-set-count">' + s.question_count + ' questions</span>' +
            '<span class="study-set-date">' + formatDate(s.created_at) + '</span>' +
            '</div>' +
            '</div>';
    }).join('');
}

function showCreateForm() {
    document.getElementById('create-set-form').style.display = 'block';
    document.getElementById('new-set-name').focus();
}

function hideCreateForm() {
    document.getElementById('create-set-form').style.display = 'none';
    document.getElementById('new-set-name').value = '';
    document.getElementById('new-set-desc').value = '';
    document.getElementById('create-error').textContent = '';
}

async function createSet() {
    const name = document.getElementById('new-set-name').value.trim();
    const description = document.getElementById('new-set-desc').value.trim();
    const errorDiv = document.getElementById('create-error');
    errorDiv.textContent = '';

    if (!name) {
        errorDiv.textContent = 'Please enter a set name.';
        return;
    }

    try {
        const response = await fetch('/api/study-sets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });
        const data = await response.json();
        if (data.success) {
            hideCreateForm();
            loadSets();
        } else {
            errorDiv.textContent = data.error || 'Error creating set.';
        }
    } catch (error) {
        errorDiv.textContent = 'Error creating set. Please try again.';
    }
}

async function openSet(id, name) {
    currentSetId = id;
    document.getElementById('sets-list').style.display = 'none';
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('create-set-form').style.display = 'none';
    document.querySelector('.study-sets-header').style.display = 'none';
    document.getElementById('set-detail').style.display = 'block';
    document.getElementById('set-detail-name').textContent = name;

    try {
        const response = await fetch('/api/study-sets/' + id + '/questions');
        const data = await response.json();
        if (data.success) {
            renderSetQuestions(data.questions);
        }
    } catch (error) {
        console.error('Error loading set questions:', error);
    }
}

function renderSetQuestions(questions) {
    const list = document.getElementById('set-questions-list');
    const empty = document.getElementById('set-empty');

    if (!questions || questions.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    list.innerHTML = questions.map(function(q) {
        return '<div class="study-set-question">' +
            '<div class="study-set-q-header">' +
            '<span class="topic-pill">' + escapeHtml(q.topic) + '</span>' +
            '<span class="difficulty-badge difficulty-' + q.difficulty.toLowerCase() + '">' + q.difficulty + '</span>' +
            '<button class="remove-q-btn" onclick="event.stopPropagation(); removeQuestion(' + q.id + ')">Remove</button>' +
            '</div>' +
            '<p class="study-set-q-text">' + escapeHtml(q.question) + '</p>' +
            '<div class="study-set-q-answer">' +
            '<button class="show-answer-btn" onclick="this.nextElementSibling.style.display=\'block\'; this.style.display=\'none\';">Show Answer</button>' +
            '<span class="answer-text" style="display:none;"><strong>Answer:</strong> ' + escapeHtml(q.answer) + '</span>' +
            '</div>' +
            '</div>';
    }).join('');
}

async function removeQuestion(questionId) {
    if (!currentSetId) return;
    try {
        const response = await fetch('/api/study-sets/' + currentSetId + '/remove/' + questionId, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
            openSet(currentSetId, document.getElementById('set-detail-name').textContent);
        }
    } catch (error) {
        console.error('Error removing question:', error);
    }
}

async function deleteCurrentSet() {
    if (!currentSetId) return;
    if (!confirm('Delete this study set? This cannot be undone.')) return;
    try {
        const response = await fetch('/api/study-sets/' + currentSetId, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
            backToList();
            loadSets();
        }
    } catch (error) {
        console.error('Error deleting set:', error);
    }
}

function practiceSet() {
    if (!currentSetId) return;
    fetch('/api/study-sets/' + currentSetId + '/questions')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.success && data.questions.length > 0) {
                localStorage.setItem('currentQuestions', JSON.stringify(data.questions));
                window.location.href = '/questions';
            } else {
                alert('No questions in this set to practice.');
            }
        });
}

function backToList() {
    currentSetId = null;
    document.getElementById('set-detail').style.display = 'none';
    document.getElementById('sets-list').style.display = '';
    document.querySelector('.study-sets-header').style.display = '';
    loadSets();
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    if (!text) return '';
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    return d.toLocaleDateString();
}

document.addEventListener('DOMContentLoaded', function() {
    checkSession();
    loadSets();
    fetch('/api/track-pageview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({page: '/study-sets'}) }).catch(function() {});

    var nameInput = document.getElementById('new-set-name');
    if (nameInput) {
        nameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') createSet();
        });
    }
});
