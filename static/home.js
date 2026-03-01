async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        if (!response.ok) {
            console.error('Session check failed:', response.status);
            return;
        }
        const data = await response.json();
        
        if (data.logged_in) {
            localStorage.setItem('userRole', data.role || 'student');
            showMainApp(data.username, data.role);
            loadAdaptiveRecommendation();
            loadStreak();
            loadStudyProgressWidget();
            var ftGrid = document.getElementById('feature-tools-grid');
            if (ftGrid) ftGrid.style.display = '';
            var urlParams = new URLSearchParams(window.location.search);
            var prefillTopic = urlParams.get('topic');
            if (prefillTopic) {
                var topicInput = document.getElementById('topic');
                if (topicInput) topicInput.value = prefillTopic;
            }
            if (data.role === 'student' || data.role === 'independent') {
                loadMyClassrooms();
            }
        }
    } catch (error) {
        console.error('Error checking session:', error.message, error);
    }
}

async function loadAdaptiveRecommendation() {
    try {
        const response = await fetch('/api/adaptive-difficulty');
        if (response.ok) {
            const data = await response.json();
            const recommendationDiv = document.getElementById('adaptive-recommendation');
            if (data.recommended_difficulty) {
                recommendationDiv.innerHTML = `<small style="color: #f97316; margin-top: 5px;">💡 Recommended: ${data.recommended_difficulty}</small>`;
            }
        }
    } catch (error) {
        console.log('Adaptive recommendation unavailable');
    }
}

function showLogin() {
    document.getElementById('login-form').style.display = 'flex';
    document.getElementById('signup-form').style.display = 'none';
    document.querySelectorAll('.auth-tab')[0].classList.add('active');
    document.querySelectorAll('.auth-tab')[1].classList.remove('active');
}

function showSignup() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'flex';
    document.querySelectorAll('.auth-tab')[0].classList.remove('active');
    document.querySelectorAll('.auth-tab')[1].classList.add('active');
}

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    errorDiv.textContent = '';
    
    if (!username || !password) {
        errorDiv.textContent = 'Please enter username and password';
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('userRole', data.role);
            showMainApp(data.username, data.role);
            if (data.role === 'student' || data.role === 'independent') {
                loadMyClassrooms();
            }
        } else {
            errorDiv.textContent = data.error;
        }
    } catch (error) {
        errorDiv.textContent = 'Error logging in. Please try again.';
    }
}

async function signup() {
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    const fullName = document.getElementById('signup-full-name').value;
    const email = document.getElementById('signup-email').value;
    const roleInput = document.querySelector('input[name="signup-role"]:checked');
    const role = roleInput ? roleInput.value : 'independent';
    const errorDiv = document.getElementById('signup-error');
    
    errorDiv.textContent = '';
    
    if (!username || !password || !fullName || !email) {
        errorDiv.textContent = 'Please fill in all required fields (Name, Email, Username, Password)';
        return;
    }
    
    try {
        const signupData = { username, password, role, full_name: fullName, email: email };
        
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signupData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('userRole', data.role);
            showMainApp(data.username, data.role);
            if (data.role === 'student' || data.role === 'independent') {
                loadMyClassrooms();
            }
        } else {
            errorDiv.textContent = data.error;
        }
    } catch (error) {
        errorDiv.textContent = 'Error signing up. Please try again.';
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

function showMainApp(username, role) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    
    const headerActions = document.getElementById('header-actions');
    const headerWelcome = document.getElementById('header-welcome');
    const headerUsername = document.getElementById('header-username');
    
    if (headerActions) {
        headerActions.style.display = 'flex';
    }
    if (headerWelcome && headerUsername) {
        headerUsername.textContent = username;
        headerWelcome.style.display = 'inline';
    }
    
    const userRole = role || localStorage.getItem('userRole') || 'independent';
    const navMyClasses = document.getElementById('nav-my-classes');
    const generatorCard = document.querySelector('.generator-card');
    const teacherWelcome = document.getElementById('teacher-welcome-card');
    
    if (navMyClasses) {
        navMyClasses.style.display = userRole === 'teacher' ? 'inline-flex' : 'none';
    }
    
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (userRole !== 'teacher' && href === '/teacher-dashboard') {
            link.style.display = 'none';
        } else {
            link.style.display = 'inline-flex';
        }
    });
    
    if (userRole === 'teacher') {
        if (generatorCard) generatorCard.style.display = 'block';
        if (teacherWelcome) teacherWelcome.style.display = 'block';
    } else {
        if (generatorCard) generatorCard.style.display = 'block';
        if (teacherWelcome) teacherWelcome.style.display = 'none';
    }
}

