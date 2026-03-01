let chatHistory = [];

async function checkSession() {
    try {
        const response = await fetch('/api/check-session');
        const data = await response.json();
        
        if (data.logged_in) {
            document.getElementById('username-display').textContent = data.username;
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

function toggleMenu() {
    const menu = document.getElementById('nav-menu');
    menu.classList.toggle('show');
}

function addMessage(role, content) {
    const messagesContainer = document.getElementById('chat-messages');
    const welcomeSection = document.getElementById('welcome-section');
    
    // Hide welcome message after first message
    if (welcomeSection && chatHistory.length === 0) {
        welcomeSection.style.display = 'none';
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? '👤' : '🤖';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Format the content with proper paragraphs and lists
    const formattedContent = formatMessage(content);
    contentDiv.innerHTML = formattedContent;
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    chatHistory.push({ role, content });
    
    // Show quick questions after AI responds
    if (role === 'assistant' && chatHistory.length > 1) {
        document.getElementById('quick-questions').style.display = 'flex';
    }
}

function formatMessage(text) {
    // Convert markdown-style formatting to HTML
    let formatted = text;
    
    // Convert **bold** to <strong>
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert bullet points to actual list
    if (formatted.includes('- ') || formatted.includes('• ')) {
        const lines = formatted.split('\n');
        let inList = false;
        let result = '';
        
        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('- ') || line.startsWith('• ')) {
                if (!inList) {
                    result += '<ul style="margin: 10px 0; padding-left: 20px;">';
                    inList = true;
                }
                result += `<li>${line.substring(2)}</li>`;
            } else {
                if (inList) {
                    result += '</ul>';
                    inList = false;
                }
                if (line) {
                    result += `<p>${line}</p>`;
                }
            }
        }
        if (inList) {
            result += '</ul>';
        }
        formatted = result;
    } else {
        // Convert line breaks to paragraphs
        formatted = formatted.split('\n\n').map(p => p.trim() ? `<p>${p.replace(/\n/g, '<br>')}</p>` : '').join('');
    }
    
    return formatted;
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chat-messages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant';
    typingDiv.id = 'typing-indicator';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';
    
    const typingContent = document.createElement('div');
    typingContent.className = 'message-content';
    typingContent.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    
    typingDiv.appendChild(avatar);
    typingDiv.appendChild(typingContent);
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
    const typingDiv = document.getElementById('typing-indicator');
    if (typingDiv) {
        typingDiv.remove();
    }
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const question = input.value.trim();
    
    if (!question) return;
    
    // Add user message
    addMessage('user', question);
    input.value = '';
    input.style.height = 'auto';
    
    // Disable input while processing
    input.disabled = true;
    sendBtn.disabled = true;
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        const response = await fetch('/api/coach-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question,
                chat_history: chatHistory.slice(-10) // Send last 10 messages for context
            })
        });
        
        const data = await response.json();
        
        hideTypingIndicator();
        
        if (response.ok && data.answer) {
            addMessage('assistant', data.answer);
        } else {
            addMessage('assistant', 'Sorry, I had trouble processing that question. Could you try rephrasing it?');
        }
    } catch (error) {
        hideTypingIndicator();
        addMessage('assistant', 'Sorry, something went wrong. Please try again.');
        console.error('Error:', error);
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

function askQuestion(question) {
    const input = document.getElementById('chat-input');
    input.value = question;
    sendMessage();
}

// Auto-resize textarea
document.addEventListener('DOMContentLoaded', async () => {
    checkSession();
    fetch('/api/track-pageview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({page: window.location.pathname}) }).catch(() => {});
    
    const chatInput = document.getElementById('chat-input');
    
    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    
    // Send on Enter (Shift+Enter for new line)
    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});
