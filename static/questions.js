let currentQuestions = [];
let questionTimers = {};
let timerMode = false;
let timerSeconds = 30;
let activeTimerInterval = null;
let currentTimerIndex = -1;
let timerToken = 0;
let pendingTimerTimeout = null;

let buzzerMode = false;
let buzzerRevealIntervals = {};
let buzzerStates = {};
let buzzerStats = { totalBuzzes: 0, earlyBuzzCorrect: 0, earlyBuzzTotal: 0, buzzPositions: [] };

async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        
        if (data.logged_in) {
            document.getElementById('username-display').textContent = data.username;
            loadQuestions();
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

let tournamentMode = false;
let tournamentRounds = [];
let tournamentScores = { tossup: 0, bonus: 0 };
let tournamentCurrentRound = 0;
let tournamentPhase = 'tossup';
let tournamentBonusIndex = 0;
let tournamentResults = [];

function loadQuestions() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'tournament') {
        const roundData = localStorage.getItem('tournamentRound');
        if (roundData) {
            tournamentMode = true;
            tournamentRounds = JSON.parse(roundData);
            tournamentScores = { tossup: 0, bonus: 0 };
            tournamentCurrentRound = 0;
            tournamentPhase = 'tossup';
            tournamentResults = [];
            localStorage.removeItem('tournamentRound');
            displayTournamentMode();
            return;
        }
    }
    
    const questionsData = localStorage.getItem('currentQuestions');
    
    if (questionsData) {
        currentQuestions = JSON.parse(questionsData);
        displayQuestions(currentQuestions);
        localStorage.removeItem('currentQuestions');
        
        updateQuestionsTabVisibility();
        showQuizToolbar();
    } else {
        document.getElementById('questions-container').style.display = 'none';
        document.getElementById('no-questions').style.display = 'block';
        
        hideQuestionsTab();
    }
}

function showQuizToolbar() {
    const container = document.getElementById('questions-container');
    if (!container) return;

    const existing = container.querySelector('.quiz-toolbar');
    if (existing) existing.remove();

    const sharedInfo = localStorage.getItem('sharedQuizInfo');
    let sharedBanner = '';
    if (sharedInfo) {
        const info = JSON.parse(sharedInfo);
        sharedBanner = '<div class="shared-banner">Shared Quiz: <strong>' + escapeHtml(info.title) + '</strong> by ' + escapeHtml(info.creator) + '</div>';
        localStorage.removeItem('sharedQuizInfo');
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'quiz-toolbar';
    toolbar.innerHTML = sharedBanner +
        '<div class="toolbar-actions">' +
        '<div class="mid-quiz-difficulty">' +
        '<label>Difficulty: </label>' +
        '<select id="mid-difficulty" onchange="changeDifficultyMidQuiz()">' +
        '<option value="">Keep Current</option>' +
        '<option value="Easy">Easy</option>' +
        '<option value="Medium">Medium</option>' +
        '<option value="Hard">Hard</option>' +
        '</select>' +
        '</div>' +
        '<div class="timer-toggle">' +
        '<label class="toggle-switch">' +
        '<input type="checkbox" id="timer-mode-toggle" onchange="toggleTimerMode()" ' + (timerMode ? 'checked' : '') + '>' +
        '<span class="toggle-slider"></span>' +
        '</label>' +
        '<span class="timer-label">Timer</span>' +
        '<select id="timer-duration" onchange="updateTimerDuration()" class="timer-select"' + (timerMode ? '' : ' style="display:none;"') + '>' +
        '<option value="15"' + (timerSeconds === 15 ? ' selected' : '') + '>15s</option>' +
        '<option value="30"' + (timerSeconds === 30 ? ' selected' : '') + '>30s</option>' +
        '<option value="45"' + (timerSeconds === 45 ? ' selected' : '') + '>45s</option>' +
        '<option value="60"' + (timerSeconds === 60 ? ' selected' : '') + '>60s</option>' +
        '<option value="90"' + (timerSeconds === 90 ? ' selected' : '') + '>90s</option>' +
        '</select>' +
        '</div>' +
        '<div class="buzzer-toggle">' +
        '<label class="toggle-switch">' +
        '<input type="checkbox" id="buzzer-mode-toggle" onchange="toggleBuzzerMode()" ' + (buzzerMode ? 'checked' : '') + '>' +
        '<span class="toggle-slider"></span>' +
        '</label>' +
        '<span class="timer-label">Buzzer</span>' +
        '</div>' +
        '<button class="share-quiz-btn" onclick="openShareDialog()">Share This Quiz</button>' +
        '</div>';
    container.insertBefore(toolbar, container.firstChild);
}

async function changeDifficultyMidQuiz() {
    const newDiff = document.getElementById('mid-difficulty').value;
    if (!newDiff) return;

    const topic = currentQuestions.length > 0 ? currentQuestions[0].topic : '';
    if (!topic) return;

    const sel = document.getElementById('mid-difficulty');
    sel.disabled = true;

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: topic, difficulty: newDiff, num_questions: 3 })
        });
        const data = await response.json();
        if (response.ok && data.questions) {
            data.questions.forEach(q => currentQuestions.push(q));
            displayQuestions(currentQuestions);
            showQuizToolbar();
            const container = document.getElementById('questions-container');
            const allBoxes = container.querySelectorAll('.question-box');
            if (allBoxes.length > 0) {
                allBoxes[allBoxes.length - data.questions.length].scrollIntoView({ behavior: 'smooth' });
            }
        }
    } catch (e) {
        console.error('Error changing difficulty:', e);
    } finally {
        sel.disabled = false;
        sel.value = '';
    }
}

function toggleTimerMode() {
    const toggle = document.getElementById('timer-mode-toggle');
    timerMode = toggle.checked;
    const durationSelect = document.getElementById('timer-duration');
    if (durationSelect) durationSelect.style.display = timerMode ? 'inline-block' : 'none';

    clearActiveTimer();
    document.querySelectorAll('.question-timer').forEach(el => {
        el.style.display = timerMode ? 'flex' : 'none';
    });
    document.querySelectorAll('.timer-bar-container').forEach(el => {
        el.style.display = timerMode ? 'block' : 'none';
    });

    if (timerMode) {
        const firstUnanswered = findFirstUnansweredIndex();
        if (firstUnanswered >= 0) startTimerForQuestion(firstUnanswered);
    }
}

