async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        
        if (data.logged_in) {
            document.getElementById('username-display').textContent = data.username;
            updateQuestionsTabVisibility();
            loadProfile();
        } else {
            window.location.href = '/home';
        }
    } catch (error) {
        console.error('Error checking session:', error);
        window.location.href = '/home';
    }
}

function updateQuestionsTabVisibility() {
    const questionsTab = document.getElementById('questions-tab');
    const activeQuestions = localStorage.getItem('currentQuestions');
    
    if (questionsTab) {
        if (activeQuestions && JSON.parse(activeQuestions).length > 0) {
            questionsTab.style.display = 'inline-block';
        } else {
            questionsTab.style.display = 'none';
        }
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

async function loadProfile() {
    try {
        const response = await fetch('/api/profile');
        const data = await response.json();
        
        if (response.ok && data.profile) {
            document.getElementById('full-name').value = data.profile.full_name || '';
            document.getElementById('email').value = data.profile.email || '';
            document.getElementById('grade').value = data.profile.grade || '';
            document.getElementById('school').value = data.profile.school || '';
            document.getElementById('bio').value = data.profile.bio || '';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function saveProfile() {
    const fullName = document.getElementById('full-name').value.trim();
    const email = document.getElementById('email').value.trim();
    const grade = document.getElementById('grade').value;
    const school = document.getElementById('school').value.trim();
    const bio = document.getElementById('bio').value.trim();
    
    const messageDiv = document.getElementById('profile-message');
    const errorDiv = document.getElementById('profile-error');
    const saveBtn = document.getElementById('save-btn');
    
    messageDiv.textContent = '';
    errorDiv.textContent = '';
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: fullName,
                email: email,
                grade: grade,
                school: school,
                bio: bio
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            messageDiv.textContent = 'Profile saved successfully!';
            setTimeout(() => {
                messageDiv.textContent = '';
            }, 3000);
        } else {
            errorDiv.textContent = data.error || 'Error saving profile';
        }
    } catch (error) {
        errorDiv.textContent = 'Error saving profile. Please try again.';
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Profile';
    }
}

function toggleMenu() {
    const menu = document.getElementById('nav-menu');
    menu.classList.toggle('show');
}

document.addEventListener('DOMContentLoaded', async () => {
    checkSession();
    fetch('/api/track-pageview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({page: window.location.pathname}) }).catch(() => {});
});
