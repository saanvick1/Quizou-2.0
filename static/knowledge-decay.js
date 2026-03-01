async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        if (!response.ok) return;
        const data = await response.json();
        if (data.logged_in) {
            const headerActions = document.getElementById('header-actions');
            const headerWelcome = document.getElementById('header-welcome');
            const headerUsername = document.getElementById('header-username');
            if (headerActions) headerActions.style.display = 'flex';
            if (headerWelcome && headerUsername) {
                headerUsername.textContent = data.username;
                headerWelcome.style.display = 'inline';
            }
            loadDecayData();
        } else {
            window.location.href = '/home';
        }
    } catch (error) {
        console.error('Session check error:', error);
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

function getHealthColor(health) {
    if (health > 70) return '#48bb78';
    if (health >= 40) return '#ecc94b';
    return '#f56565';
}

function getHealthLabel(health) {
    if (health > 70) return 'Fresh';
    if (health >= 40) return 'Fading';
    return 'Forgotten';
}

function buildTopicCard(topic, showReviewBtn) {
    const color = getHealthColor(topic.health);
    const label = getHealthLabel(topic.health);
    const isCritical = topic.urgency === 'critical';

    let daysText = '';
    if (topic.days_since_practice < 1) {
        daysText = 'Today';
    } else if (topic.days_since_practice < 2) {
        daysText = '1 day ago';
    } else {
        daysText = Math.floor(topic.days_since_practice) + ' days ago';
    }

    const card = document.createElement('div');
    card.className = 'decay-topic-card' + (isCritical ? ' decay-critical' : '');

    card.innerHTML =
        '<div class="decay-card-header">' +
            '<h4 class="decay-topic-name">' + topic.topic + '</h4>' +
            '<span class="decay-health-label" style="color:' + color + '">' + label + '</span>' +
        '</div>' +
        '<div class="decay-health-bar-container">' +
            '<div class="decay-health-bar" style="width:' + topic.health + '%;background:' + color + '"></div>' +
        '</div>' +
        '<div class="decay-health-value" style="color:' + color + '">' + topic.health + '%</div>' +
        '<div class="decay-card-stats">' +
            '<span>Accuracy: ' + topic.accuracy + '%</span>' +
            '<span>Questions: ' + topic.total_questions + '</span>' +
            '<span>Last practiced: ' + daysText + '</span>' +
        '</div>' +
        (showReviewBtn ? '<button class="decay-review-btn" onclick="reviewTopic(\'' + topic.topic.replace(/'/g, "\\'") + '\')">Review Now</button>' : '');

    return card;
}

function reviewTopic(topic) {
    window.location.href = '/home';
    setTimeout(function() {
        const topicInput = document.getElementById('topic');
        if (topicInput) {
            topicInput.value = topic;
            topicInput.focus();
        }
    }, 500);
}

async function loadDecayData() {
    const loading = document.getElementById('decay-loading');
    const empty = document.getElementById('decay-empty');
    const grid = document.getElementById('decay-grid');
    const reviewSection = document.getElementById('review-plan-section');
    const reviewList = document.getElementById('review-plan-list');

    try {
        const response = await fetch('/api/knowledge-decay');
        if (!response.ok) {
            loading.textContent = 'Error loading data. Please try again.';
            return;
        }
        const data = await response.json();
        loading.style.display = 'none';

        if (!data.topics || data.topics.length === 0) {
            empty.style.display = 'block';
            return;
        }

        if (data.review_plan && data.review_plan.length > 0) {
            reviewSection.style.display = 'block';
            reviewList.innerHTML = '';
            data.review_plan.forEach(function(topic) {
                reviewList.appendChild(buildTopicCard(topic, true));
            });
        }

        grid.innerHTML = '';
        data.topics.forEach(function(topic) {
            grid.appendChild(buildTopicCard(topic, true));
        });

    } catch (error) {
        loading.textContent = 'Error loading knowledge decay data.';
        console.error('Error:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    checkSession();
});
