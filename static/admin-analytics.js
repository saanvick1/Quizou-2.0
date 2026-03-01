async function checkAuth() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        if (!data.logged_in) { window.location.href = '/'; return null; }
        document.getElementById('username-display').textContent = data.username;
        return data;
    } catch (e) { window.location.href = '/'; return null; }
}

function logout() { fetch('/api/logout', { method: 'POST' }).then(() => window.location.href = '/'); }

function drawBarChart(canvasId, labels, values, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement.clientWidth - 36;
    const h = 200;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!values.length) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data yet', w / 2, h / 2);
        return;
    }

    const maxVal = Math.max(...values, 1);
    const padL = 40, padB = 30, padT = 10, padR = 10;
    const chartW = w - padL - padR;
    const chartH = h - padB - padT;
    const barW = Math.max(4, Math.min(20, (chartW / values.length) - 3));

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padT + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(maxVal - (maxVal / 4) * i), padL - 5, y + 4);
    }

    values.forEach((v, i) => {
        const x = padL + (chartW / values.length) * i + (chartW / values.length - barW) / 2;
        const barH = (v / maxVal) * chartH;
        const y = padT + chartH - barH;

        const grad = ctx.createLinearGradient(x, y, x, padT + chartH);
        grad.addColorStop(0, color);
        grad.addColorStop(1, color + '66');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 2);
        ctx.fill();
    });

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(labels.length / 8));
    labels.forEach((label, i) => {
        if (i % step === 0) {
            const x = padL + (chartW / values.length) * i + (chartW / values.length) / 2;
            const short = label.length > 5 ? label.slice(5) : label;
            ctx.fillText(short, x, h - 5);
        }
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function loadAnalytics() {
    try {
        const response = await fetch('/api/admin/analytics');
        if (response.status === 403) {
            document.getElementById('admin-content').style.display = 'none';
            document.getElementById('access-denied').style.display = 'block';
            return;
        }
        const data = await response.json();
        if (!data.success) return;

        document.getElementById('loading').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';

        const ov = data.overview;
        document.getElementById('overview-grid').innerHTML = `
            <div class="overview-card highlight"><div class="ov-value">${ov.total_users}</div><div class="ov-label">Total Users</div></div>
            <div class="overview-card"><div class="ov-value">${ov.active_last_hour}</div><div class="ov-label">Active (1hr)</div></div>
            <div class="overview-card"><div class="ov-value">${ov.total_page_views}</div><div class="ov-label">Page Views</div></div>
            <div class="overview-card"><div class="ov-value">${ov.views_today}</div><div class="ov-label">Views Today</div></div>
            <div class="overview-card"><div class="ov-value">${ov.views_this_week}</div><div class="ov-label">Views (7d)</div></div>
            <div class="overview-card"><div class="ov-value">${ov.total_questions_generated}</div><div class="ov-label">Questions</div></div>
            <div class="overview-card"><div class="ov-value">${ov.total_answers}</div><div class="ov-label">Answers</div></div>
            <div class="overview-card"><div class="ov-value">${ov.overall_accuracy}%</div><div class="ov-label">Accuracy</div></div>
            <div class="overview-card"><div class="ov-value">${ov.new_users_week}</div><div class="ov-label">New (7d)</div></div>
            <div class="overview-card"><div class="ov-value">${ov.new_users_month}</div><div class="ov-label">New (30d)</div></div>
        `;

        drawBarChart('views-chart',
            data.daily_views.map(d => d.date),
            data.daily_views.map(d => d.views),
            '#3b4c9b'
        );

        const topPagesDiv = document.getElementById('top-pages-list');
        if (data.top_pages.length === 0) {
            topPagesDiv.innerHTML = '<div class="no-data">No page views recorded yet</div>';
        } else {
            topPagesDiv.innerHTML = data.top_pages.map(p =>
                `<div class="page-row"><span class="page-name">${p.page}</span><span class="page-views">${p.views}</span></div>`
            ).join('');
        }

        const topicDiv = document.getElementById('topic-stats');
        if (data.topic_stats.length === 0) {
            topicDiv.innerHTML = '<div class="no-data">No topic data yet</div>';
        } else {
            topicDiv.innerHTML = data.topic_stats.map(t => {
                const cls = t.accuracy >= 70 ? 'good' : t.accuracy >= 40 ? 'mid' : 'low';
                return `<div class="topic-row">
                    <span class="topic-name">${t.topic}</span>
                    <span class="topic-count">${t.total} questions</span>
                    <span class="topic-accuracy ${cls}">${t.accuracy}%</span>
                </div>`;
            }).join('');
        }

        drawBarChart('signups-chart',
            data.signups_over_time.map(d => d.date),
            data.signups_over_time.map(d => d.count),
            '#10b981'
        );

        const tbody = document.getElementById('users-tbody');
        tbody.innerHTML = data.users.map((u, i) => {
            const accCls = u.accuracy >= 70 ? 'good' : u.accuracy >= 40 ? 'mid' : 'low';
            return `<tr>
                <td>${i + 1}</td>
                <td>${u.username}</td>
                <td>${u.full_name || '-'}</td>
                <td>${u.email || '-'}</td>
                <td><span class="role-badge ${u.role}">${u.role}</span></td>
                <td>${u.school || '-'}</td>
                <td>${u.questions_answered}</td>
                <td><span class="accuracy-badge ${accCls}">${u.accuracy}%</span></td>
                <td>${formatDate(u.joined)}</td>
            </tr>`;
        }).join('');

    } catch (error) {
        document.getElementById('loading').innerHTML = '<div class="no-data">Failed to load analytics</div>';
    }
}

window.onload = async function() {
    const user = await checkAuth();
    if (user) {
        document.getElementById('admin-content').style.display = 'block';
        await loadAnalytics();
    }
};