async function generateQuestions() {
    const topic = document.getElementById('topic').value.trim();
    const difficulty = document.getElementById('difficulty').value;
    const numQuestions = parseInt(document.getElementById('num-questions').value);
    const errorDiv = document.getElementById('generate-error');
    const generateBtn = document.getElementById('generate-btn');
    
    errorDiv.textContent = '';
    
    if (!topic) {
        errorDiv.textContent = 'Please enter a topic';
        return;
    }
    
    if (numQuestions < 1 || numQuestions > 10) {
        errorDiv.textContent = 'Number of questions must be between 1 and 10';
        return;
    }
    
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, difficulty, num_questions: numQuestions })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('currentQuestions', JSON.stringify(data.questions));
            window.location.href = '/questions';
        } else {
            errorDiv.textContent = data.error || 'Error generating questions';
        }
    } catch (error) {
        errorDiv.textContent = 'Error generating questions. Please try again.';
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Questions';
    }
}

function toggleMenu() {
    const menu = document.getElementById('nav-menu');
    menu.classList.toggle('show');
}

function switchGenMode(mode, evt) {
    document.querySelectorAll('.gen-mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.generator-form').forEach(f => f.style.display = 'none');
    if (evt && evt.target) evt.target.classList.add('active');
    document.getElementById('gen-mode-' + mode).style.display = 'block';
    if (mode === 'load') loadMySharedQuizzes();
}

let uploadedMaterialText = '';

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const info = document.getElementById('file-info');
    const reader = new FileReader();
    reader.onload = function(ev) {
        uploadedMaterialText = ev.target.result;
        document.getElementById('material-text').value = uploadedMaterialText;
        info.textContent = file.name + ' (' + (uploadedMaterialText.length) + ' characters loaded)';
        info.style.display = 'block';
    };
    reader.onerror = function() {
        info.textContent = 'Error reading file';
        info.style.display = 'block';
    };
    reader.readAsText(file);
}

async function generateFromMaterial() {
    const materialText = document.getElementById('material-text').value.trim();
    const difficulty = document.getElementById('material-difficulty').value;
    const numQuestions = parseInt(document.getElementById('material-num-questions').value);
    const errorDiv = document.getElementById('material-error');
    const btn = document.getElementById('material-generate-btn');

    errorDiv.textContent = '';

    if (!materialText || materialText.length < 50) {
        errorDiv.textContent = 'Please paste or upload study notes (at least 50 characters).';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Generating from your notes...';

    try {
        const response = await fetch('/api/generate-from-material', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ material_text: materialText, difficulty, num_questions: numQuestions })
        });
        const data = await response.json();
        if (response.ok && data.questions) {
            localStorage.setItem('currentQuestions', JSON.stringify(data.questions));
            window.location.href = '/questions';
        } else {
            errorDiv.textContent = data.error || 'Error generating questions from material';
        }
    } catch (error) {
        errorDiv.textContent = 'Error generating questions. Please try again.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generate from My Notes';
    }
}

