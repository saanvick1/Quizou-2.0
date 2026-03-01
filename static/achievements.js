async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        
        if (data.logged_in) {
            document.getElementById('username-display').textContent = data.username;
            loadGamificationStats();
            loadBadges();
            loadAnalytics();
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

async function loadGamificationStats() {
    const container = document.getElementById('gamification-stats');
    container.innerHTML = '<div class="loading">Loading stats...</div>';
    
    try {
        const response = await fetch('/api/gamification-stats');
        const data = await response.json();
        
        if (response.ok && data.stats) {
            displayGamificationStats(data.stats);
        } else {
            container.innerHTML = '<p>No stats available yet</p>';
        }
    } catch (error) {
        container.innerHTML = '<p>Error loading stats</p>';
        console.error('Error:', error);
    }
}

function displayGamificationStats(stats) {
    const container = document.getElementById('gamification-stats');
    
    container.innerHTML = `
        <div class="stat-item">
            <div class="stat-value" style="color: #f97316;">${stats.points || 0}</div>
            <div class="stat-label">Scholar League Points</div>
        </div>
        <div class="stat-item">
            <div class="stat-value" style="color: #1e3a8a;">${stats.level || 1}</div>
            <div class="stat-label">Current Level</div>
        </div>
        <div class="stat-item">
            <div class="stat-value" style="color: #10b981;">${stats.current_streak || 0} 🔥</div>
            <div class="stat-label">Current Streak</div>
        </div>
        <div class="stat-item">
            <div class="stat-value" style="color: #8b5cf6;">${stats.longest_streak || 0} ⭐</div>
            <div class="stat-label">Longest Streak</div>
        </div>
    `;
}

async function loadBadges() {
    const container = document.getElementById('badges-container');
    container.innerHTML = '<div class="loading">Loading badges...</div>';
    
    try {
        const response = await fetch('/api/badges');
        const data = await response.json();
        
        if (response.ok && data.badges) {
            displayBadges(data.badges);
        } else {
            container.innerHTML = '<p>No badges earned yet. Keep practicing!</p>';
        }
    } catch (error) {
        container.innerHTML = '<p>Error loading badges</p>';
        console.error('Error:', error);
    }
}

function displayBadges(badges) {
    const container = document.getElementById('badges-container');
    
    if (badges.length === 0) {
        container.innerHTML = '<p>No badges earned yet. Keep practicing to unlock achievements!</p>';
        return;
    }
    
    let html = '';
    badges.forEach(badge => {
        html += `<div class="badge-card">
            <div class="badge-icon">${badge.icon}</div>
            <div class="badge-name">${escapeHtml(badge.name)}</div>
            <div class="badge-description">${escapeHtml(badge.description)}</div>
            <div class="badge-date">Earned: ${new Date(badge.earned_at).toLocaleDateString()}</div>
        </div>`;
    });
    
    container.innerHTML = html;
}

async function loadAnalytics() {
    const container = document.getElementById('analytics-container');
    container.innerHTML = '<div class="loading">Loading analytics...</div>';
    
    try {
        const response = await fetch('/api/user-stats');
        const data = await response.json();
        
        if (response.ok && data.analytics) {
            displayAnalytics(data.analytics);
        } else {
            container.innerHTML = '<p>No analytics data available yet</p>';
        }
    } catch (error) {
        container.innerHTML = '<p>Error loading analytics</p>';
        console.error('Error:', error);
    }
}

function displayAnalytics(analytics) {
    const container = document.getElementById('analytics-container');
    
    if (analytics.length === 0) {
        container.innerHTML = '<p>No analytics data available yet. Start practicing to see your cognitive insights!</p>';
        return;
    }
    
    let html = '';
    analytics.forEach(item => {
        const accuracy = ((item.correct / item.total) * 100).toFixed(1);
        const totalGaps = item.recall_gaps + item.inference_gaps + item.comprehension_gaps;
        
        html += `<div class="analytics-card">
            <h3>${escapeHtml(item.topic)} - ${item.difficulty}</h3>
            <div class="analytics-stats">
                <div class="analytics-stat">
                    <strong>Accuracy:</strong> ${accuracy}% (${item.correct}/${item.total})
                </div>
                <div class="analytics-stat">
                    <strong>Avg Speed:</strong> ${item.avg_speed.toFixed(1)}s
                </div>
            </div>
            <div class="cognitive-breakdown">
                <h4>Cognitive Gaps Analysis:</h4>
                <div class="gap-item">
                    <span>Recall Gaps:</span> 
                    <span class="gap-count">${item.recall_gaps}</span>
                    <div class="gap-bar">
                        <div class="gap-fill" style="width: ${totalGaps > 0 ? (item.recall_gaps / totalGaps * 100) : 0}%"></div>
                    </div>
                </div>
                <div class="gap-item">
                    <span>Inference Gaps:</span> 
                    <span class="gap-count">${item.inference_gaps}</span>
                    <div class="gap-bar">
                        <div class="gap-fill" style="width: ${totalGaps > 0 ? (item.inference_gaps / totalGaps * 100) : 0}%"></div>
                    </div>
                </div>
                <div class="gap-item">
                    <span>Comprehension Gaps:</span> 
                    <span class="gap-count">${item.comprehension_gaps}</span>
                    <div class="gap-bar">
                        <div class="gap-fill" style="width: ${totalGaps > 0 ? (item.comprehension_gaps / totalGaps * 100) : 0}%"></div>
                    </div>
                </div>
            </div>
        </div>`;
    });
    
    container.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleMenu() {
    const menu = document.getElementById('nav-menu');
    menu.classList.toggle('show');
}

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    fetch('/api/track-pageview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({page: window.location.pathname}) }).catch(() => {});
});
