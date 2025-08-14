document.addEventListener('DOMContentLoaded', function() {

    // --- MÓDULO DE INICIALIZACIÓN ---
    function initializeApp() {
        lucide.createIcons();
        handleSplashScreen();
        setupLogin();
        setupNavigation();
        startClock();
        animateProgressBars();
        setupActionButtons();
    }

    // --- MÓDULO DE SPLASH SCREEN (REIMAGINADA) ---
    function handleSplashScreen() {
        const splashScreen = document.getElementById('splash-screen');
        const loginScreen = document.getElementById('login-screen');

        // Secuencia de animación orquestada con timeouts
        setTimeout(() => {
            splashScreen.classList.add('visible'); // Inicia la aparición del logo y texto
        }, 500);

        setTimeout(() => {
            splashScreen.classList.add('focused'); // Inicia la animación de enfoque
        }, 3500);

        setTimeout(() => {
            splashScreen.classList.add('exit'); // Inicia el desvanecimiento de la splash screen
        }, 4500);

        setTimeout(() => {
            splashScreen.style.display = 'none';
            loginScreen.classList.add('active'); // Muestra la pantalla de login
        }, 5100); // 4.5s + 0.6s de fade-out
    }

    // --- MÓDULO DE LOGIN ---
    function setupLogin() {
        const loginScreen = document.getElementById('login-screen');
        const appWrapper = document.getElementById('app-wrapper');
        const pinInputs = document.querySelectorAll('.pin-input');
        const CORRECT_PIN = "12345";
        
        pinInputs.forEach((input, index) => {
            input.addEventListener('input', () => {
                if (input.value.length === 1 && index < pinInputs.length - 1) pinInputs[index + 1].focus();
                if (Array.from(pinInputs).every(i => i.value.length === 1)) checkPin();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && input.value.length === 0 && index > 0) pinInputs[index - 1].focus();
            });
        });

        function checkPin() {
            const enteredPin = Array.from(pinInputs).map(input => input.value).join('');
            if (enteredPin === CORRECT_PIN) {
                loginScreen.classList.remove('active');
                appWrapper.classList.add('active');
            } else {
                const pinContainer = document.getElementById('pin-container').parentElement;
                const pinError = document.getElementById('pin-error');
                pinError.classList.add('show');
                pinContainer.classList.add('shake');
                pinInputs.forEach(input => input.value = '');
                pinInputs[0].focus();
                setTimeout(() => {
                    pinContainer.classList.remove('shake');
                    pinError.classList.remove('show');
                }, 1000);
            }
        }
    }

    // --- MÓDULO DE NAVEGACIÓN Y ACCIONES ---
    function setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('data-target');
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
                link.classList.add('active');
                document.getElementById(targetId)?.classList.add('active');
            });
        });
    }

    function setupActionButtons() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                document.body.style.transition = 'opacity 0.5s ease';
                document.body.style.opacity = '0';
                setTimeout(() => location.reload(), 500);
            });
        }
    }

    // --- MÓDULOS DE UI (Reloj, Animaciones) ---
    function startClock() {
        const timeEl = document.getElementById('clock-time');
        const dateEl = document.getElementById('clock-date');
        if (!timeEl || !dateEl) return;
        function updateClock() {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
            dateEl.textContent = now.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'short' });
        }
        updateClock();
        setInterval(updateClock, 1000);
    }
    
    function animateProgressBars() {
        document.querySelectorAll('.progress-circle').forEach(circle => {
            const bar = circle.querySelector('.progress-bar');
            const progress = circle.dataset.progress;
            if (bar && progress) {
                const r = bar.r.baseVal.value;
                const circumference = 2 * Math.PI * r;
                bar.style.strokeDashoffset = circumference * (1 - progress / 100);
            }
        });
    }

    initializeApp();
});