function isQuestionAnswered(index) {
    const inputArea = document.getElementById('answer-input-area-' + index);
    const resultDiv = document.getElementById('answer-result-' + index);
    const buttonsDiv = document.getElementById('answer-buttons-' + index);
    return (inputArea && inputArea.style.display === 'none') ||
           (resultDiv && resultDiv.style.display !== 'none') ||
           (buttonsDiv && buttonsDiv.innerHTML.includes('Response recorded'));
}

function updateTimerDuration() {
    const sel = document.getElementById('timer-duration');
    timerSeconds = parseInt(sel.value) || 30;
    if (timerMode && currentTimerIndex >= 0) {
        startTimerForQuestion(currentTimerIndex);
    }
}

function findFirstUnansweredIndex() {
    for (let i = 0; i < currentQuestions.length; i++) {
        const inputArea = document.getElementById('answer-input-area-' + i);
        const resultDiv = document.getElementById('answer-result-' + i);
        const buttonsDiv = document.getElementById('answer-buttons-' + i);
        const answered = (inputArea && inputArea.style.display === 'none') ||
                         (resultDiv && resultDiv.style.display !== 'none') ||
                         (buttonsDiv && buttonsDiv.innerHTML.includes('Response recorded'));
        if (!answered) return i;
    }
    return -1;
}

function startTimerForQuestion(index) {
    clearActiveTimer();
    currentTimerIndex = index;

    const timerEl = document.getElementById('timer-display-' + index);
    const barEl = document.getElementById('timer-bar-' + index);
    if (!timerEl || !barEl) return;

    let remaining = timerSeconds;
    timerEl.textContent = remaining + 's';
    timerEl.className = 'timer-value';
    barEl.style.width = '100%';
    barEl.className = 'timer-bar';

    const questionBox = document.getElementById('question-' + index);
    if (questionBox) questionBox.scrollIntoView({ behavior: 'smooth', block: 'center' });

    activeTimerInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearActiveTimer();
            timerEl.textContent = "Time's up!";
            timerEl.className = 'timer-value timer-expired';
            barEl.style.width = '0%';
            onTimerExpired(index);
        } else {
            timerEl.textContent = remaining + 's';
            barEl.style.width = (remaining / timerSeconds * 100) + '%';
            if (remaining <= 5) {
                timerEl.className = 'timer-value timer-warning';
                barEl.className = 'timer-bar timer-bar-warning';
            } else if (remaining <= 10) {
                timerEl.className = 'timer-value timer-caution';
                barEl.className = 'timer-bar timer-bar-caution';
            }
        }
    }, 1000);
}

function clearActiveTimer() {
    if (activeTimerInterval) {
        clearInterval(activeTimerInterval);
        activeTimerInterval = null;
    }
    if (pendingTimerTimeout) {
        clearTimeout(pendingTimerTimeout);
        pendingTimerTimeout = null;
    }
    timerToken++;
    currentTimerIndex = -1;
}

function onTimerExpired(index) {
    if (!timerMode) return;
    if (isQuestionAnswered(index)) return;

    const inputArea = document.getElementById('answer-input-area-' + index);
    if (inputArea && inputArea.style.display !== 'none') {
        const input = document.getElementById('answer-input-' + index);
        if (input && input.value.trim()) {
            checkMyAnswer(index);
        } else {
            toggleAnswer(index);
        }
    }

    const token = timerToken;
    pendingTimerTimeout = setTimeout(() => {
        if (!timerMode || token !== timerToken) return;
        const next = findFirstUnansweredIndex();
        if (next >= 0) startTimerForQuestion(next);
    }, 1500);
}

function advanceTimerToNext(index) {
    if (!timerMode) return;
    const token = timerToken;
    pendingTimerTimeout = setTimeout(() => {
        if (!timerMode || token !== timerToken) return;
        const next = findFirstUnansweredIndex();
        if (next >= 0) startTimerForQuestion(next);
        else clearActiveTimer();
    }, 500);
}

function openShareDialog() {
    if (!currentQuestions.length) return;

    const existing = document.getElementById('share-dialog-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'share-dialog-overlay';
    overlay.className = 'share-overlay';
    overlay.innerHTML =
        '<div class="share-dialog">' +
        '<h3>Share This Quiz</h3>' +
        '<label>Title</label>' +
        '<input type="text" id="share-title" placeholder="e.g., Biology Practice Set 1" maxlength="100">' +
        '<label>Description (optional)</label>' +
        '<input type="text" id="share-desc" placeholder="Short description" maxlength="200">' +
        '<div class="share-dialog-btns">' +
        '<button onclick="submitShareQuiz()">Share</button>' +
        '<button class="cancel-btn" onclick="document.getElementById(\'share-dialog-overlay\').remove()">Cancel</button>' +
        '</div>' +
        '<div id="share-result" class="share-result"></div>' +
        '</div>';
    document.body.appendChild(overlay);
}

async function submitShareQuiz() {
    const title = document.getElementById('share-title').value.trim();
    const desc = document.getElementById('share-desc').value.trim();
    const resultDiv = document.getElementById('share-result');

    if (!title) { resultDiv.textContent = 'Please enter a title.'; return; }

    const qIds = currentQuestions.map(q => q.id).filter(id => id);
    if (!qIds.length) { resultDiv.textContent = 'No valid questions to share.'; return; }

    try {
        const response = await fetch('/api/share-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_ids: qIds, title: title, description: desc })
        });
        const data = await response.json();
        if (response.ok && data.share_code) {
            resultDiv.innerHTML = '<div class="share-success">Share code: <strong>' + data.share_code + '</strong><br><small>Share this code with friends to let them practice with these questions!</small></div>';
        } else {
            resultDiv.textContent = data.error || 'Error sharing quiz.';
        }
    } catch (e) {
        resultDiv.textContent = 'Error sharing quiz.';
    }
}

function updateQuestionsTabVisibility() {
    const questionsTab = document.getElementById('questions-tab');
    if (questionsTab) {
        questionsTab.style.display = 'inline-block';
    }
}