async function loadSharedQuiz() {
    const code = document.getElementById('share-code-input').value.trim().toUpperCase();
    const errorDiv = document.getElementById('load-error');
    const btn = document.getElementById('load-shared-btn');
    errorDiv.textContent = '';

    if (!code || code.length !== 6) {
        errorDiv.textContent = 'Please enter a valid 6-character share code.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Loading...';

    try {
        const response = await fetch('/api/shared-quiz/' + code);
        const data = await response.json();
        if (response.ok && data.questions) {
            localStorage.setItem('currentQuestions', JSON.stringify(data.questions));
            localStorage.setItem('sharedQuizInfo', JSON.stringify({ title: data.title, creator: data.creator }));
            window.location.href = '/questions';
        } else {
            errorDiv.textContent = data.error || 'Quiz not found.';
        }
    } catch (error) {
        errorDiv.textContent = 'Error loading quiz. Please try again.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Load Quiz';
    }
}

async function loadMySharedQuizzes() {
    const container = document.getElementById('my-shared-quizzes');
    const list = document.getElementById('shared-quizzes-list');
    if (!container || !list) return;

    try {
        const response = await fetch('/api/my-shared-quizzes');
        const data = await response.json();
        if (data.quizzes && data.quizzes.length > 0) {
            container.style.display = 'block';
            list.innerHTML = data.quizzes.map(q =>
                '<div class="shared-quiz-item">' +
                '<div class="shared-quiz-info"><strong>' + q.title + '</strong><span>' + q.topic + ' | Code: <strong>' + q.share_code + '</strong> | Views: ' + q.view_count + '</span></div>' +
                '<button class="copy-code-btn" onclick="copyCode(\'' + q.share_code + '\', this)">Copy Code</button>' +
                '</div>'
            ).join('');
        } else {
            container.style.display = 'none';
        }
    } catch (e) { container.style.display = 'none'; }
}

function copyCode(code, btn) {
    navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy Code'; }, 2000);
    });
}

async function generateTournamentRound() {
    const topic = document.getElementById('tournament-topic').value.trim();
    const numTossups = parseInt(document.getElementById('tournament-num').value);
    const errorDiv = document.getElementById('tournament-error');
    const btn = document.getElementById('tournament-generate-btn');

    errorDiv.textContent = '';

    if (!topic) {
        errorDiv.textContent = 'Please enter a topic for the tournament round.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Generating tournament round...';

    try {
        const response = await fetch('/api/generate-tournament-round', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, num_tossups: numTossups })
        });
        const data = await response.json();
        if (response.ok && data.rounds) {
            localStorage.setItem('tournamentRound', JSON.stringify(data.rounds));
            localStorage.setItem('tournamentTopic', data.topic);
            localStorage.setItem('currentQuestions', '');
            window.location.href = '/questions?mode=tournament';
        } else {
            errorDiv.textContent = data.error || 'Error generating tournament round';
        }
    } catch (error) {
        errorDiv.textContent = 'Error generating tournament round. Please try again.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Tournament Round';
    }
}

async function loadStreak() {
    try {
        const response = await fetch('/api/streak');
        if (!response.ok) return;
        const data = await response.json();
        if (data.success && data.current_streak > 0) {
            const display = document.getElementById('streak-display');
            const count = document.getElementById('streak-count');
            const best = document.getElementById('streak-best');
            if (display && count) {
                count.textContent = data.current_streak;
                display.style.display = 'flex';
                if (best && data.longest_streak > data.current_streak) {
                    best.textContent = '(Best: ' + data.longest_streak + ')';
                }
            }
        }
    } catch (e) {}
}

