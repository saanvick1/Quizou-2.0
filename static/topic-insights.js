let canvas, ctx;
let nodes = [], edges = [];
let offsetX = 0, offsetY = 0, scale = 1;
let isDragging = false, dragNode = null;
let lastMouseX = 0, lastMouseY = 0;
let isPanning = false;
let hoveredNode = null;
let selectedNode = null;
let time = 0;
let particles = [];
let mapInitialized = false;
let animFrameId = null;
let refreshInterval = null;
let currentTab = 'recommendations';

const STATUS_STYLES = {
    mastered: { fill: '#10b981', border: '#059669', glow: 'rgba(16, 185, 129, 0.5)', gradient: ['#10b981', '#34d399'], label: 'Mastered', pulse: true },
    learning: { fill: '#f59e0b', border: '#d97706', glow: 'rgba(245, 158, 11, 0.5)', gradient: ['#f59e0b', '#fbbf24'], label: 'Learning', pulse: true },
    beginner: { fill: '#6366f1', border: '#4f46e5', glow: 'rgba(99, 102, 241, 0.5)', gradient: ['#6366f1', '#818cf8'], label: 'Beginner', pulse: false },
    not_started: { fill: '#94a3b8', border: '#64748b', glow: 'rgba(148, 163, 184, 0.3)', gradient: ['#94a3b8', '#cbd5e1'], label: 'Not Started', pulse: false }
};

async function checkAuth() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        if (!data.logged_in) { window.location.href = '/'; return false; }
        document.getElementById('username-display').textContent = data.username;
        return true;
    } catch (e) { window.location.href = '/'; return false; }
}

function logout() { fetch('/api/logout', { method: 'POST' }).then(() => window.location.href = '/'); }
function toggleMenu() { document.getElementById('nav-menu').classList.toggle('active'); }

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.insights-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.insights-panel').forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });
    document.getElementById('tab-' + tab).classList.add('active');
    const panel = document.getElementById('panel-' + tab);
    panel.style.display = 'block';
    panel.classList.add('active');
    if (tab === 'map' && !mapInitialized) {
        loadConceptMap();
    }
}