function hideQuestionsTab() {
    const questionsTab = document.getElementById('questions-tab');
    if (questionsTab) {
        questionsTab.style.display = 'none';
    }
}

function displayQuestions(questions) {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    
    questions.forEach((q, index) => {
        const questionBox = document.createElement('div');
        questionBox.className = 'question-box';
        questionBox.id = `question-${index}`;
        
        questionTimers[index] = Date.now();
        
        questionBox.innerHTML = `
            <div class="question-header">
                <span><strong>Question ${index + 1}</strong></span>
                <span class="question-meta">${escapeHtml(q.topic)} | ${q.difficulty}</span>
            </div>
            <div class="question-timer" id="question-timer-${index}" style="display:none;">
                <span class="timer-value" id="timer-display-${index}">--</span>
            </div>
            <div class="timer-bar-container" id="timer-bar-container-${index}" style="display:none;">
                <div class="timer-bar" id="timer-bar-${index}"></div>
            </div>
            <div class="question-text" id="question-text-${index}">${buzzerMode ? '' : escapeHtml(q.question)}</div>
            <div class="buzzer-area" id="buzzer-area-${index}" style="display:none;">
                <button class="buzz-btn" id="buzz-btn-${index}" onclick="buzzIn(${index})">BUZZ IN</button>
                <div class="buzzer-progress" id="buzzer-progress-${index}">
                    <div class="buzzer-progress-bar" id="buzzer-bar-${index}"></div>
                </div>
                <div class="buzzer-score-info" id="buzzer-score-info-${index}"></div>
            </div>
            <div class="question-actions">
                <button class="listen-btn" onclick="listenToQuestion(${index})" title="Listen to question">Listen</button>
                <button class="stop-listen-btn" onclick="stopListening()" style="display:none;" id="stop-listen-${index}">Stop</button>
            </div>
            <div class="answer-section">
                <div class="answer-input-area" id="answer-input-area-${index}">
                    <div class="answer-input-row">
                        <input type="text" class="answer-input" id="answer-input-${index}" placeholder="Type your answer..." autocomplete="off">
                        <button class="mic-btn" onclick="speakAnswer(${index})" id="mic-btn-${index}" title="Speak your answer">Mic</button>
                    </div>
                    <div id="speech-status-${index}" class="speech-status"></div>
                    <div class="answer-submit-row">
                        <button class="check-answer-btn" onclick="checkMyAnswer(${index})">Check Answer</button>
                        <button class="skip-btn" onclick="toggleAnswer(${index})">Show Answer</button>
                    </div>
                </div>
                <div id="answer-result-${index}" class="answer-result" style="display:none;"></div>
                <div id="answer-${index}" class="answer-text" style="display: none;">
                    <strong>Answer:</strong> ${escapeHtml(q.answer)}
                </div>
                <div class="answer-buttons" id="answer-buttons-${index}" style="display: none;">
                    <button class="correct-btn" data-question-id="${q.id}" data-index="${index}" data-correct="true">I Got It Right</button>
                    <button class="incorrect-btn" data-question-id="${q.id}" data-index="${index}" data-correct="false">I Got It Wrong</button>
                </div>
                <div id="explanation-${index}" class="explanation-section" style="display: none;"></div>
                <div id="rating-${index}" class="rating-section" style="display: none;">
                    <p><strong>Rate this question:</strong></p>
                    <div class="star-rating">
                        <span class="star" data-question-id="${q.id}" data-rating="1" data-index="${index}">*</span>
                        <span class="star" data-question-id="${q.id}" data-rating="2" data-index="${index}">*</span>
                        <span class="star" data-question-id="${q.id}" data-rating="3" data-index="${index}">*</span>
                        <span class="star" data-question-id="${q.id}" data-rating="4" data-index="${index}">*</span>
                        <span class="star" data-question-id="${q.id}" data-rating="5" data-index="${index}">*</span>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(questionBox);
        
        const answerInput = questionBox.querySelector(`#answer-input-${index}`);
        if (answerInput) {
            answerInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') checkMyAnswer(index);
            });
        }
        
        const correctBtn = questionBox.querySelector('.correct-btn');
        const incorrectBtn = questionBox.querySelector('.incorrect-btn');
        const stars = questionBox.querySelectorAll('.star');
        
        if (correctBtn) {
            correctBtn.addEventListener('click', function() {
                submitAnswerAdvanced(q.id, true, index, q.question, q.answer);
            });
        }
        
        if (incorrectBtn) {
            incorrectBtn.addEventListener('click', function() {
                submitAnswerAdvanced(q.id, false, index, q.question, q.answer);
            });
        }
        
        stars.forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.getAttribute('data-rating'));
                const questionId = parseInt(this.getAttribute('data-question-id'));
                const idx = parseInt(this.getAttribute('data-index'));
                rateQuestion(questionId, rating, idx);
            });
        });
    });
}

function listenToQuestion(index) {
    if (!('speechSynthesis' in window)) {
        alert('Your browser does not support text-to-speech.');
        return;
    }
    window.speechSynthesis.cancel();
    const q = currentQuestions[index];
    if (!q) return;
    const utterance = new SpeechSynthesisUtterance(q.question);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    const stopBtn = document.getElementById('stop-listen-' + index);
    if (stopBtn) stopBtn.style.display = 'inline-block';
    utterance.onend = function() { if (stopBtn) stopBtn.style.display = 'none'; };
    utterance.onerror = function() { if (stopBtn) stopBtn.style.display = 'none'; };
    window.speechSynthesis.speak(utterance);
}

function stopListening() {
    window.speechSynthesis.cancel();
    document.querySelectorAll('.stop-listen-btn').forEach(b => b.style.display = 'none');
}

let activeRecognition = null;

