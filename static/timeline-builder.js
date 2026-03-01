let correctOrder = [];
let shuffledEvents = [];
let currentTopic = '';
let draggedItem = null;

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
            const navMyClasses = document.getElementById('nav-my-classes');
            if (navMyClasses) {
                navMyClasses.style.display = data.role === 'teacher' ? 'inline-flex' : 'none';
            }
        } else {
            window.location.href = '/home';
        }
    } catch (e) {
        window.location.href = '/home';
    }
}

async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/home';
    } catch (e) {}
}

function toggleMenu() {
    const menu = document.getElementById('nav-menu');
    menu.classList.toggle('show');
}

async function generateTimeline() {
    const topic = document.getElementById('timeline-topic').value.trim();
    const errorDiv = document.getElementById('generate-error');
    const btn = document.getElementById('generate-btn');

    errorDiv.textContent = '';

    if (!topic) {
        errorDiv.textContent = 'Please enter a topic.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Generating timeline...';

    try {
        const response = await fetch('/api/timeline/generate?topic=' + encodeURIComponent(topic));
        const data = await response.json();

        if (response.ok && data.events) {
            correctOrder = data.events;
            currentTopic = data.topic || topic;
            shuffledEvents = shuffle([...correctOrder]);
            renderDragList();
            document.getElementById('setup-section').style.display = 'none';
            document.getElementById('timeline-section').style.display = 'block';
            document.getElementById('results-section').style.display = 'none';
            document.getElementById('timeline-topic-title').textContent = currentTopic;
        } else {
            errorDiv.textContent = data.error || 'Error generating timeline.';
        }
    } catch (e) {
        errorDiv.textContent = 'Error generating timeline. Please try again.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Timeline';
    }
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (arr.length > 1 && JSON.stringify(arr) === JSON.stringify(correctOrder)) {
        return shuffle(arr);
    }
    return arr;
}

function renderDragList() {
    const zone = document.getElementById('timeline-dropzone');
    zone.innerHTML = '';

    shuffledEvents.forEach((event, index) => {
        const card = document.createElement('div');
        card.className = 'timeline-drag-card';
        card.draggable = true;
        card.dataset.index = index;
        card.innerHTML = '<span class="timeline-drag-handle">&#9776;</span><span class="timeline-event-name">' + escapeHtml(event.event) + '</span>';

        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('dragenter', handleDragEnter);
        card.addEventListener('dragleave', handleDragLeave);
        card.addEventListener('drop', handleDrop);

        card.addEventListener('touchstart', handleTouchStart, { passive: false });
        card.addEventListener('touchmove', handleTouchMove, { passive: false });
        card.addEventListener('touchend', handleTouchEnd);

        zone.appendChild(card);
    });
}

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.index);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.timeline-drag-card').forEach(c => c.classList.remove('drag-over'));
    draggedItem = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    if (this !== draggedItem) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    if (draggedItem && draggedItem !== this) {
        const fromIdx = parseInt(draggedItem.dataset.index);
        const toIdx = parseInt(this.dataset.index);
        const moved = shuffledEvents.splice(fromIdx, 1)[0];
        shuffledEvents.splice(toIdx, 0, moved);
        renderDragList();
    }
}

let touchStartY = 0;
let touchClone = null;
let touchDragIndex = -1;

function handleTouchStart(e) {
    const touch = e.touches[0];
    touchStartY = touch.clientY;
    touchDragIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');

    touchClone = this.cloneNode(true);
    touchClone.classList.add('touch-clone');
    touchClone.style.position = 'fixed';
    touchClone.style.left = this.getBoundingClientRect().left + 'px';
    touchClone.style.top = touch.clientY - 20 + 'px';
    touchClone.style.width = this.offsetWidth + 'px';
    touchClone.style.zIndex = '9999';
    touchClone.style.pointerEvents = 'none';
    document.body.appendChild(touchClone);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    if (touchClone) {
        touchClone.style.top = touch.clientY - 20 + 'px';
    }

    const cards = document.querySelectorAll('.timeline-drag-card');
    cards.forEach(c => c.classList.remove('drag-over'));
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
        const card = el.closest('.timeline-drag-card');
        if (card && parseInt(card.dataset.index) !== touchDragIndex) {
            card.classList.add('drag-over');
        }
    }
}

function handleTouchEnd(e) {
    if (touchClone) {
        document.body.removeChild(touchClone);
        touchClone = null;
    }

    document.querySelectorAll('.timeline-drag-card').forEach(c => {
        c.classList.remove('dragging');
        c.classList.remove('drag-over');
    });

    const touch = e.changedTouches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
        const card = el.closest('.timeline-drag-card');
        if (card && touchDragIndex >= 0) {
            const toIdx = parseInt(card.dataset.index);
            if (toIdx !== touchDragIndex) {
                const moved = shuffledEvents.splice(touchDragIndex, 1)[0];
                shuffledEvents.splice(toIdx, 0, moved);
                renderDragList();
            }
        }
    }
    touchDragIndex = -1;
}

async function checkOrder() {
    const userOrder = shuffledEvents.map(e => ({ event: e.event, date: e.date, context: e.context }));
    const correctOrderData = correctOrder.map(e => ({ event: e.event, date: e.date, context: e.context }));

    const btn = document.getElementById('check-btn');
    btn.disabled = true;
    btn.textContent = 'Scoring...';

    try {
        const response = await fetch('/api/timeline/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic: currentTopic,
                user_order: userOrder,
                correct_order: correctOrderData
            })
        });
        const data = await response.json();

        if (response.ok) {
            showResults(data.correct_count, data.total, userOrder, correctOrderData);
        }
    } catch (e) {
        console.error('Error submitting:', e);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Check My Order';
    }
}

function showResults(correctCount, total, userOrder, correctOrderData) {
    document.getElementById('timeline-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';
    document.getElementById('score-value').textContent = correctCount;
    document.getElementById('score-total').textContent = total;

    const list = document.getElementById('results-list');
    list.innerHTML = '<div class="timeline-vertical-line">' +
        correctOrderData.map((event, i) => {
            const userEvent = userOrder[i];
            const isCorrect = userEvent && userEvent.event === event.event;
            return '<div class="timeline-result-item ' + (isCorrect ? 'tl-correct' : 'tl-incorrect') + '">' +
                '<div class="tl-marker">' + (isCorrect ? '&#10003;' : '&#10007;') + '</div>' +
                '<div class="tl-content">' +
                '<div class="tl-event-name">' + escapeHtml(event.event) + '</div>' +
                '<div class="tl-date">' + escapeHtml(event.date) + '</div>' +
                '<div class="tl-context">' + escapeHtml(event.context || '') + '</div>' +
                ((!isCorrect && userEvent) ? '<div class="tl-your-answer">You placed: ' + escapeHtml(userEvent.event) + '</div>' : '') +
                '</div></div>';
        }).join('') + '</div>';
}

function resetTimeline() {
    shuffledEvents = shuffle([...correctOrder]);
    renderDragList();
    document.getElementById('timeline-section').style.display = 'block';
    document.getElementById('results-section').style.display = 'none';
}

function resetAll() {
    correctOrder = [];
    shuffledEvents = [];
    currentTopic = '';
    document.getElementById('timeline-topic').value = '';
    document.getElementById('setup-section').style.display = 'block';
    document.getElementById('timeline-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});
