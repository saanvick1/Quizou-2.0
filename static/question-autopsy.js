async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        if (!response.ok) return;
        const data = await response.json();
        if (data.logged_in) {
            document.getElementById('main-app').style.display = 'block';
            const headerActions = document.getElementById('header-actions');
            const headerWelcome = document.getElementById('header-welcome');
            const headerUsername = document.getElementById('header-username');
            if (headerActions) headerActions.style.display = 'flex';
            if (headerWelcome && headerUsername) {
                headerUsername.textContent = data.username;
                headerWelcome.style.display = 'inline';
            }
            var navMyClasses = document.getElementById('nav-my-classes');
            if (navMyClasses) {
                navMyClasses.style.display = data.role === 'teacher' ? 'inline-flex' : 'none';
            }
            prefillFromURL();
        } else {
            window.location.href = '/home';
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
}

function prefillFromURL() {
    const params = new URLSearchParams(window.location.search);
    const question = params.get('question');
    const answer = params.get('answer');
    const userAnswer = params.get('user_answer');
    const topic = params.get('topic');

    if (question) document.getElementById('autopsy-question').value = question;
    if (answer) document.getElementById('autopsy-answer').value = answer;
    if (userAnswer) document.getElementById('autopsy-user-answer').value = userAnswer;
    if (topic) document.getElementById('autopsy-topic').value = topic;

    if (question && answer) {
        analyzeQuestion();
    }
}

async function analyzeQuestion() {
    const questionText = document.getElementById('autopsy-question').value.trim();
    const answer = document.getElementById('autopsy-answer').value.trim();
    const userAnswer = document.getElementById('autopsy-user-answer').value.trim();
    const topic = document.getElementById('autopsy-topic').value.trim();
    const errorDiv = document.getElementById('autopsy-error');
    const btn = document.getElementById('autopsy-btn');

    errorDiv.textContent = '';

    if (!questionText || !answer) {
        errorDiv.textContent = 'Please fill in the question and correct answer.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Analyzing...';

    try {
        const response = await fetch('/api/autopsy/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_text: questionText,
                answer: answer,
                user_answer: userAnswer,
                topic: topic || 'General'
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            renderResults(data.analysis);
        } else {
            errorDiv.textContent = data.error || 'Error analyzing question. Please try again.';
        }
    } catch (error) {
        errorDiv.textContent = 'Error connecting to server. Please try again.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Dissect This Question';
    }
}

function renderResults(analysis) {
    document.getElementById('autopsy-form-card').style.display = 'none';
    document.getElementById('autopsy-results').style.display = 'block';

    const clueContainer = document.getElementById('clue-cards-container');
    clueContainer.innerHTML = '';
    if (analysis.clue_breakdown && analysis.clue_breakdown.length > 0) {
        analysis.clue_breakdown.forEach(function(clue) {
            const card = document.createElement('div');
            card.className = 'autopsy-clue-card';
            card.innerHTML =
                '<div class="clue-number">Clue #' + clue.clue_number + '</div>' +
                '<div class="clue-text">' + escapeHtml(clue.clue_text) + '</div>' +
                '<div class="clue-hint"><strong>What this hinted at:</strong> ' + escapeHtml(clue.what_it_hinted) + '</div>';
            clueContainer.appendChild(card);
        });
    }

    const gapText = document.getElementById('knowledge-gap-text');
    gapText.textContent = analysis.knowledge_gap || '';

    const lessonList = document.getElementById('mini-lesson-list');
    lessonList.innerHTML = '';
    if (analysis.mini_lesson && analysis.mini_lesson.length > 0) {
        analysis.mini_lesson.forEach(function(fact) {
            const li = document.createElement('div');
            li.className = 'mini-lesson-item';
            li.textContent = fact;
            lessonList.appendChild(li);
        });
    }

    const quizContainer = document.getElementById('recovery-quiz-container');
    quizContainer.innerHTML = '';
    if (analysis.recovery_questions && analysis.recovery_questions.length > 0) {
        analysis.recovery_questions.forEach(function(rq, idx) {
            const card = document.createElement('div');
            card.className = 'recovery-question-card';
            card.innerHTML =
                '<div class="recovery-q-text"><strong>Q' + (idx + 1) + ':</strong> ' + escapeHtml(rq.question) + '</div>' +
                '<div class="recovery-answer-row">' +
                    '<input type="text" class="recovery-input" id="recovery-input-' + idx + '" placeholder="Your answer..." aria-label="Recovery answer ' + (idx + 1) + '">' +
                    '<button onclick="checkRecoveryAnswer(' + idx + ', \'' + escapeAttr(rq.answer) + '\')" class="recovery-check-btn">Check</button>' +
                '</div>' +
                '<div class="recovery-feedback" id="recovery-feedback-' + idx + '"></div>';
            quizContainer.appendChild(card);
        });
    }
}

function checkRecoveryAnswer(idx, correctAnswer) {
    const input = document.getElementById('recovery-input-' + idx);
    const feedback = document.getElementById('recovery-feedback-' + idx);
    const userAnswer = input.value.trim();

    if (!userAnswer) {
        feedback.textContent = 'Please enter an answer.';
        feedback.className = 'recovery-feedback recovery-wrong';
        return;
    }

    if (fuzzyMatch(userAnswer, correctAnswer)) {
        feedback.textContent = 'Correct! ' + correctAnswer;
        feedback.className = 'recovery-feedback recovery-correct';
    } else {
        feedback.textContent = 'Not quite. The answer is: ' + correctAnswer;
        feedback.className = 'recovery-feedback recovery-wrong';
    }
}

function normalizeAnswer(text) {
    return text.toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function resetAutopsy() {
    document.getElementById('autopsy-form-card').style.display = 'block';
    document.getElementById('autopsy-results').style.display = 'none';
    document.getElementById('autopsy-question').value = '';
    document.getElementById('autopsy-answer').value = '';
    document.getElementById('autopsy-user-answer').value = '';
    document.getElementById('autopsy-topic').value = '';
    document.getElementById('autopsy-error').textContent = '';
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
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

document.addEventListener('DOMContentLoaded', async function() {
    checkSession();
});