function speakAnswer(index) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Your browser does not support speech recognition. Try Chrome or Edge.');
        return;
    }

    if (activeRecognition) {
        activeRecognition.abort();
        activeRecognition = null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    activeRecognition = recognition;

    const input = document.getElementById('answer-input-' + index);
    const micBtn = document.getElementById('mic-btn-' + index);
    const statusDiv = document.getElementById('speech-status-' + index);

    micBtn.classList.add('mic-active');
    statusDiv.textContent = 'Listening...';
    statusDiv.style.display = 'block';

    recognition.onresult = function(event) {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        input.value = transcript;
        if (event.results[event.results.length - 1].isFinal) {
            statusDiv.textContent = 'Got it!';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 1500);
        }
    };

    recognition.onerror = function(event) {
        micBtn.classList.remove('mic-active');
        if (event.error === 'no-speech') {
            statusDiv.textContent = 'No speech detected. Try again.';
        } else if (event.error === 'not-allowed') {
            statusDiv.textContent = 'Microphone access denied. Check browser permissions.';
        } else {
            statusDiv.textContent = 'Error: ' + event.error;
        }
        setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
        activeRecognition = null;
    };

    recognition.onend = function() {
        micBtn.classList.remove('mic-active');
        activeRecognition = null;
    };

    recognition.start();
}

async function checkMyAnswer(index) {
    const q = currentQuestions[index];
    if (!q || !q.id) return;

    const input = document.getElementById('answer-input-' + index);
    const userAnswer = input.value.trim();
    if (!userAnswer) { input.focus(); return; }

    const resultDiv = document.getElementById('answer-result-' + index);
    resultDiv.style.display = 'block';
    resultDiv.className = 'answer-result checking';
    resultDiv.textContent = 'Checking...';

    try {
        const response = await fetch('/api/check-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_id: q.id, user_answer: userAnswer })
        });
        const data = await response.json();

        const inputArea = document.getElementById('answer-input-area-' + index);
        inputArea.style.display = 'none';

        const buttonsDiv = document.getElementById('answer-buttons-' + index);
        buttonsDiv.style.display = 'none';

        if (data.correct) {
            let matchMsg = '';
            if (data.match_type === 'exact') matchMsg = 'Perfect match!';
            else if (data.match_type === 'close') matchMsg = 'Close enough! (minor typo accepted)';
            else if (data.match_type === 'partial') matchMsg = 'Partial match accepted!';
            else if (data.match_type === 'keyword') matchMsg = 'Key words matched!';

            let buzzerPts = '';
            if (buzzerMode && buzzerStates[index]) {
                const pts = getBuzzerScoreForQuestion(index, true);
                buzzerPts = ' <span class="buzzer-correct">(+' + pts + ' buzzer pts)</span>';
                showBuzzerResult(index, true);
            }

            resultDiv.className = 'answer-result correct';
            resultDiv.innerHTML = '<strong>Correct!</strong> ' + matchMsg + buzzerPts +
                '<div class="result-detail">Your answer: ' + escapeHtml(userAnswer) +
                '<br>Accepted answer: ' + escapeHtml(data.correct_answer) + '</div>';

            submitAnswerAdvanced(q.id, true, index, q.question, q.answer);
        } else {
            let buzzerPts = '';
            if (buzzerMode && buzzerStates[index]) {
                const pts = getBuzzerScoreForQuestion(index, false);
                buzzerPts = ' <span class="buzzer-wrong">(' + pts + ' buzzer pts)</span>';
                showBuzzerResult(index, false);
            }

            resultDiv.className = 'answer-result incorrect';
            resultDiv.innerHTML = '<strong>Not quite.</strong>' + buzzerPts +
                '<div class="result-detail">Your answer: ' + escapeHtml(userAnswer) +
                '<br>Correct answer: ' + escapeHtml(data.correct_answer) + '</div>';

            submitAnswerAdvanced(q.id, false, index, q.question, q.answer);
        }

        document.getElementById('answer-' + index).style.display = 'block';

        if (data.correct && 'speechSynthesis' in window) {
            const msg = new SpeechSynthesisUtterance('Correct!');
            msg.rate = 1;
            window.speechSynthesis.speak(msg);
        }

        advanceTimerToNext(index);

    } catch (e) {
        resultDiv.className = 'answer-result incorrect';
        resultDiv.textContent = 'Error checking answer. Try again.';
    }
}

function toggleAnswer(index) {
    const answerDiv = document.getElementById(`answer-${index}`);
    const buttonsDiv = document.getElementById(`answer-buttons-${index}`);
    const inputArea = document.getElementById(`answer-input-area-${index}`);
    
    if (answerDiv.style.display === 'none') {
        answerDiv.style.display = 'block';
        buttonsDiv.style.display = 'flex';
        if (inputArea) inputArea.style.display = 'none';
    }

    if (buzzerMode && buzzerStates[index]) {
        const state = buzzerStates[index];
        if (buzzerRevealIntervals[index]) {
            clearInterval(buzzerRevealIntervals[index]);
            delete buzzerRevealIntervals[index];
        }
        const textEl = document.getElementById('question-text-' + index);
        if (textEl && state.words) textEl.textContent = state.words.join(' ');
        const buzzBtn = document.getElementById('buzz-btn-' + index);
        if (buzzBtn) buzzBtn.style.display = 'none';
    }
}

async function submitAnswerAdvanced(questionId, correct, index, questionText, correctAnswer) {
    const timeTaken = Math.floor((Date.now() - questionTimers[index]) / 1000);
    
    try {
        const response = await fetch('/api/submit-answer-advanced', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question_id: questionId, 
                correct: correct,
                time_taken: timeTaken
            })
        });
        
        const data = await response.json();
        
        const buttonsDiv = document.getElementById(`answer-buttons-${index}`);
        let buzzerInfo = '';
        if (buzzerMode && buzzerStates[index]) {
            const pts = getBuzzerScoreForQuestion(index, correct);
            buzzerInfo = correct ? ' (+' + pts + ' buzzer pts)' : ' (' + pts + ' buzzer pts)';
            showBuzzerResult(index, correct);
        }
        buttonsDiv.innerHTML = `<p style="color: ${correct ? '#27ae60' : '#e74c3c'};">Response recorded! ${correct ? 'Correct ✓' : 'Incorrect ✗'}${buzzerInfo}</p>`;
        
        const explanationBtn = document.createElement('button');
        explanationBtn.textContent = '💡 Explain This Answer';
        explanationBtn.className = 'explain-btn';
        explanationBtn.onclick = () => getExplanation(questionText, correctAnswer, '', correct, index);
        buttonsDiv.appendChild(explanationBtn);

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '📁 Save to Set';
        saveBtn.className = 'save-to-set-btn';
        saveBtn.onclick = () => showSaveToSetDropdown(index, currentQuestions[index].id);
        buttonsDiv.appendChild(saveBtn);
        
        document.getElementById(`rating-${index}`).style.display = 'block';

        advanceTimerToNext(index);
        
    } catch (error) {
        console.error('Error submitting answer:', error);
    }
}

