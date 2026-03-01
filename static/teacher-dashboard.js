let currentPostClassroomId = null;

async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        
        if (!data.logged_in) {
            window.location.href = '/home';
            return;
        }
        
        if (data.role !== 'teacher') {
            window.location.href = '/home';
            return;
        }
        
        document.getElementById('header-username').textContent = data.username;
        loadTeacherClasses();
    } catch (error) {
        window.location.href = '/home';
    }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/home';
}

async function createClass() {
    const nameInput = document.getElementById('new-class-name');
    const className = nameInput.value.trim();
    const errorDiv = document.getElementById('create-class-error');
    const messageDiv = document.getElementById('create-class-message');
    const btn = document.getElementById('create-class-btn');
    
    errorDiv.textContent = '';
    messageDiv.textContent = '';
    
    if (!className) {
        errorDiv.textContent = 'Please enter a class name';
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Creating...';
    
    try {
        const response = await fetch('/api/create-classroom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classroom_name: className })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            messageDiv.innerHTML = 'Class created! Share this code with students: <strong>' + data.classroom_code + '</strong>';
            nameInput.value = '';
            loadTeacherClasses();
        } else {
            errorDiv.textContent = data.error;
        }
    } catch (error) {
        errorDiv.textContent = 'Error creating class. Please try again.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create Class';
    }
}

async function loadTeacherClasses() {
    const loadingDiv = document.getElementById('classes-loading');
    const listDiv = document.getElementById('classes-list');
    const noClassesDiv = document.getElementById('no-classes');
    
    try {
        const response = await fetch('/api/teacher-classrooms');
        const data = await response.json();
        
        loadingDiv.style.display = 'none';
        
        if (!data.classrooms || data.classrooms.length === 0) {
            noClassesDiv.style.display = 'block';
            listDiv.innerHTML = '';
            return;
        }
        
        noClassesDiv.style.display = 'none';
        listDiv.innerHTML = data.classrooms.map(classroom => `
            <div class="class-card">
                <div class="class-header">
                    <h3>${escapeHtml(classroom.name)}</h3>
                    <div class="class-code">Code: <strong>${classroom.code}</strong></div>
                </div>
                <div class="class-stats">
                    <span class="stat">${classroom.student_count} student${classroom.student_count !== 1 ? 's' : ''}</span>
                </div>
                <div class="class-actions">
                    <button onclick="toggleStudents(${classroom.id})" class="toggle-students-btn" id="toggle-btn-${classroom.id}">
                        Show Students
                    </button>
                    <button onclick="openPostModal(${classroom.id})" class="btn-post">New Post</button>
                    <button onclick="togglePosts(${classroom.id})" class="btn-view-posts" id="posts-btn-${classroom.id}">
                        View Posts
                    </button>
                </div>
                <div class="students-list" id="students-list-${classroom.id}" style="display: none;"></div>
                <div class="posts-list" id="posts-list-${classroom.id}" style="display: none;"></div>
            </div>
        `).join('');
        
    } catch (error) {
        loadingDiv.textContent = 'Error loading classes';
    }
}

async function toggleStudents(classroomId) {
    const listDiv = document.getElementById('students-list-' + classroomId);
    const toggleBtn = document.getElementById('toggle-btn-' + classroomId);
    
    if (listDiv.style.display === 'none') {
        listDiv.style.display = 'block';
        toggleBtn.textContent = 'Hide Students';
        await loadClassroomStudents(classroomId);
    } else {
        listDiv.style.display = 'none';
        toggleBtn.textContent = 'Show Students';
    }
}

async function loadClassroomStudents(classroomId) {
    const listDiv = document.getElementById('students-list-' + classroomId);
    listDiv.innerHTML = '<div class="loading-text">Loading students...</div>';
    
    try {
        const response = await fetch('/api/classroom-students/' + classroomId);
        const data = await response.json();
        
        if (!data.students || data.students.length === 0) {
            listDiv.innerHTML = '<div class="no-students">No students have joined this class yet.</div>';
            return;
        }
        
        listDiv.innerHTML = `
            <table class="students-table">
                <thead>
                    <tr>
                        <th>Student</th>
                        <th>Email</th>
                        <th>School/Grade</th>
                        <th>Questions</th>
                        <th>Correct</th>
                        <th>Accuracy</th>
                        <th>Last Active</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.students.map(student => `
                        <tr>
                            <td>
                                <div class="student-name">
                                    <strong>${escapeHtml(student.full_name || student.username)}</strong>
                                    ${student.full_name ? `<span class="student-username">@${escapeHtml(student.username)}</span>` : ''}
                                </div>
                                ${student.bio ? `<div class="student-bio-preview">${escapeHtml(student.bio.substring(0, 50))}${student.bio.length > 50 ? '...' : ''}</div>` : ''}
                            </td>
                            <td>${escapeHtml(student.email || 'N/A')}</td>
                            <td>${escapeHtml(student.school || 'N/A')} / ${escapeHtml(student.grade || 'N/A')}</td>
                            <td>${student.total_questions}</td>
                            <td>${student.correct_answers}</td>
                            <td>${student.accuracy}%</td>
                            <td>${student.last_active || 'Never'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
    } catch (error) {
        listDiv.innerHTML = '<div class="error">Error loading students</div>';
    }
}

async function togglePosts(classroomId) {
    const listDiv = document.getElementById('posts-list-' + classroomId);
    const btn = document.getElementById('posts-btn-' + classroomId);
    
    if (listDiv.style.display === 'none') {
        listDiv.style.display = 'block';
        btn.textContent = 'Hide Posts';
        await loadClassPosts(classroomId);
    } else {
        listDiv.style.display = 'none';
        btn.textContent = 'View Posts';
    }
}

async function loadClassPosts(classroomId) {
    const listDiv = document.getElementById('posts-list-' + classroomId);
    listDiv.innerHTML = '<div class="loading-text">Loading posts...</div>';
    
    try {
        const response = await fetch('/api/class-posts/' + classroomId);
        const data = await response.json();
        
        if (!data.posts || data.posts.length === 0) {
            listDiv.innerHTML = '<div class="no-students">No posts yet. Click "New Post" to create one.</div>';
            return;
        }
        
        listDiv.innerHTML = data.posts.map(post => `
            <div class="post-card post-type-${post.post_type}">
                <div class="post-header">
                    <span class="post-type-badge">${post.post_type}</span>
                    <span class="post-date">${formatDate(post.created_at)}</span>
                    <button onclick="deletePost(${post.id}, ${classroomId})" class="post-delete-btn" title="Delete post">&times;</button>
                </div>
                <h4 class="post-title">${escapeHtml(post.title)}</h4>
                <p class="post-content">${escapeHtml(post.content)}</p>
            </div>
        `).join('');
        
    } catch (error) {
        listDiv.innerHTML = '<div class="error">Error loading posts</div>';
    }
}

function openPostModal(classroomId) {
    currentPostClassroomId = classroomId;
    document.getElementById('post-title').value = '';
    document.getElementById('post-content').value = '';
    document.getElementById('post-type').value = 'announcement';
    document.getElementById('post-error').textContent = '';
    document.getElementById('post-modal').style.display = 'flex';
}

function closePostModal() {
    document.getElementById('post-modal').style.display = 'none';
    currentPostClassroomId = null;
}

async function submitPost() {
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const postType = document.getElementById('post-type').value;
    const errorDiv = document.getElementById('post-error');
    const btn = document.getElementById('submit-post-btn');
    
    errorDiv.textContent = '';
    
    if (!title || !content) {
        errorDiv.textContent = 'Please fill in both title and content';
        return;
    }
    
    btn.disabled = true;
    btn.textContent = 'Posting...';
    
    try {
        const response = await fetch('/api/class-posts/' + currentPostClassroomId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, post_type: postType })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            closePostModal();
            const postsDiv = document.getElementById('posts-list-' + currentPostClassroomId);
            if (postsDiv && postsDiv.style.display !== 'none') {
                await loadClassPosts(currentPostClassroomId);
            }
        } else {
            errorDiv.textContent = data.error || 'Error creating post';
        }
    } catch (error) {
        errorDiv.textContent = 'Error creating post. Please try again.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Post';
    }
}

async function deletePost(postId, classroomId) {
    if (!confirm('Delete this post?')) return;
    
    try {
        const response = await fetch('/api/class-posts/delete/' + postId, { method: 'POST' });
        if (response.ok) {
            await loadClassPosts(classroomId);
        }
    } catch (error) {
        alert('Error deleting post');
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', function() {
    fetch('/api/track-pageview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({page: window.location.pathname}) }).catch(() => {});
    checkSession();
});
