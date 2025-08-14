document.addEventListener('DOMContentLoaded', function() {

    // --- CONFIGURACIÓN DE FIREBASE ---
    // ¡IMPORTANTE! Reemplaza esto con la configuración de tu propio proyecto de Firebase.
    const firebaseConfig = {
  apiKey: "AIzaSyB1W2yLlVHivzBQPZJVOgpApQeYnJUFzCs",
  authDomain: "vitreumucuencahub.firebaseapp.com",
  projectId: "vitreumucuencahub",
  storageBucket: "vitreumucuencahub.firebasestorage.app",
  messagingSenderId: "628136581064",
  appId: "1:628136581064:web:9ba793a7dfc104602fd2fd"
};

    // --- INICIALIZACIÓN DE FIREBASE Y VARIABLES GLOBALES ---
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();
    
    // Restringir el inicio de sesión solo a cuentas del dominio especificado
    provider.setCustomParameters({
      'hd': 'ucuenca.edu.ec'
    });

    const splashScreen = document.getElementById('splash-screen');
    const loginScreen = document.getElementById('login-screen');
    const appWrapper = document.getElementById('app-wrapper');

    // --- MÓDULO DE INICIALIZACIÓN PRINCIPAL ---
    function initializeApp() {
        lucide.createIcons();
        startClock();
        animateProgressBars();
        setupNavigation();
        setupActionButtons();
        handleAuthState();
    }

    // --- MANEJO DEL ESTADO DE AUTENTICACIÓN ---
    function handleAuthState() {
        auth.onAuthStateChanged(user => {
            if (user) {
                // Usuario está logueado
                console.log("Usuario autenticado:", user.displayName);
                updateUIForUser(user);
                showApp();
            } else {
                // Usuario no está logueado
                console.log("No hay usuario autenticado.");
                setupLogin();
                showLoginScreen();
            }
        });
    }

    // --- TRANSICIONES DE PANTALLA ---
    function showLoginScreen() {
        setTimeout(() => {
            splashScreen.classList.add('visible');
        }, 500);
        setTimeout(() => {
            splashScreen.classList.add('focused');
        }, 2000);
        setTimeout(() => {
            splashScreen.classList.add('exit');
        }, 3000);
        setTimeout(() => {
            splashScreen.style.display = 'none';
            loginScreen.classList.add('active');
        }, 3600);
    }

    function showApp() {
        splashScreen.style.display = 'none'; // Ocultar splash si ya estaba logueado
        loginScreen.classList.remove('active');
        appWrapper.classList.add('active');
    }

    // --- MÓDULO DE LOGIN CON GOOGLE ---
    function setupLogin() {
        const googleLoginBtn = document.getElementById('google-login-btn');
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', () => {
                auth.signInWithPopup(provider)
                    .then((result) => {
                        // El manejador onAuthStateChanged se encargará de actualizar la UI
                        console.log("Inicio de sesión exitoso con Popup.");
                    })
                    .catch((error) => {
                        console.error("Error durante el inicio de sesión:", error);
                        const loginError = document.getElementById('login-error');
                        const loginContainer = document.querySelector('.login-container');
                        
                        if (error.code === 'auth/account-exists-with-different-credential') {
                            loginError.textContent = 'Ya existe una cuenta con este email.';
                        } else if (error.code === 'auth/cancelled-popup-request') {
                            // No mostrar error si el usuario cierra el popup
                            return;
                        } else if (error.code === 'auth/popup-blocked') {
                            loginError.textContent = 'El popup fue bloqueado por el navegador.';
                        } else {
                            loginError.textContent = 'No se pudo iniciar sesión. Inténtalo de nuevo.';
                        }

                        loginError.classList.add('show');
                        loginContainer.classList.add('shake');
                        setTimeout(() => {
                            loginContainer.classList.remove('shake');
                            loginError.classList.remove('show');
                        }, 2000);
                    });
            });
        }
    }
    
    // --- ACTUALIZACIÓN DE LA INTERFAZ DE USUARIO ---
    function updateUIForUser(user) {
        if (!user) return;
        
        // Actualizar foto de perfil en el dashboard
        const userProfilePic = document.getElementById('user-profile-pic');
        if (userProfilePic) userProfilePic.src = user.photoURL || 'https://placehold.co/120x120/ffffff/1e1e28?text=U';
        
        // Actualizar foto de perfil en la pantalla de login (para futuras visitas)
        const loginProfilePic = document.querySelector('.profile-picture-login img');
        if (loginProfilePic) loginProfilePic.src = user.photoURL || 'https://placehold.co/120x120/1e1e28/f0f0f0?text=?';

        // Actualizar nombre y email
        const userDisplayName = document.getElementById('user-display-name');
        if (userDisplayName) userDisplayName.textContent = user.displayName;
        
        const userEmail = document.getElementById('user-email');
        if (userEmail) userEmail.textContent = user.email;

        // Aquí puedes añadir la lógica para verificar la licencia del usuario en Firestore
        // Ejemplo: checkUserLicense(user.uid);
        const userLicense = document.getElementById('user-license');
        if(userLicense) userLicense.textContent = "Activa"; // Placeholder
    }

    // --- ACCIONES (NAVEGACIÓN Y LOGOUT) ---
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
                auth.signOut().then(() => {
                    console.log('Sesión cerrada.');
                    document.body.style.transition = 'opacity 0.5s ease';
                    document.body.style.opacity = '0';
                    setTimeout(() => location.reload(), 500);
                });
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

    // Iniciar la aplicación
    initializeApp();
});