async function getExplanation(question, correctAnswer, userAnswer, wasCorrect, index) {
    const explanationDiv = document.getElementById(`explanation-${index}`);
    explanationDiv.innerHTML = '<div class="loading">Loading explanation...</div>';
    explanationDiv.style.display = 'block';
    
    try {
        const response = await fetch('/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question,
                correct_answer: correctAnswer,
                user_answer: userAnswer,
                was_correct: wasCorrect
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.explanation) {
            displayExplanation(data.explanation, index);
        } else {
            explanationDiv.innerHTML = '<p>Error loading explanation</p>';
        }
    } catch (error) {
        explanationDiv.innerHTML = '<p>Error loading explanation</p>';
        console.error('Error:', error);
    }
}

function displayExplanation(explanation, index) {
    const explanationDiv = document.getElementById(`explanation-${index}`);
    
    let html = '<div class="explanation-content">';
    html += '<h4>📚 Explanation:</h4>';
    html += `<p>${escapeHtml(explanation.explanation)}</p>`;
    
    if (explanation.key_facts && explanation.key_facts.length > 0) {
        html += '<h5>🔑 Key Facts:</h5><ul>';
        explanation.key_facts.forEach(fact => {
            html += `<li>${escapeHtml(fact)}</li>`;
        });
        html += '</ul>';
    }
    
    if (explanation.hint) {
        html += `<div class="hint-box">💡 <strong>Hint:</strong> ${escapeHtml(explanation.hint)}</div>`;
    }
    
    html += '</div>';
    explanationDiv.innerHTML = html;
}

async function rateQuestion(questionId, rating, index) {
    try {
        await fetch('/api/rate-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_id: questionId,
                rating: rating
            })
        });
        
        const ratingDiv = document.getElementById(`rating-${index}`);
        ratingDiv.innerHTML = `<p style="color: #27ae60;">✓ Thank you for your feedback! (${rating}/5 stars)</p>`;
    } catch (error) {
        console.error('Error rating question:', error);
    }
}

function toggleBuzzerMode() {
    const toggle = document.getElementById('buzzer-mode-toggle');
    buzzerMode = toggle.checked;

    Object.keys(buzzerRevealIntervals).forEach(k => {
        clearInterval(buzzerRevealIntervals[k]);
        delete buzzerRevealIntervals[k];
    });

    currentQuestions.forEach((q, index) => {
        const textEl = document.getElementById('question-text-' + index);
        const buzzerArea = document.getElementById('buzzer-area-' + index);
        if (!textEl || !buzzerArea) return;

        if (buzzerMode && !isQuestionAnswered(index)) {
            buzzerStates[index] = { words: q.question.split(/\s+/), revealed: 0, buzzed: false, totalWords: q.question.split(/\s+/).length };
            textEl.textContent = '';
            buzzerArea.style.display = 'flex';
            const inputArea = document.getElementById('answer-input-area-' + index);
            if (inputArea) inputArea.style.display = 'none';
            startBuzzerReveal(index);
        } else {
            textEl.textContent = q.question;
            buzzerArea.style.display = 'none';
            if (!isQuestionAnswered(index)) {
                const inputArea = document.getElementById('answer-input-area-' + index);
                if (inputArea) inputArea.style.display = 'block';
            }
            delete buzzerStates[index];
        }
    });
}

function startBuzzerReveal(index) {
    const state = buzzerStates[index];
    if (!state || state.buzzed) return;

    const textEl = document.getElementById('question-text-' + index);
    const barEl = document.getElementById('buzzer-bar-' + index);
    const scoreInfo = document.getElementById('buzzer-score-info-' + index);

    buzzerRevealIntervals[index] = setInterval(() => {
        if (!buzzerMode || state.buzzed || state.revealed >= state.totalWords) {
            clearInterval(buzzerRevealIntervals[index]);
            delete buzzerRevealIntervals[index];

            if (state.revealed >= state.totalWords && !state.buzzed) {
                const inputArea = document.getElementById('answer-input-area-' + index);
                if (inputArea) inputArea.style.display = 'block';
                const buzzBtn = document.getElementById('buzz-btn-' + index);
                if (buzzBtn) buzzBtn.style.display = 'none';
                if (scoreInfo) scoreInfo.textContent = 'Full question revealed - 10 pts';
            }
            return;
        }

        state.revealed++;
        textEl.textContent = state.words.slice(0, state.revealed).join(' ');

        const pct = state.revealed / state.totalWords;
        if (barEl) barEl.style.width = (pct * 100) + '%';

        const pts = getBuzzerPoints(pct);
        if (scoreInfo) scoreInfo.textContent = 'Buzz now: ' + pts + ' pts';
    }, 400);
}

function getBuzzerPoints(revealPct) {
    if (revealPct <= 0.2) return 30;
    if (revealPct <= 0.4) return 25;
    if (revealPct <= 0.6) return 20;
    if (revealPct <= 0.8) return 15;
    return 10;
}

function buzzIn(index) {
    const state = buzzerStates[index];
    if (!state || state.buzzed) return;

    state.buzzed = true;
    if (buzzerRevealIntervals[index]) {
        clearInterval(buzzerRevealIntervals[index]);
        delete buzzerRevealIntervals[index];
    }

    const buzzBtn = document.getElementById('buzz-btn-' + index);
    if (buzzBtn) {
        buzzBtn.disabled = true;
        buzzBtn.textContent = 'BUZZED!';
        buzzBtn.classList.add('buzzed');
    }

    const pct = state.revealed / state.totalWords;
    state.buzzPosition = pct;
    state.potentialPoints = getBuzzerPoints(pct);

    const scoreInfo = document.getElementById('buzzer-score-info-' + index);
    if (scoreInfo) scoreInfo.textContent = 'Potential: ' + state.potentialPoints + ' pts (wrong = -5 pts)';

    const inputArea = document.getElementById('answer-input-area-' + index);
    if (inputArea) inputArea.style.display = 'block';
    const input = document.getElementById('answer-input-' + index);
    if (input) input.focus();

    buzzerStats.totalBuzzes++;
    buzzerStats.buzzPositions.push(pct);
    if (pct <= 0.5) buzzerStats.earlyBuzzTotal++;
}

