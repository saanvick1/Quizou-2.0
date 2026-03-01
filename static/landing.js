// Simple landing page functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('Quizou landing page loaded');
    fetch('/api/track-pageview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({page: window.location.pathname}) }).catch(() => {});
});
