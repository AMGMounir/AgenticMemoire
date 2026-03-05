// ============ MémoireAI — Auth Module ============
// Handles tabs, email/password auth, and Google Sign-In

// ============ TAB SWITCHING ============

function initTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const target = tab.dataset.tab;
            if (target === 'login') {
                loginForm.style.display = 'flex';
                signupForm.style.display = 'none';
            } else {
                loginForm.style.display = 'none';
                signupForm.style.display = 'flex';
            }

            hideError();
        });
    });
}

// ============ ERROR DISPLAY ============

function showError(msg) {
    const el = document.getElementById('loginError');
    const msgEl = document.getElementById('loginErrorMsg');
    if (el && msgEl) {
        msgEl.textContent = msg;
        el.style.display = 'block';
    }
}

function hideError() {
    const el = document.getElementById('loginError');
    if (el) el.style.display = 'none';
}

function showLoading(show) {
    const loading = document.getElementById('loginLoading');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const divider = document.querySelector('.auth-divider');
    const googleBtn = document.getElementById('googleAuthBtn');

    if (show) {
        if (loading) loading.style.display = 'flex';
        if (loginForm) loginForm.style.display = 'none';
        if (signupForm) signupForm.style.display = 'none';
        if (divider) divider.style.display = 'none';
        if (googleBtn) googleBtn.style.display = 'none';
    } else {
        if (loading) loading.style.display = 'none';
        // Restore forms based on active tab
        const activeTab = document.querySelector('.auth-tab.active');
        if (activeTab && activeTab.dataset.tab === 'signup') {
            if (signupForm) signupForm.style.display = 'flex';
        } else {
            if (loginForm) loginForm.style.display = 'flex';
        }
        if (divider) divider.style.display = 'flex';
        if (googleBtn) googleBtn.style.display = 'flex';
    }
}

// ============ EMAIL/PASSWORD AUTH ============

async function handleLogin(e) {
    e.preventDefault();
    hideError();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showError('Veuillez remplir tous les champs');
        return;
    }

    showLoading(true);
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success) {
            window.location.href = '/';
        } else {
            showLoading(false);
            showError(data.error || 'Connexion échouée');
        }
    } catch (err) {
        showLoading(false);
        showError('Erreur réseau: ' + err.message);
    }
}

async function handleSignup(e) {
    e.preventDefault();
    hideError();

    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;

    if (!username || !email || !password || !confirm) {
        showError('Veuillez remplir tous les champs');
        return;
    }
    if (password.length < 6) {
        showError('Le mot de passe doit faire au moins 6 caractères');
        return;
    }
    if (password !== confirm) {
        showError('Les mots de passe ne correspondent pas');
        return;
    }

    showLoading(true);
    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, password })
        });
        const data = await res.json();

        if (data.success) {
            window.location.href = '/';
        } else {
            showLoading(false);
            showError(data.error || 'Inscription échouée');
        }
    } catch (err) {
        showLoading(false);
        showError('Erreur réseau: ' + err.message);
    }
}

// ============ GOOGLE SIGN-IN ============

async function handleGoogleCredential(response) {
    showLoading(true);
    hideError();

    try {
        const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();

        if (data.success) {
            window.location.href = '/';
        } else {
            showLoading(false);
            showError(data.error || 'Connexion Google échouée');
        }
    } catch (err) {
        showLoading(false);
        showError('Erreur: ' + err.message);
    }
}

function initGoogleAuth() {
    const googleBtn = document.getElementById('googleBtnContainer');
    if (!googleBtn) return;

    fetch('/api/auth/config')
        .then(r => r.json())
        .then(config => {
            if (!config.googleClientId || config.googleClientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
                // No Google Client ID configured
                googleBtn.innerHTML = '<div style="opacity: 0.5; cursor: not-allowed; width: 100%; text-align: center; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px;">Google Sign-In non configuré</div>';
                return;
            }

            // Initialize Google Identity Services
            if (typeof google !== 'undefined' && google.accounts) {
                google.accounts.id.initialize({
                    client_id: config.googleClientId,
                    callback: handleGoogleCredential
                });

                google.accounts.id.renderButton(
                    googleBtn,
                    { theme: "outline", size: "large", width: 340 }
                );
            } else {
                // Google library not loaded
                googleBtn.innerHTML = '<div style="color: var(--color-danger); text-align: center;">Bibliothèque Google non chargée</div>';
            }
        })
        .catch(() => {
            googleBtn.innerHTML = '<div style="opacity: 0.5; width: 100%; text-align: center; padding: 10px; border: 1px solid var(--border-color); border-radius: 6px;">Erreur de configuration Google</div>';
        });
}

// ============ AUTH GUARD ============

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            return data.data;
        }
        return null;
    } catch {
        return null;
    }
}

async function loginPageGuard() {
    const user = await checkAuth();
    if (user) {
        window.location.href = '/';
    }
}

// ============ INIT ============

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('loginForm')) {
        loginPageGuard();
        initTabs();
        initGoogleAuth();

        document.getElementById('loginForm').addEventListener('submit', handleLogin);
        document.getElementById('signupForm').addEventListener('submit', handleSignup);
    }
});