function handleBuzzerSpacebar(e) {
    if (!buzzerMode) return;
    if (e.code !== 'Space') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    e.preventDefault();
    for (let i = 0; i < currentQuestions.length; i++) {
        const state = buzzerStates[i];
        if (state && !state.buzzed && !isQuestionAnswered(i)) {
            buzzIn(i);
            break;
        }
    }
}

document.addEventListener('keydown', handleBuzzerSpacebar);

function getBuzzerScoreForQuestion(index, correct) {
    const state = buzzerStates[index];
    if (!state) return 0;

    if (correct) {
        if (state.buzzPosition <= 0.5) buzzerStats.earlyBuzzCorrect++;
        return state.potentialPoints || 10;
    } else {
        return -5;
    }
}

function showBuzzerResult(index, correct) {
    const state = buzzerStates[index];
    if (!state) return;

    const pts = getBuzzerScoreForQuestion(index, correct);
    const scoreInfo = document.getElementById('buzzer-score-info-' + index);
    if (scoreInfo) {
        if (correct) {
            scoreInfo.innerHTML = '<span class="buzzer-correct">+' + pts + ' pts</span>';
        } else {
            scoreInfo.innerHTML = '<span class="buzzer-wrong">' + pts + ' pts (penalty)</span>';
        }
    }

    const textEl = document.getElementById('question-text-' + index);
    if (textEl && state.words) {
        textEl.textContent = state.words.join(' ');
    }
}

function getBuzzerStatsDisplay() {
    if (buzzerStats.totalBuzzes === 0) return '';
    const avgPos = buzzerStats.buzzPositions.reduce((a, b) => a + b, 0) / buzzerStats.buzzPositions.length;
    const earlyAcc = buzzerStats.earlyBuzzTotal > 0 ? Math.round((buzzerStats.earlyBuzzCorrect / buzzerStats.earlyBuzzTotal) * 100) : 0;
    return '<div class="buzzer-stats-summary">' +
        '<strong>Buzzer Stats:</strong> ' +
        'Avg buzz position: ' + Math.round(avgPos * 100) + '% | ' +
        'Early buzz accuracy: ' + earlyAcc + '% (' + buzzerStats.earlyBuzzCorrect + '/' + buzzerStats.earlyBuzzTotal + ')' +
        '</div>';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function showSaveToSetDropdown(index, questionId) {
    const existing = document.getElementById('save-set-dropdown-' + index);
    if (existing) { existing.remove(); return; }

    const buttonsDiv = document.getElementById('submit-buttons-' + index) || 
                       document.querySelectorAll('.question-box')[index];
    if (!buttonsDiv) return;

    const dropdown = document.createElement('div');
    dropdown.id = 'save-set-dropdown-' + index;
    dropdown.className = 'save-set-dropdown';
    dropdown.innerHTML = '<p>Loading sets...</p>';
    buttonsDiv.appendChild(dropdown);

    try {
        const response = await fetch('/api/study-sets');
        const data = await response.json();
        if (!data.success) { dropdown.innerHTML = '<p>Error loading sets</p>'; return; }

        let html = '<div class="save-set-options">';
        if (data.sets && data.sets.length > 0) {
            data.sets.forEach(function(s) {
                html += '<button class="save-set-option" onclick="addToSet(' + s.id + ', ' + questionId + ', ' + index + ')">' +
                    escapeHtml(s.name) + ' (' + s.question_count + ')' + '</button>';
            });
        }
        html += '<div class="save-set-new">' +
            '<input type="text" id="new-set-inline-' + index + '" placeholder="New set name...">' +
            '<button onclick="createAndAddToSet(' + index + ', ' + questionId + ')">Create & Add</button>' +
            '</div></div>';
        dropdown.innerHTML = html;
    } catch (e) {
        dropdown.innerHTML = '<p>Error loading sets</p>';
    }
}

async function addToSet(setId, questionId, index) {
    try {
        const response = await fetch('/api/study-sets/' + setId + '/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_id: questionId })
        });
        const data = await response.json();
        const dropdown = document.getElementById('save-set-dropdown-' + index);
        if (data.success) {
            if (dropdown) dropdown.innerHTML = '<p style="color:#16a34a;font-weight:600;">Saved!</p>';
            setTimeout(function() { if (dropdown) dropdown.remove(); }, 1500);
        } else {
            if (dropdown) dropdown.innerHTML = '<p style="color:#ea580c;">' + (data.error || 'Error') + '</p>';
            setTimeout(function() { if (dropdown) dropdown.remove(); }, 2000);
        }
    } catch (e) {
        console.error('Error adding to set:', e);
    }
}

async function createAndAddToSet(index, questionId) {
    const input = document.getElementById('new-set-inline-' + index);
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;

    try {
        const createResponse = await fetch('/api/study-sets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, description: '' })
        });
        const createData = await createResponse.json();
        if (createData.success) {
            await addToSet(createData.id, questionId, index);
        }
    } catch (e) {
        console.error('Error creating set:', e);
    }
}

function displayTournamentMode() {
    const container = document.getElementById('questions-container');
    const noQ = document.getElementById('no-questions');
    if (noQ) noQ.style.display = 'none';
    container.style.display = 'block';
    container.innerHTML = '';

    const topic = localStorage.getItem('tournamentTopic') || 'Tournament';
    localStorage.removeItem('tournamentTopic');

    const header = document.createElement('div');
    header.className = 'tournament-header';
    header.innerHTML = '<h2>Tournament Round</h2><p>' + escapeHtml(topic) + ' - ' + tournamentRounds.length + ' Toss-Ups + Bonuses</p>';
    container.appendChild(header);

    const scoreboard = document.createElement('div');
    scoreboard.className = 'tournament-scoreboard';
    scoreboard.id = 'tournament-scoreboard';
    scoreboard.innerHTML =
        '<div class="tournament-score-card"><div class="score-label">Toss-Up</div><div class="score-value" id="t-tossup-score">0</div></div>' +
        '<div class="tournament-score-card"><div class="score-label">Bonus</div><div class="score-value" id="t-bonus-score">0</div></div>' +
        '<div class="tournament-score-card"><div class="score-label">Total</div><div class="score-value" id="t-total-score">0</div></div>';
    container.appendChild(scoreboard);

    const area = document.createElement('div');
    area.id = 'tournament-area';
    container.appendChild(area);

    showTournamentQuestion();
}

