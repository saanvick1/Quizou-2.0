async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        if (!data.logged_in) {
            window.location.href = '/home';
            return;
        }
        const headerActions = document.getElementById('header-actions');
        const headerWelcome = document.getElementById('header-welcome');
        const headerUsername = document.getElementById('header-username');
        if (headerActions) headerActions.style.display = 'flex';
        if (headerWelcome && headerUsername) {
            headerUsername.textContent = data.username;
            headerWelcome.style.display = 'inline';
        }
    } catch (e) {
        window.location.href = '/home';
    }
}

function toggleMenu() {
    const menu = document.getElementById('nav-menu');
    menu.classList.toggle('show');
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/home';
}

async function generatePacket() {
    const packetType = document.querySelector('input[name="packet-type"]:checked').value;
    const difficulty = document.getElementById('packet-difficulty').value;
    const errorDiv = document.getElementById('packet-error');
    const btn = document.getElementById('generate-packet-btn');
    const loading = document.getElementById('packet-loading');
    const output = document.getElementById('packet-output');

    errorDiv.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Generating...';
    loading.style.display = 'flex';
    output.style.display = 'none';

    try {
        const response = await fetch('/api/packet-generator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ packet_type: packetType, difficulty })
        });
        const data = await response.json();

        if (response.ok && data.success) {
            renderPacket(data.packet, data.packet_type);
            output.style.display = 'block';
            document.querySelector('.packet-config-card').style.display = 'none';
        } else {
            errorDiv.textContent = data.error || 'Error generating packet';
        }
    } catch (e) {
        errorDiv.textContent = 'Error generating packet. Please try again.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Packet';
        loading.style.display = 'none';
    }
}

function renderPacket(packet, packetType) {
    const container = document.getElementById('packet-content');

    if (packetType === 'lightning') {
        let html = '<div class="packet-title-block"><h2>Lightning Round</h2><p>' + packet.length + ' Short-Answer Questions</p></div>';
        packet.forEach(function(q, i) {
            html += '<div class="packet-question-block packet-lightning">' +
                '<div class="packet-q-header">' +
                '<span class="packet-q-number">' + (i + 1) + '.</span>' +
                '<span class="packet-category-label">[' + (q.category || '').toUpperCase() + ']</span>' +
                '</div>' +
                '<div class="packet-q-text">' + escapeHtml(q.question) + '</div>' +
                '<div class="packet-answer">ANSWER: ' + escapeHtml(q.answer) + '</div>' +
                '</div>';
        });
        container.innerHTML = html;
    } else {
        const label = packetType === 'full' ? 'Full Packet' : 'Half Packet';
        let html = '<div class="packet-title-block"><h2>' + label + '</h2><p>' + packet.length + ' Toss-Ups with Bonuses</p></div>';
        packet.forEach(function(q) {
            const num = q.number || '';
            html += '<div class="packet-question-block">' +
                '<div class="packet-q-header">' +
                '<span class="packet-q-number">Toss-Up ' + num + '</span>' +
                '<span class="packet-category-label">[' + (q.category || '').toUpperCase() + ']</span>' +
                '</div>' +
                '<div class="packet-q-text">' + escapeHtml(q.tossup) + '</div>' +
                '<div class="packet-answer">ANSWER: ' + escapeHtml(q.tossup_answer) + '</div>';

            if (q.bonus_leadin && q.bonus_parts) {
                html += '<div class="packet-bonus-block">' +
                    '<div class="packet-bonus-leadin">BONUS: ' + escapeHtml(q.bonus_leadin) + '</div>';
                q.bonus_parts.forEach(function(bp) {
                    html += '<div class="packet-bonus-part">' +
                        '<span class="packet-bonus-part-label">[' + (bp.part || '').toUpperCase() + ']</span> ' +
                        escapeHtml(bp.question) +
                        '<div class="packet-answer">ANSWER: ' + escapeHtml(bp.answer) + '</div>' +
                        '</div>';
                });
                html += '</div>';
            }

            html += '</div>';
        });
        container.innerHTML = html;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function resetPacket() {
    document.getElementById('packet-output').style.display = 'none';
    document.querySelector('.packet-config-card').style.display = 'block';
    document.getElementById('packet-content').innerHTML = '';
}

document.addEventListener('DOMContentLoaded', function() {
    checkSession();
});
