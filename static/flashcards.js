let currentCards = [];
let currentIndex = 0;
let results = { correct: 0, incorrect: 0 };
let cardResults = {};

async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        if (!response.ok) {
            window.location.href = '/home';
            return;
        }
        const data = await response.json();
        if (data.logged_in) {
            document.getElementById('username-display').textContent = data.username;
            loadFlashcardOptions();
        } else {
            window.location.href = '/home';
        }
    } catch (error) {
        console.error('Session check failed:', error);
        window.location.href = '/home';
    }
}

async function loadFlashcardOptions() {
    try {
        const response = await fetch('/api/flashcard-questions?filter=all');
        const data = await response.json();
        if (data.success && data.topics) {
            const topicSelect = document.getElementById('topic-select');
            data.topics.forEach(topic => {
                const option = document.createElement('option');
                option.value = topic;
                option.textContent = topic;
                topicSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading flashcard options:', error);
    }
}

async function startFlashcards() {
    const filter = document.getElementById('filter-select').value;
    const topic = document.getElementById('topic-select').value;
    const shuffle = document.getElementById('shuffle-toggle').checked;

    let url = `/api/flashcard-questions?filter=${filter}`;
    if (topic) {
        url += `&topic=${encodeURIComponent(topic)}`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.success || !data.questions || data.questions.length === 0) {
            alert('No flashcard questions available for your selection.');
            return;
        }

        currentCards = data.questions;

        if (shuffle) {
            for (let i = currentCards.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [currentCards[i], currentCards[j]] = [currentCards[j], currentCards[i]];
            }
        }

        currentIndex = 0;
        results = { correct: 0, incorrect: 0 };
        cardResults = {};

        document.getElementById('flashcard-setup').style.display = 'none';
        document.getElementById('flashcard-end').style.display = 'none';
        document.getElementById('flashcard-area').style.display = 'block';

        showCard();
    } catch (error) {
        console.error('Error starting flashcards:', error);
        alert('Failed to load flashcard questions. Please try again.');
    }
}

function showCard() {
    if (currentIndex < 0 || currentIndex >= currentCards.length) return;

    const card = currentCards[currentIndex];
    document.getElementById('card-front-text').textContent = card.question;
    document.getElementById('card-back-text').textContent = card.answer;
    document.getElementById('card-counter').textContent = `Card ${currentIndex + 1} of ${currentCards.length}`;

    const flashcard = document.getElementById('flashcard');
    flashcard.classList.remove('flipped');
}

function flipCard() {
    const flashcard = document.getElementById('flashcard');
    flashcard.classList.toggle('flipped');
}

function markCard(correct) {
    cardResults[currentIndex] = correct;

    results = { correct: 0, incorrect: 0 };
    for (const key in cardResults) {
        if (cardResults[key]) {
            results.correct++;
        } else {
            results.incorrect++;
        }
    }

    if (currentIndex < currentCards.length - 1) {
        currentIndex++;
        showCard();
    } else {
        showEndScreen();
    }
}

function prevCard() {
    if (currentIndex > 0) {
        currentIndex--;
        showCard();
    }
}

function nextCard() {
    if (currentIndex < currentCards.length - 1) {
        currentIndex++;
        showCard();
    }
}

function showEndScreen() {
    document.getElementById('flashcard-area').style.display = 'none';
    document.getElementById('flashcard-end').style.display = 'block';

    const total = results.correct + results.incorrect;
    const accuracy = total > 0 ? Math.round((results.correct / total) * 100) : 0;

    document.getElementById('end-score').textContent = `You got ${results.correct}/${total} correct`;
    document.getElementById('end-accuracy').textContent = `${accuracy}% Accuracy`;
}

function resetFlashcards() {
    document.getElementById('flashcard-end').style.display = 'none';
    document.getElementById('flashcard-setup').style.display = 'block';
    document.getElementById('flashcard-area').style.display = 'none';

    currentCards = [];
    currentIndex = 0;
    results = { correct: 0, incorrect: 0 };
    cardResults = {};
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

document.addEventListener('keydown', function(e) {
    var flashcard = document.getElementById('flashcard');
    if (!flashcard || flashcard.offsetParent === null) return;
    if (e.key === ' ' || e.key === 'Enter') {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'BUTTON' || document.activeElement.tagName === 'SELECT')) return;
        e.preventDefault();
        flipCard();
    } else if (e.key === 'ArrowRight') {
        nextCard();
    } else if (e.key === 'ArrowLeft') {
        prevCard();
    }
});

checkSession();
