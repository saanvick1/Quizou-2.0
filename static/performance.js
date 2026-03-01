let perfData = null;

async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        if (!data.logged_in) {
            window.location.href = '/home';
            return false;
        }
        const el = document.getElementById('username-display');
        if (el) el.textContent = data.username;
        return true;
    } catch (error) {
        window.location.href = '/home';
        return false;
    }
}

function logout() {
    fetch('/api/logout', { method: 'POST' }).then(function() {
        localStorage.removeItem('username');
        window.location.href = '/home';
    });
}

function toggleMenu() {
    const nav = document.getElementById('nav-menu');
    nav.classList.toggle('show');
}

async function loadPerformance() {
    const ok = await checkSession();
    if (!ok) return;
    try {
        const res = await fetch('/api/performance-breakdown');
        const data = await res.json();
        if (data.success) {
            perfData = data;
            renderOverall(data);
            renderDifficulties(data);
            renderTopics(data);
            renderRecentActivity(data);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('performance-content').style.display = 'block';
        } else {
            document.getElementById('loading').textContent = 'Failed to load performance data.';
        }
    } catch (e) {
        document.getElementById('loading').textContent = 'Error loading performance data.';
    }
}

function renderOverall(data) {
    const o = data.overall || {};
    const container = document.getElementById('overall-stats');
    container.innerHTML = `
        <div class="perf-overall-grid">
            <div class="perf-overall-card">
                <div class="perf-overall-value">${o.total || 0}</div>
                <div class="perf-overall-label">Total Questions</div>
            </div>
            <div class="perf-overall-card">
                <div class="perf-overall-value">${o.correct || 0}</div>
                <div class="perf-overall-label">Correct</div>
            </div>
            <div class="perf-overall-card">
                <div class="perf-overall-value">${(o.accuracy || 0).toFixed(1)}%</div>
                <div class="perf-overall-label">Accuracy</div>
            </div>
            <div class="perf-overall-card">
                <div class="perf-overall-value">${o.topics_practiced || 0}</div>
                <div class="perf-overall-label">Topics Practiced</div>
            </div>
        </div>
    `;
}

function renderDifficulties(data) {
    const d = data.difficulties || {};
    const container = document.getElementById('difficulty-breakdown');
    const levels = [
        { key: 'Easy', color: '#48bb78', bg: 'rgba(72,187,120,0.15)' },
        { key: 'Medium', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
        { key: 'Hard', color: '#f5576c', bg: 'rgba(245,87,108,0.15)' }
    ];
    let html = '<div class="perf-diff-grid">';
    levels.forEach(l => {
        const info = d[l.key] || { total: 0, correct: 0, accuracy: 0 };
        html += `
            <div class="perf-diff-card" style="border-top: 4px solid ${l.color};">
                <h4>${l.key}</h4>
                <div class="perf-diff-accuracy">${(info.accuracy || 0).toFixed(1)}%</div>
                <div class="perf-diff-detail">${info.correct || 0} / ${info.total || 0} correct</div>
                <div class="perf-progress-bar">
                    <div class="perf-progress-fill" style="width:${info.accuracy || 0}%;background:${l.color};"></div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderTopics(data, sortField) {
    const topics = data.topics || [];
    const field = sortField || 'accuracy';
    const sorted = [...topics].sort((a, b) => (b[field] || 0) - (a[field] || 0));
    const container = document.getElementById('topic-breakdown');

    if (sorted.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No topic data yet. Start practicing!</p></div>';
        return;
    }

    let html = '';
    sorted.forEach(t => {
        const avgTime = t.avg_time != null ? t.avg_time.toFixed(1) + 's' : 'N/A';
        html += `
            <div class="perf-topic-row">
                <div class="perf-topic-name">${escapeHtml(t.topic)}</div>
                <div class="perf-topic-stats">
                    <span class="perf-topic-count">${t.total} questions</span>
                    <span class="perf-topic-acc">${(t.accuracy || 0).toFixed(1)}%</span>
                    <span class="perf-topic-time">${avgTime}</span>
                </div>
                <div class="perf-progress-bar">
                    <div class="perf-progress-fill" style="width:${t.accuracy || 0}%;background:linear-gradient(90deg,#1e3a8a,#f97316);"></div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderRecentActivity(data) {
    const activity = data.recent_activity || [];
    const container = document.getElementById('recent-activity');

    if (activity.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No recent activity yet.</p></div>';
        return;
    }

    let html = '<div class="perf-timeline">';
    activity.forEach(a => {
        const topicsList = (a.topics || []).join(', ') || 'Various';
        html += `
            <div class="perf-timeline-item">
                <div class="perf-timeline-date">${escapeHtml(a.date)}</div>
                <div class="perf-timeline-details">
                    <div class="perf-timeline-topics">${escapeHtml(topicsList)}</div>
                    <div class="perf-timeline-score">${a.correct || 0} / ${a.total || 0} correct</div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sortTopics(field) {
    if (perfData) {
        renderTopics(perfData, field);
    }
}

document.addEventListener('DOMContentLoaded', loadPerformance);