function showTournamentQuestion() {
    const area = document.getElementById('tournament-area');
    if (!area) return;

    if (tournamentCurrentRound >= tournamentRounds.length) {
        showTournamentFinal();
        return;
    }

    const round = tournamentRounds[tournamentCurrentRound];
    const tossup = round.tossup;

    if (tournamentPhase === 'tossup') {
        area.innerHTML =
            '<div class="question-box">' +
            '<div class="question-header"><span class="question-number">Toss-Up ' + (tournamentCurrentRound + 1) + ' of ' + tournamentRounds.length + '</span><span class="question-points">10 pts</span></div>' +
            '<div class="question-text">' + escapeHtml(tossup.question) + '</div>' +
            '<div class="answer-check-row" style="margin-top:12px;">' +
            '<input type="text" id="t-tossup-input" placeholder="Type your answer..." class="answer-text-input">' +
            '<button onclick="checkTournamentTossup()" class="check-answer-btn">Check Answer</button>' +
            '</div>' +
            '<div id="t-tossup-result" style="margin-top:8px;"></div>' +
            '<button id="t-show-answer-btn" onclick="showTournamentTossupAnswer()" class="show-answer-btn" style="margin-top:8px;">Show Answer</button>' +
            '</div>';
        
        setTimeout(() => {
            const input = document.getElementById('t-tossup-input');
            if (input) {
                input.focus();
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') checkTournamentTossup();
                });
            }
        }, 100);
    }
}

function checkTournamentTossup() {
    const input = document.getElementById('t-tossup-input');
    const resultDiv = document.getElementById('t-tossup-result');
    if (!input || !resultDiv) return;
    const userAnswer = input.value.trim();
    if (!userAnswer) return;

    const round = tournamentRounds[tournamentCurrentRound];
    const correct = fuzzyMatch(userAnswer, round.tossup.answer);

    input.disabled = true;
    document.querySelector('.check-answer-btn').disabled = true;
    const showBtn = document.getElementById('t-show-answer-btn');
    if (showBtn) showBtn.style.display = 'none';

    if (correct) {
        tournamentScores.tossup += 10;
        resultDiv.innerHTML = '<div class="result-correct">Correct! +10 pts. Answer: ' + escapeHtml(round.tossup.answer) + '</div>';
        tournamentResults.push({ round: tournamentCurrentRound, tossupCorrect: true, bonusCorrect: [false, false, false] });
        updateTournamentScoreboard();
        setTimeout(() => {
            tournamentPhase = 'bonus';
            showTournamentBonus();
        }, 1200);
    } else {
        resultDiv.innerHTML = '<div class="result-incorrect">Incorrect. The answer was: ' + escapeHtml(round.tossup.answer) + '</div>';
        tournamentResults.push({ round: tournamentCurrentRound, tossupCorrect: false, bonusCorrect: [false, false, false] });
        updateTournamentScoreboard();
        setTimeout(() => {
            tournamentCurrentRound++;
            tournamentPhase = 'tossup';
            showTournamentQuestion();
        }, 1500);
    }
}

function showTournamentTossupAnswer() {
    const round = tournamentRounds[tournamentCurrentRound];
    const resultDiv = document.getElementById('t-tossup-result');
    const input = document.getElementById('t-tossup-input');
    const showBtn = document.getElementById('t-show-answer-btn');
    if (showBtn) showBtn.style.display = 'none';
    if (input) input.disabled = true;
    
    const userAnswer = input ? input.value.trim() : '';
    const correct = userAnswer ? fuzzyMatch(userAnswer, round.tossup.answer) : false;

    if (correct) {
        tournamentScores.tossup += 10;
        resultDiv.innerHTML = '<div class="result-correct">Correct! +10 pts. Answer: ' + escapeHtml(round.tossup.answer) + '</div>';
        tournamentResults.push({ round: tournamentCurrentRound, tossupCorrect: true, bonusCorrect: [false, false, false] });
        updateTournamentScoreboard();
        setTimeout(() => {
            tournamentPhase = 'bonus';
            showTournamentBonus();
        }, 1200);
    } else {
        resultDiv.innerHTML = '<div class="result-incorrect">Answer: ' + escapeHtml(round.tossup.answer) + '</div>' +
            '<div style="margin-top:8px;"><button class="btn-generate" style="padding:8px 20px;" onclick="selfReportTossup(true)">I was right</button> ' +
            '<button class="show-answer-btn" style="padding:8px 20px;" onclick="selfReportTossup(false)">I was wrong</button></div>';
    }
}

function selfReportTossup(wasCorrect) {
    const round = tournamentRounds[tournamentCurrentRound];
    if (wasCorrect) {
        tournamentScores.tossup += 10;
        tournamentResults.push({ round: tournamentCurrentRound, tossupCorrect: true, bonusCorrect: [false, false, false] });
        updateTournamentScoreboard();
        setTimeout(() => {
            tournamentPhase = 'bonus';
            showTournamentBonus();
        }, 500);
    } else {
        tournamentResults.push({ round: tournamentCurrentRound, tossupCorrect: false, bonusCorrect: [false, false, false] });
        updateTournamentScoreboard();
        setTimeout(() => {
            tournamentCurrentRound++;
            tournamentPhase = 'tossup';
            showTournamentQuestion();
        }, 500);
    }
}