async function loadAllData() {
    try {
        const [insightsRes, analysisRes] = await Promise.all([
            fetch('/api/topic-insights'),
            fetch('/api/topic-analysis')
        ]);
        const [insightsData, analysisData] = await Promise.all([
            insightsRes.json(),
            analysisRes.json()
        ]);
        if (analysisData.success) {
            displayOverallStats(analysisData.overall);
            displayStudyTip(analysisData.study_tip);
            displayRecommendations(analysisData.recommendations || []);
        }
        if (insightsData.success) {
            displayInsights(insightsData.insights || []);
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function displayOverallStats(overall) {
    if (!overall || overall.total === 0) {
        document.getElementById('overall-stats').innerHTML = '';
        return;
    }
    const accClass = overall.accuracy >= 70 ? 'accuracy-high' : overall.accuracy >= 40 ? 'accuracy-mid' : 'accuracy-low';
    document.getElementById('overall-stats').innerHTML = `
        <div class="overall-stat-card">
            <div class="overall-stat-value">${overall.total}</div>
            <div class="overall-stat-label">Questions Attempted</div>
        </div>
        <div class="overall-stat-card">
            <div class="overall-stat-value">${overall.correct}</div>
            <div class="overall-stat-label">Correct Answers</div>
        </div>
        <div class="overall-stat-card">
            <div class="overall-stat-value ${accClass}">${overall.accuracy}%</div>
            <div class="overall-stat-label">Overall Accuracy</div>
        </div>
        <div class="overall-stat-card">
            <div class="overall-stat-value">${overall.total - overall.correct}</div>
            <div class="overall-stat-label">To Review</div>
        </div>
    `;
}

function displayStudyTip(tip) {
    const banner = document.getElementById('study-tip-banner');
    if (!tip) { banner.style.display = 'none'; return; }
    banner.style.display = 'flex';
    banner.innerHTML = `<span class="tip-icon">TIP</span><span>${tip}</span>`;
}

function displayRecommendations(recs) {
    const container = document.getElementById('recommendations-container');
    if (recs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Data Yet</h3>
                <p>Practice some questions to see smart analysis of your performance across topics, difficulty levels, and learning patterns.</p>
                <a href="/home" class="rec-practice-btn">Start Practicing</a>
            </div>
        `;
        return;
    }
    const highCount = recs.filter(r => r.priority === 'high').length;
    const masteredCount = recs.filter(r => r.priority === 'mastered').length;
    container.innerHTML = `
        <div class="section-header">
            <h3>Topic Performance Analysis</h3>
            <span class="count-badge">${recs.length} topics tracked</span>
        </div>
        ${recs.map(rec => {
            const diffChips = Object.entries(rec.difficulties || {}).map(([d, s]) =>
                `<span class="rec-diff-chip">${d}<span class="diff-acc">${s.accuracy}%</span></span>`
            ).join('');
            return `
                <div class="rec-card priority-${rec.priority}">
                    <div class="rec-header">
                        <span class="rec-topic">${rec.topic}</span>
                        <span class="rec-badge ${rec.priority}">${rec.priority === 'high' ? 'Needs Focus' : rec.priority === 'medium' ? 'Improving' : rec.priority === 'low' ? 'Good' : 'Mastered'}</span>
                    </div>
                    <div class="rec-stats">
                        <span class="rec-stat"><strong>${rec.accuracy}%</strong> accuracy</span>
                        <span class="rec-stat"><strong>${rec.total_questions}</strong> questions</span>
                        <span class="rec-stat"><strong>${rec.correct}</strong> correct</span>
                        ${rec.weakest_difficulty ? `<span class="rec-stat">Weakest: <strong>${rec.weakest_difficulty}</strong> (${rec.weakest_accuracy}%)</span>` : ''}
                    </div>
                    <div class="rec-accuracy-bar">
                        <div class="rec-accuracy-fill ${rec.priority}" style="width: ${rec.accuracy}%"></div>
                    </div>
                    <div class="rec-action">${rec.action}</div>
                    ${diffChips ? `<div class="rec-difficulty-grid">${diffChips}</div>` : ''}
                    <a href="/home" class="rec-practice-btn">Practice ${rec.topic}</a>
                </div>
            `;
        }).join('')}
    `;
}

function displayInsights(insights) {
    const container = document.getElementById('insights-container');
    if (insights.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Mistake Patterns Yet</h3>
                <p>Complete some practice questions to start seeing insights about your learning patterns. The AI will analyze your mistakes and identify topics that need more practice.</p>
            </div>
        `;
        return;
    }
    container.innerHTML = `
        <div class="section-header">
            <h3>Your Mistake Patterns by Topic</h3>
            <span class="count-badge">${insights.length} topics with mistakes</span>
        </div>
        <div class="insights-grid">
            ${insights.map(insight => `
                <div class="insight-card">
                    <div class="insight-header">
                        <h4>${insight.topic}</h4>
                        <span class="mistake-count">${insight.mistake_count} mistakes</span>
                    </div>
                    <div class="difficulty-breakdown">
                        <h5>Difficulty Breakdown:</h5>
                        <div class="difficulty-bars">
                            ${Object.entries(insight.difficulty_breakdown).map(([level, count]) => `
                                <div class="difficulty-bar-item">
                                    <span class="level-label">${level}</span>
                                    <div class="difficulty-bar">
                                        <div class="difficulty-fill ${level.toLowerCase()}" 
                                             style="width: ${(count / insight.mistake_count * 100).toFixed(0)}%">
                                            ${count}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <p class="most-difficult">Most challenging: <strong>${insight.most_difficult_level}</strong></p>
                    </div>
                    ${insight.sample_mistakes && insight.sample_mistakes.length > 0 ? `
                        <div class="sample-mistakes">
                            <h5>Sample Mistakes:</h5>
                            ${insight.sample_mistakes.map((mistake, idx) => `
                                <div class="mistake-example">
                                    <p class="mistake-number">Example ${idx + 1}</p>
                                    <p class="mistake-question"><strong>Q:</strong> ${mistake.question}</p>
                                    <p class="mistake-answer correct"><strong>Correct:</strong> ${mistake.correct_answer}</p>
                                    <p class="mistake-answer incorrect"><strong>Your answer:</strong> ${mistake.user_answer || 'Incorrect'}</p>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="insight-message">
                        <p><strong>Insight:</strong> ${insight.insight}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function initCanvas() {
    canvas = document.getElementById('concept-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDoubleClick);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    if (!canvas) return;
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = Math.max(520, window.innerHeight - 380);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function screenToWorld(sx, sy) { return { x: (sx - offsetX) / scale, y: (sy - offsetY) / scale }; }

function getNodeAt(sx, sy) {
    const w = screenToWorld(sx, sy);
    for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const dx = w.x - n.x, dy = w.y - n.y;
        if (dx * dx + dy * dy <= n.radius * n.radius * 1.2) return n;
    }
    return null;
}

function onMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const node = getNodeAt(mx, my);
    if (node) { dragNode = node; dragNode.pinned = true; isDragging = true; selectedNode = node; showNodeDetail(node); spawnParticles(node, 8); }
    else { isPanning = true; selectedNode = null; hideNodeDetail(); }
    lastMouseX = mx; lastMouseY = my;
}

function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (isDragging && dragNode) { const w = screenToWorld(mx, my); dragNode.x = w.x; dragNode.y = w.y; dragNode.vx = 0; dragNode.vy = 0; }
    else if (isPanning) { offsetX += mx - lastMouseX; offsetY += my - lastMouseY; }
    else { const node = getNodeAt(mx, my); if (node !== hoveredNode) { hoveredNode = node; canvas.style.cursor = node ? 'grab' : 'default'; } }
    lastMouseX = mx; lastMouseY = my;
}

function onMouseUp() { if (dragNode) dragNode.pinned = false; isDragging = false; dragNode = null; isPanning = false; }

function onWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const zf = e.deltaY > 0 ? 0.92 : 1.08;
    const ns = Math.max(0.15, Math.min(3.5, scale * zf));
    offsetX = mx - (mx - offsetX) * (ns / scale);
    offsetY = my - (my - offsetY) * (ns / scale);
    scale = ns;
}

function onDoubleClick() { scale = 1; centerGraph(); }

let touchStartDist = 0;
function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.touches[0].clientX - rect.left, my = e.touches[0].clientY - rect.top;
        const node = getNodeAt(mx, my);
        if (node) { dragNode = node; dragNode.pinned = true; isDragging = true; selectedNode = node; showNodeDetail(node); }
        else { isPanning = true; }
        lastMouseX = mx; lastMouseY = my;
    } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.sqrt(dx * dx + dy * dy);
    }
}
function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.touches[0].clientX - rect.left, my = e.touches[0].clientY - rect.top;
        if (isDragging && dragNode) { const w = screenToWorld(mx, my); dragNode.x = w.x; dragNode.y = w.y; }
        else if (isPanning) { offsetX += mx - lastMouseX; offsetY += my - lastMouseY; }
        lastMouseX = mx; lastMouseY = my;
    } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (touchStartDist > 0) scale = Math.max(0.15, Math.min(3.5, scale * (dist / touchStartDist)));
        touchStartDist = dist;
    }
}
function onTouchEnd() { if (dragNode) dragNode.pinned = false; isDragging = false; dragNode = null; isPanning = false; touchStartDist = 0; }

function spawnParticles(node, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 2;
        particles.push({ x: node.x, y: node.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            life: 1, decay: 0.015 + Math.random() * 0.02, color: STATUS_STYLES[node.status].fill, size: 2 + Math.random() * 3 });
    }
}

function layoutNodes() {
    const categories = {};
    nodes.forEach(n => { if (!categories[n.category]) categories[n.category] = []; categories[n.category].push(n); });
    const catKeys = Object.keys(categories);
    const cw = parseInt(canvas.style.width) || 800;
    const ch = parseInt(canvas.style.height) || 500;
    const cx = cw / 2, cy = ch / 2;
    const orbit = Math.min(cx, cy) * 0.55;
    catKeys.forEach((cat, ci) => {
        const a = (2 * Math.PI * ci) / catKeys.length - Math.PI / 2;
        const catX = cx + orbit * Math.cos(a), catY = cy + orbit * Math.sin(a);
        const catNodes = categories[cat];
        const spread = Math.min(130, 50 + catNodes.length * 20);
        catNodes.forEach((n, ni) => { const na = (2 * Math.PI * ni) / catNodes.length; n.x = catX + spread * Math.cos(na); n.y = catY + spread * Math.sin(na); n.vx = 0; n.vy = 0; });
    });
}

function simulate() {
    const repulsion = 4500, attract = 0.004, idealLen = 220, damping = 0.82;
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].pinned) continue;
        for (let j = i + 1; j < nodes.length; j++) {
            if (nodes[j].pinned) continue;
            let dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
            let d = Math.sqrt(dx * dx + dy * dy) || 1;
            let f = repulsion / (d * d);
            let fx = (dx / d) * f, fy = (dy / d) * f;
            nodes[i].vx -= fx; nodes[i].vy -= fy;
            nodes[j].vx += fx; nodes[j].vy += fy;
        }
    }
    edges.forEach(e => {
        const s = nodes.find(n => n.id === e.source);
        const t = nodes.find(n => n.id === e.target);
        if (!s || !t) return;
        let dx = t.x - s.x, dy = t.y - s.y;
        let d = Math.sqrt(dx * dx + dy * dy) || 1;
        let f = (d - idealLen) * attract;
        let fx = (dx / d) * f, fy = (dy / d) * f;
        if (!s.pinned) { s.vx += fx; s.vy += fy; }
        if (!t.pinned) { t.vx -= fx; t.vy -= fy; }
    });
    nodes.forEach(n => { if (n.pinned) return; n.vx *= damping; n.vy *= damping; n.x += n.vx; n.y += n.vy; });
}

function centerGraph() {
    if (!nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => { minX = Math.min(minX, n.x - n.radius); minY = Math.min(minY, n.y - n.radius); maxX = Math.max(maxX, n.x + n.radius); maxY = Math.max(maxY, n.y + n.radius); });
    const gw = maxX - minX, gh = maxY - minY;
    const cw = parseInt(canvas.style.width) || 800, ch = parseInt(canvas.style.height) || 500;
    scale = Math.max(0.3, Math.min((cw - 100) / gw, (ch - 100) / gh, 1.4));
    offsetX = cw / 2 - ((minX + maxX) / 2) * scale;
    offsetY = ch / 2 - ((minY + maxY) / 2) * scale;
}

function drawHexagon(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 6; const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.closePath();
}

function draw() {
    if (!ctx || !canvas) return;
    const cw = parseInt(canvas.style.width) || 800, ch = parseInt(canvas.style.height) || 500;
    time += 0.02;
    ctx.clearRect(0, 0, cw, ch);
    const bgGrad = ctx.createLinearGradient(0, 0, cw, ch);
    bgGrad.addColorStop(0, '#0f172a'); bgGrad.addColorStop(0.5, '#1e293b'); bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, cw, ch);

    ctx.save(); ctx.globalAlpha = 0.03;
    for (let i = 0; i < 6; i++) {
        const gx = cw * 0.5 + Math.cos(time * 0.3 + i) * 200, gy = ch * 0.5 + Math.sin(time * 0.4 + i * 1.2) * 150;
        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, 300);
        grad.addColorStop(0, i % 2 === 0 ? '#6366f1' : '#10b981'); grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
    }
    ctx.restore();

    ctx.save(); ctx.translate(offsetX, offsetY); ctx.scale(scale, scale);

    edges.forEach(e => {
        const s = nodes.find(n => n.id === e.source), t = nodes.find(n => n.id === e.target);
        if (!s || !t) return;
        const dx = t.x - s.x, dy = t.y - s.y, dist = Math.sqrt(dx * dx + dy * dy);
        const pulse = 0.15 + Math.sin(time * 2 + dist * 0.01) * 0.1;
        ctx.beginPath(); ctx.moveTo(s.x, s.y);
        ctx.quadraticCurveTo((s.x + t.x) / 2 + dy * 0.15, (s.y + t.y) / 2 - dx * 0.15, t.x, t.y);
        ctx.strokeStyle = `rgba(99, 102, 241, ${pulse})`; ctx.lineWidth = 1.5 / scale; ctx.stroke();
        const mp = 0.5 + Math.sin(time * 3 + dist * 0.02) * 0.3;
        const mx = s.x + (t.x - s.x) * mp, my = s.y + (t.y - s.y) * mp;
        ctx.beginPath(); ctx.arc(mx, my, 2 / scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(129, 140, 248, ${0.5 + Math.sin(time * 4) * 0.3})`; ctx.fill();
    });

    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life -= p.decay;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life / scale, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(')', `, ${p.life * 0.6})`).replace('rgb', 'rgba'); ctx.fill();
    });

    nodes.forEach(n => {
        const style = STATUS_STYLES[n.status] || STATUS_STYLES.not_started;
        const isHov = n === hoveredNode, isSel = n === selectedNode;
        const r = n.radius, breathe = style.pulse ? Math.sin(time * 1.5 + n.id) * 3 : 0;
        if (isHov || isSel) { ctx.save(); ctx.shadowBlur = 30 / scale; ctx.shadowColor = style.glow; drawHexagon(n.x, n.y, r + 10 + breathe); ctx.fillStyle = style.glow; ctx.fill(); ctx.restore(); }
        drawHexagon(n.x, n.y, r + 4 + breathe); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
        ctx.strokeStyle = style.border; ctx.lineWidth = (isSel ? 3 : 1.5) / scale; ctx.stroke();
        const grad = ctx.createLinearGradient(n.x - r, n.y - r, n.x + r, n.y + r);
        grad.addColorStop(0, style.gradient[0]); grad.addColorStop(1, style.gradient[1]);
        drawHexagon(n.x, n.y, r); ctx.fillStyle = grad; ctx.fill();
        if (n.mastery > 0 && n.mastery < 100) {
            ctx.save(); ctx.beginPath(); ctx.moveTo(n.x, n.y);
            ctx.arc(n.x, n.y, r - 2, -Math.PI / 2, -Math.PI / 2 + (n.mastery / 100) * Math.PI * 2); ctx.closePath(); ctx.clip();
            drawHexagon(n.x, n.y, r); ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.fill(); ctx.restore();
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 6 + breathe, -Math.PI / 2, -Math.PI / 2 + (n.mastery / 100) * Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = 2.5 / scale; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const fs = Math.max(9, Math.min(13, r * 0.45));
        ctx.font = `600 ${fs}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillText(n.name.length > 14 ? n.name.substring(0, 13) + '..' : n.name, n.x, n.y - 5);
        ctx.font = `500 ${fs * 0.85}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(`${n.mastery}%`, n.x, n.y + 10);
    });
    ctx.restore();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)'; ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('Drag nodes | Scroll to zoom | Double-click to reset', 12, ch - 12);
}

function animationLoop() {
    simulate(); draw();
    animFrameId = requestAnimationFrame(animationLoop);
}

function showNodeDetail(node) {
    const detail = document.getElementById('node-detail');
    if (!detail) return;
    const style = STATUS_STYLES[node.status];
    detail.innerHTML = `
        <div class="detail-header" style="border-left: 4px solid ${style.fill};">
            <h3>${node.name}</h3>
            <span class="detail-badge" style="background: ${style.fill};">${style.label}</span>
        </div>
        <div class="detail-body">
            <div class="detail-row"><span>Category</span><span>${node.category}</span></div>
            <div class="detail-row"><span>Mastery</span><span>${node.mastery}%</span></div>
            <div class="detail-row"><span>Questions</span><span>${node.exposures}</span></div>
            <div class="detail-row"><span>Correct</span><span>${node.correct || 0}</span></div>
            <div class="detail-mastery-bar">
                <div class="detail-mastery-fill" style="width: ${node.mastery}%; background: linear-gradient(90deg, ${style.gradient[0]}, ${style.gradient[1]});"></div>
            </div>
        </div>
    `;
    detail.style.display = 'block';
}

function hideNodeDetail() {
    const detail = document.getElementById('node-detail');
    if (detail) detail.style.display = 'none';
}

async function loadConceptMap() {
    const container = document.getElementById('concept-map-container');
    container.innerHTML = '<div class="loading-map"><div class="loading-spinner"></div>Building your knowledge graph...</div>';
    try {
        const response = await fetch('/api/concept-map');
        const data = await response.json();
        if (!data.success) { container.innerHTML = '<div class="error-message">Failed to load concept map</div>'; return; }
        displayMapStats(data.stats);
        if (!data.nodes || data.nodes.length === 0) {
            container.innerHTML = `
                <div class="empty-map-message">
                    <div class="empty-icon">MAP</div>
                    <h3>Your Knowledge Graph Awaits</h3>
                    <p>Practice questions to build your interactive concept map. Each topic becomes a node, and connections form as you explore related subjects.</p>
                    <a href="/home" class="btn-practice">Start Practicing</a>
                </div>
            `;
            return;
        }
        nodes = data.nodes.map(n => ({ ...n, x: 0, y: 0, vx: 0, vy: 0, radius: Math.max(28, Math.min(55, 22 + n.exposures * 3)), pinned: false }));
        edges = data.edges || [];
        container.innerHTML = `<canvas id="concept-canvas"></canvas><div id="node-detail" class="node-detail-panel" style="display: none;"></div>`;
        initCanvas(); layoutNodes();
        if (animFrameId) cancelAnimationFrame(animFrameId);
        animationLoop();
        setTimeout(centerGraph, 300);
        mapInitialized = true;
    } catch (error) { container.innerHTML = '<div class="error-message">Failed to load concept map</div>'; }
}

function updateMapData(data) {
    if (!mapInitialized || !data.nodes) return;
    const existingPositions = {};
    nodes.forEach(n => { existingPositions[n.name] = { x: n.x, y: n.y }; });
    data.nodes.forEach(newNode => {
        const existing = nodes.find(n => n.name === newNode.name);
        if (existing) {
            existing.mastery = newNode.mastery;
            existing.exposures = newNode.exposures;
            existing.correct = newNode.correct;
            existing.status = newNode.status;
            existing.radius = Math.max(28, Math.min(55, 22 + newNode.exposures * 3));
        }
    });
    displayMapStats(data.stats);
}

function displayMapStats(stats) {
    const statsDiv = document.getElementById('map-stats');
    if (!stats || stats.total_concepts === 0) { statsDiv.innerHTML = ''; return; }
    statsDiv.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card total-stat"><div class="stat-num">${stats.total_concepts}</div><div class="stat-label">Topics</div></div>
            <div class="stat-card mastered-stat"><div class="stat-num">${stats.mastered}</div><div class="stat-label">Mastered</div></div>
            <div class="stat-card learning-stat"><div class="stat-num">${stats.learning}</div><div class="stat-label">Learning</div></div>
            <div class="stat-card beginner-stat"><div class="stat-num">${stats.beginner}</div><div class="stat-label">Beginner</div></div>
        </div>
    `;
}

function startAutoRefresh() {
    refreshInterval = setInterval(async () => {
        try {
            const [insightsRes, analysisRes] = await Promise.all([
                fetch('/api/topic-insights'),
                fetch('/api/topic-analysis')
            ]);
            const [insightsData, analysisData] = await Promise.all([insightsRes.json(), analysisRes.json()]);
            if (analysisData.success) {
                displayOverallStats(analysisData.overall);
                displayStudyTip(analysisData.study_tip);
                displayRecommendations(analysisData.recommendations || []);
            }
            if (insightsData.success) {
                displayInsights(insightsData.insights || []);
            }
            if (currentTab === 'map' && mapInitialized) {
                const mapRes = await fetch('/api/concept-map');
                const mapData = await mapRes.json();
                if (mapData.success) updateMapData(mapData);
            }
        } catch (e) { console.error('Auto-refresh error:', e); }
    }, 30000);
}

window.onload = async function() {
    fetch('/api/track-pageview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({page: window.location.pathname}) }).catch(() => {});
    if (await checkAuth()) {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && ['recommendations', 'mistakes', 'map'].includes(tab)) {
            switchTab(tab);
        }
        await loadAllData();
        startAutoRefresh();
    }
};