async function joinClassroom() {
    const codeInput = document.getElementById('join-class-code');
    const code = (codeInput.value || '').trim().toUpperCase();
    const errorDiv = document.getElementById('join-class-error');
    const messageDiv = document.getElementById('join-class-message');
    const btn = document.getElementById('join-class-btn');
    
    errorDiv.textContent = '';
    messageDiv.textContent = '';
    
    if (!code || code.length !== 6) {
        errorDiv.textContent = 'Please enter a valid 6-character class code';
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Joining...';
    
    try {
        const response = await fetch('/api/join-classroom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            messageDiv.textContent = 'Joined ' + data.classroom_name + ' successfully!';
            codeInput.value = '';
            loadMyClassrooms();
        } else {
            errorDiv.textContent = data.error || 'Could not join class';
        }
    } catch (error) {
        errorDiv.textContent = 'Error joining class. Please try again.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Join Class';
    }
}

async function loadMyClassrooms() {
    const card = document.getElementById('my-classrooms-card');
    const list = document.getElementById('my-classrooms-list');
    if (!card || !list) return;
    
    card.style.display = 'block';
    
    try {
        const response = await fetch('/api/my-classrooms');
        if (!response.ok) return;
        
        const data = await response.json();
        
        if (data.classrooms && data.classrooms.length > 0) {
            list.innerHTML = data.classrooms.map(c =>
                '<div class="classroom-detail-card">' +
                    '<div class="classroom-detail-header">' +
                        '<div><strong>' + escapeHtml(c.classroom_name) + '</strong><span class="classroom-teacher">by ' + escapeHtml(c.teacher_name) + '</span></div>' +
                        '<div class="classroom-detail-actions">' +
                            '<button onclick="toggleClassPosts(' + c.id + ')" class="btn-sm" id="class-posts-btn-' + c.id + '">View Posts</button>' +
                            '<button onclick="leaveClassroom(' + c.id + ')" class="btn-sm btn-danger-sm">Leave</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="class-posts-container" id="class-posts-' + c.id + '" style="display:none;"></div>' +
                '</div>'
            ).join('');
        } else {
            list.innerHTML = '<p class="no-data-small">No classes joined yet. Enter a class code above to join.</p>';
        }
    } catch (error) {
        console.error('Error loading classrooms:', error);
    }
}

async function toggleClassPosts(classroomId) {
    const container = document.getElementById('class-posts-' + classroomId);
    const btn = document.getElementById('class-posts-btn-' + classroomId);
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        btn.textContent = 'Hide Posts';
        container.innerHTML = '<div class="loading-text">Loading posts...</div>';
        
        try {
            const response = await fetch('/api/class-posts/' + classroomId);
            const data = await response.json();
            
            if (!data.posts || data.posts.length === 0) {
                container.innerHTML = '<p class="no-data-small">No posts from your teacher yet.</p>';
                return;
            }
            
            container.innerHTML = data.posts.map(post =>
                '<div class="student-post-card post-type-' + post.post_type + '">' +
                    '<div class="student-post-header">' +
                        '<span class="post-type-badge">' + post.post_type + '</span>' +
                        '<span class="post-date">' + formatPostDate(post.created_at) + '</span>' +
                    '</div>' +
                    '<h4>' + escapeHtml(post.title) + '</h4>' +
                    '<p>' + escapeHtml(post.content) + '</p>' +
                '</div>'
            ).join('');
        } catch (error) {
            container.innerHTML = '<p class="error">Error loading posts</p>';
        }
    } else {
        container.style.display = 'none';
        btn.textContent = 'View Posts';
    }
}

async function leaveClassroom(classroomId) {
    if (!confirm('Are you sure you want to leave this class?')) return;
    
    try {
        await fetch('/api/leave-classroom/' + classroomId, { method: 'POST' });
        loadMyClassrooms();
    } catch (error) {
        alert('Error leaving class');
    }
}

function formatPostDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', async () => {
    checkSession();
    fetch('/api/track-pageview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({page: window.location.pathname}) }).catch(() => {});
    
    const tournamentNum = document.getElementById('tournament-num');
    if (tournamentNum) {
        tournamentNum.addEventListener('change', function() {
            const n = parseInt(this.value);
            const maxEl = document.getElementById('tournament-max-pts');
            if (maxEl) maxEl.textContent = n * 40;
        });
    }
    
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    const signupUsername = document.getElementById('signup-username');
    const signupPassword = document.getElementById('signup-password');
    
    if (loginUsername) {
        loginUsername.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') login();
        });
    }
    
    if (loginPassword) {
        loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') login();
        });
    }
    
    if (signupUsername) {
        signupUsername.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') signup();
        });
    }
    
    if (signupPassword) {
        signupPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') signup();
        });
    }
});

async function loadStudyProgressWidget() {
    try {
        const response = await fetch('/api/performance-breakdown');
        if (!response.ok) return;
        const data = await response.json();
        if (!data.success) return;

        const widget = document.getElementById('study-progress-widget');
        if (!widget) return;

        const o = data.overall || {};
        document.getElementById('widget-total').textContent = o.total || 0;
        document.getElementById('widget-accuracy').textContent = (o.accuracy || 0).toFixed(0) + '%';
        document.getElementById('widget-topics').textContent = o.topics_practiced || 0;

        var weakTopic = '-';
        if (data.topics && data.topics.length > 0) {
            var sorted = data.topics.filter(function(t) { return t.total >= 2; })
                .sort(function(a, b) { return a.accuracy - b.accuracy; });
            if (sorted.length > 0) weakTopic = sorted[0].topic;
        }
        document.getElementById('widget-weak-topic').textContent = weakTopic;

        if (o.total > 0) {
            widget.style.display = 'block';
        }
    } catch (e) {
        console.log('Study progress widget unavailable');
    }
}