function showTournamentBonus() {
    const area = document.getElementById('tournament-area');
    if (!area) return;

    const round = tournamentRounds[tournamentCurrentRound];
    const bonus = round.bonus;
    if (!bonus || bonus.length === 0) {
        tournamentCurrentRound++;
        tournamentPhase = 'tossup';
        showTournamentQuestion();
        return;
    }

    let html = '<div class="bonus-section"><h3>Bonus Round - 3 Parts (10 pts each)</h3>';
    bonus.forEach((b, i) => {
        html += '<div class="bonus-question" id="bonus-q-' + i + '">' +
            '<p><span class="bonus-part-label">Part ' + b.part + ':</span> ' + escapeHtml(b.question) + '</p>' +
            '<div class="bonus-answer-row">' +
            '<input type="text" id="bonus-input-' + i + '" placeholder="Your answer..."' + (i > 0 ? ' disabled' : '') + '>' +
            '<button id="bonus-btn-' + i + '" onclick="checkTournamentBonus(' + i + ')"' + (i > 0 ? ' disabled' : '') + '>Check</button>' +
            '</div>' +
            '<div id="bonus-result-' + i + '"></div>' +
            '</div>';
    });
    html += '<div id="bonus-next" style="display:none;margin-top:12px;text-align:center;">' +
        '<button class="btn-generate" onclick="nextTournamentRound()">Next Toss-Up</button></div>';
    html += '</div>';
    area.innerHTML = html;

    setTimeout(() => {
        const firstInput = document.getElementById('bonus-input-0');
        if (firstInput) {
            firstInput.focus();
            firstInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') checkTournamentBonus(0);
            });
        }
    }, 100);
}

function checkTournamentBonus(partIndex) {
    const input = document.getElementById('bonus-input-' + partIndex);
    const resultDiv = document.getElementById('bonus-result-' + partIndex);
    const btn = document.getElementById('bonus-btn-' + partIndex);
    if (!input || !resultDiv) return;

    const userAnswer = input.value.trim();
    const round = tournamentRounds[tournamentCurrentRound];
    const bonusPart = round.bonus[partIndex];
    const correct = userAnswer ? fuzzyMatch(userAnswer, bonusPart.answer) : false;

    input.disabled = true;
    if (btn) btn.disabled = true;

    if (correct) {
        tournamentScores.bonus += 10;
        tournamentResults[tournamentResults.length - 1].bonusCorrect[partIndex] = true;
        resultDiv.innerHTML = '<div class="bonus-result correct">Correct! +10 pts. ' + escapeHtml(bonusPart.answer) + '</div>';
    } else {
        resultDiv.innerHTML = '<div class="bonus-result incorrect">Incorrect. Answer: ' + escapeHtml(bonusPart.answer) + '</div>';
    }
    updateTournamentScoreboard();

    const nextPart = partIndex + 1;
    if (nextPart < round.bonus.length) {
        const nextInput = document.getElementById('bonus-input-' + nextPart);
        const nextBtn = document.getElementById('bonus-btn-' + nextPart);
        if (nextInput) {
            nextInput.disabled = false;
            nextInput.focus();
            nextInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') checkTournamentBonus(nextPart);
            });
        }
        if (nextBtn) nextBtn.disabled = false;
    } else {
        document.getElementById('bonus-next').style.display = 'block';
    }
}

function nextTournamentRound() {
    tournamentCurrentRound++;
    tournamentPhase = 'tossup';
    showTournamentQuestion();
}

function updateTournamentScoreboard() {
    const tEl = document.getElementById('t-tossup-score');
    const bEl = document.getElementById('t-bonus-score');
    const totalEl = document.getElementById('t-total-score');
    if (tEl) tEl.textContent = tournamentScores.tossup;
    if (bEl) bEl.textContent = tournamentScores.bonus;
    if (totalEl) totalEl.textContent = tournamentScores.tossup + tournamentScores.bonus;
}

function showTournamentFinal() {
    const area = document.getElementById('tournament-area');
    if (!area) return;

    const total = tournamentScores.tossup + tournamentScores.bonus;
    const maxPossible = tournamentRounds.length * 40;
    const pct = maxPossible > 0 ? Math.round((total / maxPossible) * 100) : 0;

    let roundsHtml = '';
    tournamentResults.forEach((r, i) => {
        const tIcon = r.tossupCorrect ? 'Correct' : 'Missed';
        const bCount = r.bonusCorrect.filter(Boolean).length;
        roundsHtml += '<tr><td>' + (i + 1) + '</td><td>' + tIcon + '</td><td>' + bCount + '/3</td></tr>';
    });

    area.innerHTML =
        '<div class="tournament-final">' +
        '<h2>Tournament Complete!</h2>' +
        '<div class="final-score">' + total + ' / ' + maxPossible + ' pts</div>' +
        '<p>' + pct + '% accuracy</p>' +
        '<div style="margin-top:16px;text-align:left;">' +
        '<table style="width:100%;border-collapse:collapse;">' +
        '<tr style="background:#1e3a8a;color:white;"><th style="padding:8px;">Round</th><th style="padding:8px;">Toss-Up</th><th style="padding:8px;">Bonus</th></tr>' +
        roundsHtml +
        '</table></div>' +
        '<div style="margin-top:20px;"><a href="/home" class="btn-generate" style="text-decoration:none;padding:10px 24px;">Back to Home</a></div>' +
        '</div>';
}

function fuzzyMatch(userAnswer, correctAnswer) {
    if (!userAnswer || !correctAnswer) return false;
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\b(the|a|an)\b/g, '').replace(/\s+/g, ' ').trim();
    const u = normalize(userAnswer);
    const c = normalize(correctAnswer);
    if (u === c) return true;
    if (c.includes(u) && u.length > 3) return true;
    if (u.includes(c) && c.length > 3) return true;
    const cParts = correctAnswer.split(/[\/;]/);
    for (const part of cParts) {
        if (normalize(part) === u) return true;
    }
    const cWords = c.split(' ');
    const uWords = u.split(' ');
    if (cWords.length > 1 && uWords.includes(cWords[cWords.length - 1]) && u.length > 3) return true;
    const dist = levenshteinDistance(u, c);
    const maxLen = Math.max(u.length, c.length);
    if (maxLen > 0 && (1 - dist / maxLen) >= 0.65) return true;
    return false;
}

function levenshteinDistance(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
        }
    }
    return dp[m][n];
}

document.addEventListener('DOMContentLoaded', async () => {
    checkSession();
    fetch('/api/track-pageview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({page: window.location.pathname}) }).catch(() => {});
});
