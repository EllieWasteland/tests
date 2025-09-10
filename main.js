// --- Google API Configuration ---
// IMPORTANTE: Reemplaza estos valores con tus propias credenciales de Google Cloud Console.
const CLIENT_ID = '256041941450-u9nfv1gqu0tl0tl0hcn7omub6v17lfbk.apps.googleusercontent.com'; 
const API_KEY = 'AIzaSyBgO-ObGHEzAwj49vg6cm3TR0d6RT-wX38';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

let tokenClient;
let googleUser = null; // To store Google user profile information

// --- New Dynamic Script Loading and API Initialization ---

/**
 * Loads a script dynamically and returns a Promise.
 * @param {string} src The script URL to load.
 * @returns {Promise<void>}
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

/**
 * Initializes all Google API clients in the correct order.
 */
async function initializeGoogleApis() {
    const googleChoiceBtn = document.getElementById('google-login-choice-btn');
    const googleBtnText = googleChoiceBtn.querySelector('span');

    // **VERIFICACIÓN DE CLAVES API**
    if (CLIENT_ID.startsWith('TU_CLIENT_ID') || API_KEY.startsWith('TU_API_KEY')) {
        if(googleBtnText) googleBtnText.textContent = 'Faltan Claves API';
        console.error("ERROR: Por favor, reemplaza los valores de CLIENT_ID y API_KEY en main.js.");
        return; 
    }

    try {
        // Load the Google Identity Services (GIS) script first
        await loadScript('https://accounts.google.com/gsi/client');
        
        // Initialize the token client
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // Callback is handled by the Promise in handleAuthClick
        });

        // Load the Google API (GAPI) script
        await loadScript('https://apis.google.com/js/api.js');

        // Initialize the GAPI client
        await new Promise((resolve, reject) => {
            gapi.load('client', () => {
                gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: DISCOVERY_DOCS,
                }).then(resolve, reject);
            });
        });
        
        // If all successful, enable the button
        googleChoiceBtn.disabled = false;
        googleChoiceBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        if(googleBtnText) googleBtnText.textContent = 'En línea con Google';

    } catch (error) {
        console.error("Error initializing Google APIs:", error);
        if(googleBtnText) googleBtnText.textContent = 'Error de API';
        if(window.showGlobalNotification) {
            window.showGlobalNotification("Error al inicializar API. Revisa la consola.", true);
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // --- Element Declarations ---
    const googleChoiceBtn = document.getElementById('google-login-choice-btn');
    const animatedBg = document.getElementById('animated-bg');
    const onboardingScreen = document.getElementById('onboarding-screen');
    const loginScreen = document.getElementById('login-screen');
    const mainContent = document.getElementById('main-content');
    const finishOnboardingBtn = document.getElementById('finish-onboarding-btn');
    
    const loginStep1 = document.getElementById('login-step-1');
    const loginStep2 = document.getElementById('login-step-2');
    const loginStep3 = document.getElementById('login-step-3');
    
    const offlineChoiceBtn = document.getElementById('offline-login-choice-btn');
    
    const profilePicInput = document.getElementById('profile-pic-input');
    const profilePicPreview = document.getElementById('profile-pic-preview');
    const startMenuAvatar = document.getElementById('start-menu-avatar');
    const usernameInput = document.getElementById('username-input');
    const usernameSubmitBtn = document.getElementById('username-submit-btn');

    const pinGreeting = document.getElementById('pin-greeting');
    const pinSubtitle = document.getElementById('pin-subtitle');
    const pinDotsContainer = document.getElementById('pin-dots-container');
    const pinDisplayDots = document.querySelectorAll('.pin-display-dot');
    const pinKeypad = document.getElementById('pin-keypad');

    const syncCloudBtn = document.getElementById('sync-cloud-btn');
    const notification = document.getElementById('notification');
    
    // --- Initial State Setup ---
    googleChoiceBtn.disabled = true;
    googleChoiceBtn.classList.add('opacity-50', 'cursor-not-allowed');

    // --- State Variables ---
    let loginMethod = '';
    let username = '';
    let currentPin = '';
    let savedPin = '';
    let isConfirmingPin = false;
    let isLoginMode = false;

    // --- Utility Functions ---
    function showNotification(message, isError = false) {
        notification.textContent = message;
        notification.className = 'fixed top-5 right-5 text-white py-2 px-4 rounded-lg shadow-md transition-transform duration-300 transform';
        notification.classList.add(isError ? 'bg-red-500' : 'bg-green-500');
        notification.classList.add('translate-x-0');
        
        setTimeout(() => {
            notification.classList.remove('translate-x-0');
            notification.classList.add('translate-x-[120%]');
        }, 3000);
    }
    window.showGlobalNotification = showNotification;

    // --- Google Auth & Drive Logic ---

    function handleAuthClick() {
        if (!tokenClient || !gapi.client) {
            showNotification("Las APIs de Google no están listas.", true);
            return;
        }

        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                console.error('Google token error:', resp);
                showNotification('Error de autenticación con Google.', true);
                throw (resp);
            }
            
            // Establece el token para que gapi.client pueda hacer llamadas autenticadas.
            gapi.client.setToken(resp);

            try {
                // *** CAMBIO CLAVE AQUÍ ***
                // En lugar de un 'fetch' manual, usamos gapi.client.request.
                // Es más robusto y utiliza la sesión ya autenticada correctamente.
                const response = await gapi.client.request({
                    'path': 'https://www.googleapis.com/oauth2/v3/userinfo'
                });
                
                const profile = response.result;
                
                googleUser = profile;
                loginMethod = 'google';

                usernameInput.value = profile.name;
                profilePicPreview.src = profile.picture;
                
                goToLoginStep(2);

            } catch (error) {
                // El error 401 probablemente aparecerá aquí si hay un problema.
                console.error("Error fetching user profile:", error);
                showNotification("Error al obtener perfil de Google (error " + (error.result?.error?.code || 'desconocido') + "). Revisa la configuración de la API.", true);
            }
        };

        // Solicita el token.
        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    }

    async function syncToDrive() {
        if (loginMethod !== 'google' || !googleUser) {
            showNotification("Debes iniciar sesión con Google para sincronizar.", true);
            return;
        }
        if (!gapi.client.getToken()) {
            showNotification("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.", true);
            handleAuthClick(); 
            return;
        }

        showNotification("Sincronizando...");

        try {
            const folderId = await findOrCreateAppFolder();
            const userData = {
                key: googleUser.sub,
                email: googleUser.email,
                name: googleUser.name
            };
            const fileContent = JSON.stringify(userData, null, 2);
            const blob = new Blob([fileContent], { type: 'application/json' });
            const fileName = 'userData.json';

            await uploadFileToFolder(folderId, fileName, blob);
            
            showNotification("¡Sincronización completada!");

        } catch (error) {
            console.error("Error syncing to Drive:", error);
            showNotification("Error al sincronizar con Drive.", true);
        }
    }

    async function findOrCreateAppFolder() {
        const response = await gapi.client.drive.files.list({
            q: "name='WebAppDrive' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields: 'files(id, name)'
        });

        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id;
        } else {
            const fileMetadata = {
                'name': 'WebAppDrive',
                'mimeType': 'application/vnd.google-apps.folder'
            };
            const createResponse = await gapi.client.drive.files.create({
                resource: fileMetadata,
                fields: 'id'
            });
            return createResponse.result.id;
        }
    }

    function uploadFileToFolder(folderId, fileName, fileBlob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsBinaryString(fileBlob);
            reader.onload = () => {
                const boundary = '-------314159265358979323846';
                const delimiter = "\r\n--" + boundary + "\r\n";
                const close_delim = "\r\n--" + boundary + "--";

                const fileData = reader.result;
                const metadata = {
                    'name': fileName,
                    'parents': [folderId],
                    'mimeType': 'application/json'
                };

                const multipartRequestBody =
                    delimiter +
                    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                    JSON.stringify(metadata) +
                    delimiter +
                    'Content-Type: application/json\r\n\r\n' +
                    fileData +
                    close_delim;

                const request = gapi.client.request({
                    'path': '/upload/drive/v3/files',
                    'method': 'POST',
                    'params': {'uploadType': 'multipart'},
                    'headers': {'Content-Type': 'multipart/related; boundary="' + boundary + '"'},
                    'body': multipartRequestBody
                });

                request.execute((file) => {
                   if (file && !file.error) {
                        console.log('File uploaded:', file);
                        resolve(file);
                    } else {
                        console.error('Error during file upload:', file.error);
                        reject(file.error || new Error('Unknown upload error'));
                    }
                });
            };
            reader.onerror = error => reject(error);
        });
    }


    // --- Core Functions ---
    function goToLoginStep(step) {
        const steps = [loginStep1, loginStep2, loginStep3];
        steps.forEach((s, index) => {
            const isCurrent = index + 1 === step;
            s.style.opacity = isCurrent ? '1' : '0';
            s.style.pointerEvents = isCurrent ? 'auto' : 'none';
            s.style.transform = isCurrent ? 'translateY(0)' : 'translateY(-20px)';
        });
        if (step === 2) usernameInput.focus();
    }

    function proceedToMainContent() {
        if (!isLoginMode) {
            const userData = {
                username: username,
                pin: savedPin,
                pfp: profilePicPreview.src,
                loginMethod: loginMethod,
                googleProfile: loginMethod === 'google' ? googleUser : null
            };
            localStorage.setItem('webos_user', JSON.stringify(userData));
        }

        animatedBg.classList.remove('zoomed-in');
        loginScreen.style.opacity = '0';
        mainContent.classList.remove('opacity-0', 'pointer-events-none');
        
        greetingElement.innerHTML = `Hola,<br>${username}`;
        document.getElementById('start-btn').style.backgroundImage = `url(${profilePicPreview.src})`;
        startMenuAvatar.src = profilePicPreview.src;

        loginScreen.addEventListener('transitionend', () => loginScreen.style.display = 'none', { once: true });
    }

    function checkForSavedUser() {
        const savedUserDataRaw = localStorage.getItem('webos_user');
        if (savedUserDataRaw) {
            isLoginMode = true;
            const savedUserData = JSON.parse(savedUserDataRaw);
            
            username = savedUserData.username;
            savedPin = savedUserData.pin;
            profilePicPreview.src = savedUserData.pfp;
            loginMethod = savedUserData.loginMethod;
            if (loginMethod === 'google') {
                googleUser = savedUserData.googleProfile;
            }

            onboardingScreen.style.display = 'none';
            loginScreen.classList.remove('opacity-0', 'pointer-events-none');
            goToLoginStep(3);

            pinGreeting.textContent = `Hola, ${username}`;
            pinSubtitle.textContent = "Introduce tu PIN para continuar.";
        }
    }

    // --- Onboarding & Setup Logic ---
    const onboardingNextBtns = document.querySelectorAll('.onboarding-next-btn');
    onboardingNextBtns.forEach(btn => btn.addEventListener('click', () => {
        const currentStep = btn.closest('.onboarding-step');
        const nextStep = document.getElementById(`onboarding-step-${btn.dataset.nextStep}`);
        if (currentStep && nextStep) {
            currentStep.style.opacity = '0';
            currentStep.style.pointerEvents = 'none';
            nextStep.style.opacity = '1';
            nextStep.style.pointerEvents = 'auto';
        }
    }));

    finishOnboardingBtn.addEventListener('click', () => {
        onboardingScreen.style.opacity = '0';
        loginScreen.classList.remove('opacity-0', 'pointer-events-none');
        goToLoginStep(1);
        onboardingScreen.addEventListener('transitionend', () => onboardingScreen.style.display = 'none', { once: true });
    });

    googleChoiceBtn.addEventListener('click', handleAuthClick);

    offlineChoiceBtn.addEventListener('click', () => {
        loginMethod = 'offline';
        goToLoginStep(2);
    });
    
    profilePicInput.addEventListener('change', (event) => {
        if(loginMethod === 'google') return;
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => profilePicPreview.src = e.target.result;
            reader.readAsDataURL(file);
        }
    });

    usernameSubmitBtn.addEventListener('click', () => {
        if (usernameInput.value.trim() !== '') {
            username = usernameInput.value.trim();
            pinGreeting.textContent = `Hola, ${username}`;
            goToLoginStep(3);
        } else {
            usernameInput.focus();
        }
    });
    
    // --- PIN Keypad Logic ---
    function updatePinDisplay() {
        pinDisplayDots.forEach((dot, index) => {
            dot.classList.toggle('bg-pink-400', index < currentPin.length);
            dot.classList.toggle('bg-white/50', index >= currentPin.length);
        });
    }
    
    function showPinError(message, title = "Error") {
        pinDotsContainer.classList.add('shake');
        pinGreeting.textContent = title;
        pinSubtitle.textContent = message;

        setTimeout(() => {
            pinDotsContainer.classList.remove('shake');
            currentPin = '';
            updatePinDisplay();
            if (isLoginMode) {
                pinGreeting.textContent = `Hola, ${username}`;
                pinSubtitle.textContent = "Introduce tu PIN para continuar.";
            } else {
                pinGreeting.textContent = `Hola, ${username}`;
                pinSubtitle.textContent = "Crea un PIN de 4 dígitos para tu seguridad.";
                isConfirmingPin = false; 
                savedPin = '';
            }
        }, 1200);
    }

    function handlePinEntry() {
        if (isLoginMode) {
            if (currentPin === savedPin) {
                proceedToMainContent();
            } else {
                showPinError("PIN incorrecto. Inténtalo de nuevo.");
            }
            return;
        }

        if (isConfirmingPin) {
            if (currentPin === savedPin) {
                setTimeout(proceedToMainContent, 300);
            } else {
                showPinError("Los PIN no coinciden.", "Error de confirmación");
            }
        } else {
            savedPin = currentPin;
            currentPin = '';
            isConfirmingPin = true;
            pinGreeting.textContent = "Confirma tu PIN";
            pinSubtitle.textContent = "Vuelve a introducir tu PIN para continuar.";
            setTimeout(updatePinDisplay, 250);
        }
    }

    function createKeypad() {
        const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
        keys.forEach(key => {
            const keyEl = document.createElement('button');
            keyEl.type = 'button';
            keyEl.classList.add('pin-keypad-btn', 'w-16', 'h-16', 'rounded-full', 'flex', 'items-center', 'justify-center', 'text-2xl', 'font-semibold', 'text-gray-700', 'bg-white/50', 'hover:bg-white/70', 'transition-colors', 'active:scale-90');
            if (key === '') {
                keyEl.classList.add('pointer-events-none', 'bg-transparent');
            } else if (key === 'del') {
                keyEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" /></svg>`;
                keyEl.dataset.key = 'del';
            } else {
                keyEl.textContent = key;
                keyEl.dataset.key = key;
            }
            pinKeypad.appendChild(keyEl);
        });
    }

    pinKeypad.addEventListener('click', (e) => {
        const key = e.target.closest('.pin-keypad-btn')?.dataset.key;
        if (!key || pinDotsContainer.classList.contains('shake')) return;

        if (key === 'del') {
            currentPin = currentPin.slice(0, -1);
        } else if (currentPin.length < 4) {
            currentPin += key;
        }
        
        updatePinDisplay();

        if (currentPin.length === 4) {
            setTimeout(handlePinEntry, 250);
        }
    });
    
    // --- Initialization ---
    initializeGoogleApis(); // Start loading Google APIs
    createKeypad();
    checkForSavedUser();

    // --- Web OS Logic (Desktop) ---
    const appIcons = document.querySelectorAll('.app-icon');
    const appWindow = document.getElementById('app-window');
    const windowTitle = document.getElementById('window-title');
    const windowIcon = document.getElementById('window-icon');
    const appContentFrame = document.getElementById('app-content-frame');
    const loader = document.getElementById('loader');
    const closeWindowBtn = document.getElementById('close-window-btn');
    const maximizeWindowBtn = document.getElementById('maximize-window-btn');
    const clockElement = document.getElementById('clock');
    const startBtn = document.getElementById('start-btn');
    const startMenu = document.getElementById('start-menu');
    const greetingElement = document.getElementById('greeting');
    
    let activeIcon = null;
    let isAnimating = false;
    const maxIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;
    const restoreIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2_ 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
    maximizeWindowBtn.innerHTML = maxIconSVG;

    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        clockElement.textContent = timeString;
    }
    
    updateClock();
    setInterval(updateClock, 1000);

    appIcons.forEach(icon => {
        icon.innerHTML = icon.dataset.iconSvg;
    });
    
    const loadAppContent = (url) => {
        appContentFrame.src = url;
        appContentFrame.onload = () => {
            loader.classList.add('hidden');
            appContentFrame.classList.remove('hidden');
        };
    };
    
    const openApp = (url, title, iconSvg, clickedIcon) => {
        if (isAnimating) return;
        hideStartMenu();
        
        if (activeIcon && activeIcon !== clickedIcon) {
            closeApp(() => openApp(url, title, iconSvg, clickedIcon));
            return;
        }
        if (activeIcon === clickedIcon) return;
        
        isAnimating = true;
        activeIcon = clickedIcon;
        const iconRect = activeIcon.getBoundingClientRect();
        
        appWindow.style.transition = 'none';
        appWindow.style.top = `${iconRect.top}px`;
        appWindow.style.left = `${iconRect.left}px`;
        appWindow.style.width = `${iconRect.width}px`;
        appWindow.style.height = `${iconRect.height}px`;
        appWindow.style.borderRadius = '9999px';
        appWindow.style.opacity = '0';
        
        appWindow.classList.remove('hidden', 'top-4', 'left-4', 'right-4', 'bottom-24');
        appWindow.classList.add('window-animating');
        
        windowTitle.textContent = title;
        windowIcon.innerHTML = iconSvg;
        loader.classList.remove('hidden');
        appContentFrame.classList.add('hidden');
        appContentFrame.src = 'about:blank';

        requestAnimationFrame(() => {
            appWindow.style.transition = 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)';
            const viewportCenterX = window.innerWidth / 2;
            const viewportCenterY = window.innerHeight / 2;
            appWindow.style.top = `${viewportCenterY - iconRect.height / 2}px`;
            appWindow.style.left = `${viewportCenterX - iconRect.width / 2}px`;
            appWindow.style.opacity = '1';

            setTimeout(() => {
                appWindow.style.transition = 'all 350ms cubic-bezier(0.4, 0, 0.2, 1)';
                const finalTop = 16;
                const finalLeft = 16;
                const finalWidth = window.innerWidth - 32;
                const finalHeight = window.innerHeight - (16 + 96);
                appWindow.style.top = `${finalTop}px`;
                appWindow.style.left = `${finalLeft}px`;
                appWindow.style.width = `${finalWidth}px`;
                appWindow.style.height = `${finalHeight}px`;
                appWindow.style.borderRadius = '';

                setTimeout(() => {
                    appWindow.classList.remove('window-animating');
                    appWindow.classList.add('top-4', 'left-4', 'right-4', 'bottom-24');
                    appWindow.style.cssText = '';
                    loadAppContent(url);
                    isAnimating = false;
                }, 350);
            }, 300);
        });
    };

    const closeApp = (callback) => {
        if (!activeIcon || appWindow.classList.contains('hidden') || isAnimating) {
            if (typeof callback === 'function') callback();
            return;
        }
        
        isAnimating = true;
        const iconRect = activeIcon.getBoundingClientRect();
        const windowRect = appWindow.getBoundingClientRect();
        
        appWindow.classList.add('window-animating');
        if (appWindow.classList.contains('is-maximized')) {
            appWindow.classList.remove('is-maximized');
            document.body.classList.remove('window-maximized');
            maximizeWindowBtn.innerHTML = maxIconSVG;
        }
        
        appWindow.style.transition = 'none';
        appWindow.classList.remove('top-4', 'left-4', 'right-4', 'bottom-24');
        appWindow.style.top = `${windowRect.top}px`;
        appWindow.style.left = `${windowRect.left}px`;
        appWindow.style.width = `${windowRect.width}px`;
        appWindow.style.height = `${windowRect.height}px`;

        appWindow.getBoundingClientRect(); 

        requestAnimationFrame(() => {
            appWindow.style.transition = 'all 350ms cubic-bezier(0.4, 0, 0.2, 1)';
            const viewportCenterX = window.innerWidth / 2;
            const viewportCenterY = window.innerHeight / 2;
            appWindow.style.top = `${viewportCenterY - iconRect.height / 2}px`;
            appWindow.style.left = `${viewportCenterX - iconRect.width / 2}px`;
            appWindow.style.width = `${iconRect.width}px`;
            appWindow.style.height = `${iconRect.height}px`;
            appWindow.style.borderRadius = '9999px';

            setTimeout(() => {
                appWindow.style.transition = 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)';
                appWindow.style.top = `${iconRect.top}px`;
                appWindow.style.left = `${iconRect.left}px`;
                appWindow.style.opacity = '0';
                
                setTimeout(() => {
                    appWindow.classList.add('hidden');
                    appWindow.classList.remove('window-animating');
                    appWindow.classList.add('top-4', 'left-4', 'right-4', 'bottom-24');
                    appWindow.style.cssText = '';
                    windowTitle.textContent = 'Nombre de la App';
                    windowIcon.innerHTML = '';
                    activeIcon = null;
                    isAnimating = false;
                    
                    if (typeof callback === 'function') {
                        callback();
                    }
                }, 300);
            }, 350);
        });
    };
    
    function showStartMenu() {
        if (startMenu.classList.contains('visible')) return;
        const hour = new Date().getHours();
        let greetingText = '';
        if (hour < 12) { greetingText = 'Buenos días'; } 
        else if (hour < 20) { greetingText = 'Buenas tardes'; } 
        else { greetingText = 'Buenas noches'; }
        greetingElement.innerHTML = `${greetingText},<br>${username}`;

        startMenu.classList.remove('hidden');
        setTimeout(() => startMenu.classList.add('visible'), 10);
    }

    function hideStartMenu() {
        if (!startMenu.classList.contains('visible')) return;
        startMenu.classList.remove('visible');
        startMenu.addEventListener('transitionend', () => startMenu.classList.add('hidden'), { once: true });
    }

    startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (startMenu.classList.contains('visible')) {
            hideStartMenu();
        } else {
            showStartMenu();
        }
    });

    document.addEventListener('click', (e) => {
        if (!startMenu.contains(e.target) && !startBtn.contains(e.target)) {
            hideStartMenu();
        }
    });
    
    syncCloudBtn.addEventListener('click', syncToDrive);

    appIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            const url = icon.dataset.url;
            const title = icon.dataset.title;
            const iconSvg = icon.dataset.iconSvg;
            openApp(url, title, iconSvg, icon);
        });
    });

    closeWindowBtn.addEventListener('click', () => closeApp());

    maximizeWindowBtn.addEventListener('click', () => {
        const isMaximized = appWindow.classList.toggle('is-maximized');
        document.body.classList.toggle('window-maximized', isMaximized);
        
        if (isMaximized) {
            maximizeWindowBtn.innerHTML = restoreIconSVG;
            appWindow.classList.remove('top-4', 'left-4', 'right-4', 'bottom-24');
        } else {
            maximizeWindowBtn.innerHTML = maxIconSVG;
            appWindow.classList.add('top-4', 'left-4', 'right-4', 'bottom-24');
        }
    });
});

