async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        
        if (data.logged_in) {
            document.getElementById('username-display').textContent = data.username;
            loadLeaderboard('global');
            loadUserStats();
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

async function loadLeaderboard(type) {
    const container = document.getElementById('leaderboard-container');
    container.innerHTML = '<div class="loading">Loading leaderboard...</div>';
    
    document.getElementById('global-btn').classList.remove('active');
    document.getElementById('school-btn').classList.remove('active');
    document.getElementById(type + '-btn').classList.add('active');
    
    try {
        const response = await fetch(`/api/leaderboard?type=${type}`);
        const data = await response.json();
        
        if (response.ok && data.leaderboard) {
            displayLeaderboard(data.leaderboard);
        } else {
            container.innerHTML = '<p>Error loading leaderboard</p>';
        }
    } catch (error) {
        container.innerHTML = '<p>Error loading leaderboard</p>';
        console.error('Error:', error);
    }
}

function displayLeaderboard(leaderboard) {
    const container = document.getElementById('leaderboard-container');
    
    if (leaderboard.length === 0) {
        container.innerHTML = '<p>No data available</p>';
        return;
    }
    
    let html = '<div class="leaderboard-table">';
    html += '<div class="leaderboard-header">';
    html += '<div class="rank-col">Rank</div>';
    html += '<div class="user-col">User</div>';
    html += '<div class="stat-col">Points</div>';
    html += '<div class="stat-col">Accuracy</div>';
    html += '<div class="stat-col">Questions</div>';
    html += '</div>';
    
    leaderboard.forEach((entry, index) => {
        const rankClass = index < 3 ? `rank-${index + 1}` : '';
        html += `<div class="leaderboard-row ${rankClass}">`;
        html += `<div class="rank-col">${entry.rank || index + 1}</div>`;
        html += `<div class="user-col">${escapeHtml(entry.username)}</div>`;
        html += `<div class="stat-col">${entry.points}</div>`;
        html += `<div class="stat-col">${entry.accuracy.toFixed(1)}%</div>`;
        html += `<div class="stat-col">${entry.total}</div>`;
        html += '</div>';
    });
    
    html += '</div>';
    container.innerHTML = html;
}

async function loadUserStats() {
    try {
        const response = await fetch('/api/user-stats');
        const data = await response.json();
        
        if (response.ok) {
            displayUserStats(data);
        }
    } catch (error) {
        console.error('Error loading user stats:', error);
    }
}

function displayUserStats(stats) {
    const container = document.getElementById('user-stats-container');
    
    let html = '<div class="stats-grid">';
    html += `<div class="stat-box">
        <div class="stat-value">${stats.points}</div>
        <div class="stat-label">Scholar Points</div>
    </div>`;
    html += `<div class="stat-box">
        <div class="stat-value">Level ${stats.level}</div>
        <div class="stat-label">Current Level</div>
    </div>`;
    html += `<div class="stat-box">
        <div class="stat-value">${stats.current_streak} 🔥</div>
        <div class="stat-label">Current Streak</div>
    </div>`;
    html += `<div class="stat-box">
        <div class="stat-value">${stats.longest_streak}</div>
        <div class="stat-label">Longest Streak</div>
    </div>`;
    html += '</div>';
    
    container.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    fetch('/api/track-pageview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({page: window.location.pathname}) }).catch(() => {});
});
