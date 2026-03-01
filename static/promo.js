const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.slide-in').forEach(el => observer.observe(el));

function createParticles() {
    const container = document.getElementById('hero-particles');
    if (!container) return;
    for (let i = 0; i < 40; i++) {
        const p = document.createElement('div');
        p.style.cssText = `
            position: absolute;
            width: ${2 + Math.random() * 4}px;
            height: ${2 + Math.random() * 4}px;
            background: rgba(${Math.random() > 0.5 ? '249, 115, 22' : '99, 102, 241'}, ${0.15 + Math.random() * 0.3});
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: particleFloat ${8 + Math.random() * 12}s ease-in-out infinite;
            animation-delay: ${Math.random() * -10}s;
        `;
        container.appendChild(p);
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes particleFloat {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
            25% { transform: translate(${30 + Math.random() * 40}px, ${-20 - Math.random() * 40}px) scale(1.3); opacity: 0.7; }
            50% { transform: translate(${-20 - Math.random() * 30}px, ${30 + Math.random() * 40}px) scale(0.8); opacity: 0.4; }
            75% { transform: translate(${20 + Math.random() * 30}px, ${10 + Math.random() * 20}px) scale(1.1); opacity: 0.6; }
        }
    `;
    document.head.appendChild(style);
}

const demoQuestion = "This organelle, often called the powerhouse of the cell, converts nutrients into ATP through oxidative phosphorylation. Name this double-membraned structure.";
let charIndex = 0;

function typeQuestion() {
    const el = document.getElementById('demo-question-text');
    if (!el) return;
    if (charIndex < demoQuestion.length) {
        el.textContent = demoQuestion.substring(0, charIndex + 1);
        charIndex++;
        setTimeout(typeQuestion, 25);
    } else {
        setTimeout(() => {
            const ans = document.getElementById('demo-answer');
            if (ans) ans.style.opacity = '1';
            setTimeout(() => {
                const res = document.getElementById('demo-result');
                if (res) res.style.opacity = '1';
                setTimeout(() => {
                    charIndex = 0;
                    const el2 = document.getElementById('demo-question-text');
                    const ans2 = document.getElementById('demo-answer');
                    const res2 = document.getElementById('demo-result');
                    if (el2) el2.textContent = '';
                    if (ans2) ans2.style.opacity = '0';
                    if (res2) res2.style.opacity = '0';
                    setTimeout(typeQuestion, 1000);
                }, 2500);
            }, 800);
        }, 600);
    }
}

function animateCounters() {
    const counters = document.querySelectorAll('.counter');
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.dataset.target);
                const duration = 2000;
                const start = performance.now();
                function update(now) {
                    const elapsed = now - start;
                    const progress = Math.min(elapsed / duration, 1);
                    const ease = 1 - Math.pow(1 - progress, 3);
                    el.textContent = Math.round(target * ease);
                    if (progress < 1) requestAnimationFrame(update);
                }
                requestAnimationFrame(update);
                counterObserver.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(c => counterObserver.observe(c));
}

createParticles();
animateCounters();

const solutionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            setTimeout(typeQuestion, 500);
            solutionObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

const solutionSection = document.getElementById('solution');
if (solutionSection) solutionObserver.observe(solutionSection);

fetch('/api/track-pageview', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({page: '/promo'}) }).catch(() => {});
