// ============ MémoireAI — Frontend Application ============
// Iterative 2-step workflow:
//   Step 1: Research (sources appear in real-time)
//   Step 2: User reviews sources → launches synthesis + structure

const API = '';
let currentUser = null;

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
    // Auth guard: check if user is logged in
    currentUser = await checkAuth();
    if (!currentUser) {
        window.location.href = '/login.html';
        return;
    }

    // Reveal body now that auth is confirmed
    document.body.style.opacity = '1';

    // Load user profile into sidebar
    loadUserProfile(currentUser);
    initUserDropdown();
    initSettingsModal();

    initNavigation();
    initMindmap();
    initSources();
    initMemoir();
    initAgents();
    refreshDashboard();
});

// ============ TOAST NOTIFICATIONS ============
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="#6abf7b" stroke-width="2" class="toast-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="#c97070" stroke-width="2" class="toast-icon"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="#7c8db5" stroke-width="2" class="toast-icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${icons[type] || icons.info}<span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);

    // Fade out after 3s
    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 600);
    }, 3000);
}

// ============ USER PROFILE ============
function loadUserProfile(user) {
    const avatarEl = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');

    if (nameEl) nameEl.textContent = user.username || 'Utilisateur';
    if (emailEl) emailEl.textContent = user.email || '';
    if (avatarEl) {
        const pic = user.profile_picture || user.profilePicture;
        if (pic) {
            avatarEl.src = pic;
            avatarEl.alt = user.username;
        } else {
            const initials = (user.username || 'U').charAt(0).toUpperCase();
            avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=d4a053&color=0f1117&size=72&bold=true`;
            avatarEl.alt = initials;
        }
    }

    // Credits UI
    const badgeEl = document.getElementById('navCreditBadge');
    if (badgeEl) badgeEl.textContent = `${user.credits !== undefined ? user.credits : 0} crédits`;

    const billingCredits = document.getElementById('billingCurrentCredits');
    if (billingCredits) billingCredits.textContent = user.credits !== undefined ? user.credits : '--';

    const billingPlan = document.getElementById('billingCurrentPlan');
    const subscribeBtn = document.getElementById('btnSubscribePremium');
    const cancelBtn = document.getElementById('btnCancelPremium');

    if (billingPlan) {
        if (user.is_premium) {
            if (user.subscription_status === 'canceling' && user.premium_until) {
                const dateObj = new Date(user.premium_until);
                const dateStr = dateObj.toLocaleDateString('fr-FR');
                billingPlan.textContent = `Premium (Annulé, accès jusqu'au ${dateStr})`;
                billingPlan.style.color = 'var(--text-secondary)';
                if (subscribeBtn) subscribeBtn.style.display = 'none'; // They can't resubscribe until it expires in this flow
                if (cancelBtn) cancelBtn.style.display = 'none';
            } else {
                billingPlan.textContent = 'Premium';
                billingPlan.style.color = 'var(--text-primary)';
                if (subscribeBtn) subscribeBtn.style.display = 'none';
                if (cancelBtn) cancelBtn.style.display = 'block';
            }
        } else {
            billingPlan.textContent = 'Standard';
            billingPlan.style.color = 'var(--text-secondary)';
            if (subscribeBtn) subscribeBtn.style.display = 'block';
            if (cancelBtn) cancelBtn.style.display = 'none';
        }
    }

    // Handle Premium depth locks
    const optDepth6 = document.getElementById('optDepth6');
    const optDepth8 = document.getElementById('optDepth8');
    const depthSelect = document.getElementById('depthLevel');

    if (optDepth6 && optDepth8) {
        if (user.is_premium) {
            optDepth6.disabled = false;
            optDepth6.textContent = 'Approfondie (6 req) — 25 Crédits';
            optDepth8.disabled = false;
            optDepth8.textContent = 'Maximale (8 req) — 35 Crédits';
        } else {
            optDepth6.disabled = true;
            optDepth6.textContent = 'Approfondie (6 req) — 25 Crédits 🔒 Premium';
            optDepth8.disabled = true;
            optDepth8.textContent = 'Maximale (8 req) — 35 Crédits 🔒 Premium';

            // Reset to default if a locked option is selected
            if (depthSelect && parseInt(depthSelect.value) > 4) {
                depthSelect.value = '4';
            }
        }
    }
}

function initUserDropdown() {
    const sidebarUser = document.getElementById('sidebarUser');
    const avatarBtn = document.getElementById('userAvatarBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (avatarBtn) {
        avatarBtn.addEventListener('click', () => {
            sidebarUser.classList.toggle('open');
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (sidebarUser && !sidebarUser.contains(e.target)) {
            sidebarUser.classList.remove('open');
        }
    });

    // Close billing dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const billingMenu = document.getElementById('billingMenuOptions');
        const billingBtn = document.getElementById('btnBillingMenu');
        if (billingMenu && billingBtn && !billingMenu.contains(e.target) && e.target !== billingBtn) {
            billingMenu.classList.remove('show');
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login.html';
        });
    }
}

// ============ SETTINGS MODAL ============
function initSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const openBtn = document.getElementById('openSettings');
    const closeBtn = document.getElementById('closeSettings');
    const saveBtn = document.getElementById('saveSettings');
    const deleteBtn = document.getElementById('deleteAccountBtn');
    const uploadBtn = document.getElementById('uploadAvatarBtn');
    const fileInput = document.getElementById('settingsPhotoFile');

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            document.getElementById('sidebarUser').classList.remove('open');
            openSettingsModal();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // Fix: only close modal if mousedown AND click both happen on overlay
    // This prevents closing when user selects text and releases on overlay
    if (modal) {
        let mouseDownTarget = null;
        modal.addEventListener('mousedown', (e) => {
            mouseDownTarget = e.target;
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal && mouseDownTarget === modal) {
                modal.style.display = 'none';
            }
            mouseDownTarget = null;
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveProfileSettings);
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteAccount);
    }

    // Avatar file upload
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleAvatarUpload);
    }
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('Le fichier est trop volumineux (max 5 Mo)', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const res = await fetch('/api/auth/avatar', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
            currentUser = data.data;
            loadUserProfile(currentUser);
            // Update preview in modal
            document.getElementById('settingsAvatar').src = data.avatarUrl + '?t=' + Date.now();
            showToast('Photo de profil mise à jour', 'success');
        } else {
            showToast('Erreur: ' + (data.error || 'Upload échoué'), 'error');
        }
    } catch (err) {
        showToast('Erreur réseau: ' + err.message, 'error');
    }
}

function openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (!modal || !currentUser) return;

    document.getElementById('settingsUsername').value = currentUser.username || '';
    document.getElementById('settingsEmail').value = currentUser.email || '';

    const avatarEl = document.getElementById('settingsAvatar');
    const pic = currentUser.profile_picture || currentUser.profilePicture;
    if (pic) {
        avatarEl.src = pic;
    } else {
        const initials = (currentUser.username || 'U').charAt(0).toUpperCase();
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=d4a053&color=0f1117&size=144&bold=true`;
    }

    modal.style.display = 'flex';
}

async function saveProfileSettings() {
    const username = document.getElementById('settingsUsername').value.trim();

    if (!username) {
        showToast('Le nom d\'utilisateur ne peut pas être vide', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();

        if (data.success) {
            currentUser = data.data;
            loadUserProfile(currentUser);
            showToast('Profil mis à jour avec succès', 'success');
        } else {
            showToast('Erreur: ' + (data.error || 'Mise à jour échouée'), 'error');
        }
    } catch (err) {
        showToast('Erreur réseau: ' + err.message, 'error');
    }
}

async function deleteAccount() {
    showConfirmModal('Supprimer le compte', 'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.', async () => {
        try {
            const res = await fetch('/api/auth/account', { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                window.location.href = '/login.html';
            } else {
                showToast('Erreur: ' + (data.error || 'Suppression échouée'), 'error');
            }
        } catch (err) {
            showToast('Erreur réseau: ' + err.message, 'error');
        }
    });
}

// ============ REUSABLE UI ============
function showConfirmModal(title, message, onConfirm, actionText = 'Confirmer', isDanger = true) {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;

    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;

    const cancelBtn = document.getElementById('confirmCancelBtn');
    const actionBtn = document.getElementById('confirmActionBtn');

    // Clear old event listeners by cloning
    const newCancel = cancelBtn.cloneNode(true);
    const newAction = actionBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    actionBtn.parentNode.replaceChild(newAction, actionBtn);

    newAction.textContent = actionText;
    newAction.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';

    newCancel.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    newAction.addEventListener('click', () => {
        modal.style.display = 'none';
        onConfirm();
    });

    modal.style.display = 'flex';
}

// ============ NAVIGATION ============
function initNavigation() {
    // Nav links
    document.querySelectorAll('.nav-link:not(.nav-group-toggle)').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.section);
        });
    });

    // Sub-lists toggling and parent navigation
    document.querySelectorAll('.nav-group-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const group = toggle.closest('.nav-group');
            const isChevronClick = e.target.closest('.chevron');

            if (isChevronClick) {
                if (group) group.classList.toggle('active');
            } else {
                if (toggle.dataset.section) {
                    navigateTo(toggle.dataset.section);
                }
            }
        });
    });
}

function navigateTo(section) {
    if (section === 'billing') {
        section = 'billing-overview';
    }

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const activeLink = document.querySelector(`[data-section="${section}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
        const parentGroup = activeLink.closest('.nav-group');
        // Ensure parent group is active if a child is selected
        if (parentGroup && !activeLink.classList.contains('nav-group-toggle')) {
            parentGroup.classList.add('active');
        }
    }

    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const activeSection = document.getElementById(`section-${section}`);
    if (activeSection) activeSection.classList.add('active');

    // Load data hooks
    if (section === 'sources') loadSources();
    if (section === 'agents') pollAgentStatus();
    if (section === 'memoir') loadMemoirProjects();
    if (section === 'billing-overview') {
        // Just general update if needed
    }
    if (section === 'billing-consommation') loadConsumptionHistory();
    if (section === 'billing-facturation') loadTransactionHistory();
    if (section === 'billing-paiement') loadPaymentMethods();
}

// ============ BILLING ============
let pendingPaymentCallback = null;

function deletePaymentMethod() {
    showConfirmModal('Supprimer le moyen de paiement', 'Êtes-vous sûr de vouloir supprimer votre moyen de paiement ?', async () => {
        try {
            const res = await apiDelete('/api/billing/payment-method');
            if (res.success) {
                currentUser = res.data;
                loadUserProfile(currentUser);
                showToast('Moyen de paiement supprimé avec succès.', 'success');
                // Refresh list
                loadPaymentMethods();
            } else {
                showToast(res.error || 'Erreur lors de la suppression', 'error');
            }
        } catch (err) {
            showToast('Erreur réseau', 'error');
        }
    }, 'Supprimer', true);
}

function requirePaymentMethod(onSuccess, isSubscription = false) {
    if (currentUser && currentUser.has_payment_method) {
        onSuccess();
    } else {
        pendingPaymentCallback = onSuccess;
        const modal = document.getElementById('paymentModal');
        const checkboxContainer = document.getElementById('pmtSaveCheckboxContainer');
        const checkbox = document.getElementById('pmtSaveCheckbox');

        if (checkbox) {
            if (isSubscription) {
                checkbox.checked = true;
                if (checkboxContainer) checkboxContainer.style.display = 'none';
            } else {
                checkbox.checked = false;
                if (checkboxContainer) checkboxContainer.style.display = 'block';
            }
        }

        if (modal) modal.style.display = 'flex';
    }
}

// ================= BILLING & STRIPE ELEMENTS =================
let stripeInstance = null;
let cardElement = null;

// Initialize Stripe purely for Elements UI
async function initStripe() {
    if (!stripeInstance && window.Stripe) {
        // NOTE: Uses the test key. Ensure it matches the env!
        stripeInstance = Stripe('pk_test_51RilPFRjkqpNHiEOZtlFx8ZvJqLfSqOFE6sACnILzctltb6JFupdtFu75DBkFVlCyilBIUBezyUl74xSjoBsU0s200jCZ3yTfS');
        const elements = stripeInstance.elements();

        cardElement = elements.create('card', {
            style: {
                base: {
                    color: '#e0dcf8', // text-primary approx
                    fontFamily: 'monospace',
                    fontSmoothing: 'antialiased',
                    fontSize: '16px',
                    '::placeholder': { color: '#888' }
                },
                invalid: {
                    color: '#ff4d4f',
                    iconColor: '#ff4d4f'
                }
            }
        });

        cardElement.mount('#card-element');

        cardElement.on('change', function (event) {
            const displayError = document.getElementById('card-errors');
            if (event.error) {
                displayError.textContent = event.error.message;
            } else {
                displayError.textContent = '';
            }
        });
    }
}

// Ensure it runs on load
document.addEventListener('DOMContentLoaded', initStripe);

let currentPaymentContext = null; // 'credits' | 'premium'
let currentPaymentData = null; // { packageId } etc

function openPaymentModal(context, data = null) {
    currentPaymentContext = context;
    currentPaymentData = data;

    const modal = document.getElementById('paymentModal');
    const saveContainer = document.getElementById('pmtSaveCheckboxContainer');
    const saveCheckbox = document.getElementById('pmtSaveCheckbox');

    // Reset errors
    const errorDiv = document.getElementById('card-errors');
    if (errorDiv) errorDiv.textContent = '';

    if (context === 'premium') {
        saveContainer.style.display = 'none';
        saveCheckbox.checked = true; // Subscriptions always save cards
    } else {
        saveContainer.style.display = 'block';
        saveCheckbox.checked = true; // Default intent
    }

    modal.style.display = 'flex';
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) modal.style.display = 'none';
    currentPaymentContext = null;
    currentPaymentData = null;
}

document.addEventListener('DOMContentLoaded', () => {
    const pmtCancelBtn = document.getElementById('paymentCancelBtn');
    if (pmtCancelBtn) {
        pmtCancelBtn.addEventListener('click', closePaymentModal);
    }

    const pmtSaveBtn = document.getElementById('paymentSaveBtn');
    if (pmtSaveBtn) {
        pmtSaveBtn.addEventListener('click', async () => {
            if (!stripeInstance || !cardElement) {
                showToast('Stripe n\'est pas initialisé', 'error');
                return;
            }

            const oldText = pmtSaveBtn.textContent;
            pmtSaveBtn.textContent = 'Traitement...';
            pmtSaveBtn.disabled = true;

            try {
                if (currentPaymentContext === 'credits') {
                    const packageId = currentPaymentData.packageId;
                    const saveCard = document.getElementById('pmtSaveCheckbox').checked;

                    // 1. Ask backend for PaymentIntent clientSecret
                    const res = await apiPost('/api/billing/buy-credits', { packageId, saveCard });
                    if (!res.success || !res.clientSecret) {
                        throw new Error(res.error || 'Erreur lors de la création du paiement');
                    }

                    // 2. Confirm the payment with Stripe Elements
                    const { paymentIntent, error } = await stripeInstance.confirmCardPayment(res.clientSecret, {
                        payment_method: { card: cardElement }
                    });

                    if (error) {
                        document.getElementById('card-errors').textContent = error.message;
                    } else if (paymentIntent.status === 'succeeded') {
                        // Synchronously confirm with backend to store receipt URL
                        const confirmRes = await apiPost('/api/billing/confirm-credits', {
                            paymentIntentId: paymentIntent.id
                        });

                        if (confirmRes.success) {
                            showToast('Achat réussi !', 'success');
                            closePaymentModal();
                            currentUser = confirmRes.data;
                            loadUserProfile(currentUser);
                            loadTransactionHistory();
                        } else {
                            showToast(confirmRes.error || 'Erreur lors de la validation.', 'error');
                        }
                    }

                } else if (currentPaymentContext === 'premium') {
                    // 1. Ask backend to create Subscription and return incomplete PaymentIntent secret
                    const res = await apiPost('/api/billing/subscribe-premium');
                    if (!res.success) {
                        throw new Error(res.error || 'Erreur lors de l\'abonnement');
                    }

                    if (res.status === 'active' && !res.clientSecret) {
                        showToast('Abonnement Premium activé !', 'success');
                        closePaymentModal();

                        // Optimistic update for UI state
                        currentUser.is_premium = 1;
                        currentUser.subscription_status = 'active';
                        loadUserProfile(currentUser);
                        return;
                    }

                    if (!res.clientSecret) {
                        throw new Error('Impossible de procéder au paiement.');
                    }

                    // 2. Confirm the card for the subscription
                    const { paymentIntent, error } = await stripeInstance.confirmCardPayment(res.clientSecret, {
                        payment_method: { card: cardElement }
                    });

                    if (error) {
                        document.getElementById('card-errors').textContent = error.message;
                    } else if (paymentIntent.status === 'succeeded') {
                        // Synchronously confirm with backend instead of relying entirely on webhook to avoid race conditions
                        const confirmRes = await apiPost('/api/billing/confirm-subscription', {
                            subscriptionId: res.subscriptionId
                        });

                        if (confirmRes.success) {
                            showToast('Abonnement Premium activé !', 'success');
                            closePaymentModal();

                            currentUser = confirmRes.data;
                            loadUserProfile(currentUser);
                        } else {
                            showToast(confirmRes.error || 'Erreur lors de la validation.', 'error');
                        }
                    }
                }
            } catch (err) {
                showToast(err.message || 'Erreur réseau', 'error');
            } finally {
                pmtSaveBtn.textContent = oldText;
                pmtSaveBtn.disabled = false;
            }
        });
    }

    // Stripe Customer Portal
    const portalBtn = document.getElementById('btnStripePortal');
    if (portalBtn) {
        portalBtn.addEventListener('click', async () => {
            try {
                const res = await apiPost('/api/billing/customer-portal');
                if (res.success && res.url) {
                    window.location.href = res.url;
                } else {
                    showToast(res.error || 'Erreur d\'accès au portail', 'error');
                }
            } catch (err) {
                showToast('Erreur réseau', 'error');
            }
        });
    }

    const subBtn = document.getElementById('btnSubscribePremium');
    if (subBtn) {
        subBtn.addEventListener('click', () => {
            if (currentUser && currentUser.is_premium && currentUser.subscription_status === 'active') {
                showToast('Vous êtes déjà abonné !', 'info');
                return;
            }
            openPaymentModal('premium');
        });
    }

    const cancelBtn = document.getElementById('btnCancelPremium');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            showConfirmModal('Annuler l\'abonnement', 'Êtes-vous sûr de vouloir annuler votre abonnement Premium ? Vous conserverez vos avantages jusqu\'à la fin de la période en cours.', async () => {
                try {
                    const res = await apiPost('/api/billing/cancel-premium');
                    if (res.success) {
                        currentUser = res.data;
                        loadUserProfile(currentUser);
                        showToast(res.message, 'success');
                    } else {
                        showToast(res.error || 'Erreur', 'error');
                    }
                } catch (err) {
                    showToast('Erreur réseau', 'error');
                }
            }, 'Se Désabonner', true);
        });
    }
});

async function buyCredits(packageId) {
    if (!currentUser) return;
    openPaymentModal('credits', { packageId });
}

let _facturePage = 0;
let _factureData = [];
let _consoPage = 0;
let _consoData = [];
const PAGE_SIZE = 10;

function renderPagination(containerId, currentPage, totalItems, onPageChange) {
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    if (totalPages <= 1) return '';
    const prev = currentPage > 0
        ? `<button class="btn btn-secondary btn-sm" onclick="${onPageChange}(${currentPage - 1})">&laquo; Précédent</button>`
        : `<button class="btn btn-secondary btn-sm" disabled style="opacity:0.4;">&laquo; Précédent</button>`;
    const next = currentPage < totalPages - 1
        ? `<button class="btn btn-secondary btn-sm" onclick="${onPageChange}(${currentPage + 1})">Suivant &raquo;</button>`
        : `<button class="btn btn-secondary btn-sm" disabled style="opacity:0.4;">Suivant &raquo;</button>`;
    return `<div style="display:flex; align-items:center; justify-content:space-between; padding:12px 12px 4px;">
        ${prev}
        <span style="color:var(--text-secondary); font-size:0.85rem;">Page ${currentPage + 1} / ${totalPages}</span>
        ${next}
    </div>`;
}

async function loadTransactionHistory(page) {
    const tbody = document.getElementById('billingHistoryBody');
    if (!tbody) return;

    if (page === undefined) {
        // Fresh load
        _facturePage = 0;
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-secondary);">Chargement...</td></tr>';

        try {
            const res = await apiGet('/api/billing/history');
            if (res.success) {
                _factureData = res.data.filter(t => t.amount > 0);
            } else {
                _factureData = [];
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--color-error);">Erreur réseau.</td></tr>';
            return;
        }
    } else {
        _facturePage = page;
    }

    if (_factureData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: var(--text-secondary);">Aucune facture trouvée.</td></tr>';
        return;
    }

    const start = _facturePage * PAGE_SIZE;
    const slice = _factureData.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = slice.map(t => {
        const date = new Date(t.created_at).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const amountText = `${t.amount.toFixed(2)}$`;
        const creditColor = t.credits_changed > 0 ? 'var(--color-success)' : 'var(--text-secondary)';
        const creditPrefix = t.credits_changed > 0 ? '+' : '';
        const receiptButton = t.receipt_url
            ? `<a href="${t.receipt_url}" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration: none;">PDF</a>`
            : `<button class="btn btn-secondary btn-sm" disabled style="opacity: 0.5; cursor: not-allowed;">PDF</button>`;

        return `<tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-primary);">
            <td style="padding: 12px; color: var(--text-secondary); font-size: 0.9rem;">${date}</td>
            <td style="padding: 12px; color: var(--text-primary); font-size: 0.95rem;">${escapeHtml(t.description)}</td>
            <td style="padding: 12px; color: var(--text-secondary); font-size: 0.95rem;">${amountText}</td>
            <td style="padding: 12px; color: ${creditColor}; font-weight: 600; font-size: 0.95rem;">${creditPrefix}${t.credits_changed}</td>
            <td style="padding: 12px; text-align: right;">${receiptButton}</td>
        </tr>`;
    }).join('');

    // Pagination controls
    const paginationContainer = tbody.closest('.card-body') || tbody.parentElement;
    let pagEl = paginationContainer.querySelector('.pagination-controls');
    if (pagEl) pagEl.remove();
    const totalPages = Math.ceil(_factureData.length / PAGE_SIZE);
    if (totalPages > 1) {
        const div = document.createElement('div');
        div.className = 'pagination-controls';
        div.innerHTML = renderPagination('facturation', _facturePage, _factureData.length, 'loadTransactionHistory');
        paginationContainer.appendChild(div);
    }
}

async function loadConsumptionHistory(page) {
    const tbody = document.getElementById('consumptionHistoryBody');
    if (!tbody) return;

    if (page === undefined) {
        // Fresh load
        _consoPage = 0;
        tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--text-secondary);">Chargement...</td></tr>';

        try {
            const res = await apiGet('/api/billing/history');
            if (res.success) {
                _consoData = res.data.filter(t => t.credits_changed < 0);
            } else {
                _consoData = [];
            }
        } catch (err) {
            tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--color-error);">Erreur réseau.</td></tr>';
            return;
        }
    } else {
        _consoPage = page;
    }

    if (_consoData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center; color: var(--text-secondary);">Aucune consommation trouvée.</td></tr>';
        return;
    }

    const start = _consoPage * PAGE_SIZE;
    const slice = _consoData.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = slice.map(t => {
        const date = new Date(t.created_at).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        return `<tr style="border-bottom: 1px solid var(--border-color); background: var(--bg-primary);">
            <td style="padding: 12px; color: var(--text-secondary); font-size: 0.9rem;">${date}</td>
            <td style="padding: 12px; color: var(--text-primary); font-size: 0.95rem;">${escapeHtml(t.description)}</td>
            <td style="padding: 12px; text-align: center; color: var(--color-error); font-weight: 600; font-size: 0.95rem;">${t.credits_changed}</td>
        </tr>`;
    }).join('');

    // Pagination controls
    const paginationContainer = tbody.closest('.card-body') || tbody.parentElement;
    let pagEl = paginationContainer.querySelector('.pagination-controls');
    if (pagEl) pagEl.remove();
    const totalPages = Math.ceil(_consoData.length / PAGE_SIZE);
    if (totalPages > 1) {
        const div = document.createElement('div');
        div.className = 'pagination-controls';
        div.innerHTML = renderPagination('consommation', _consoPage, _consoData.length, 'loadConsumptionHistory');
        paginationContainer.appendChild(div);
    }
}

async function loadPaymentMethods() {
    const container = document.getElementById('stripeCardsContainer');
    if (!container) return;

    container.innerHTML = '<p style="color: var(--text-secondary); padding: 10px;">Chargement des moyens de paiement...</p>';

    try {
        const res = await apiGet('/api/billing/stripe-payment-methods');

        if (res.success && res.data.length > 0) {
            container.innerHTML = `
                <div class="card">
                    <div class="card-header"><h2>Cartes enregistrées</h2></div>
                    <div class="card-body" style="padding: 0;">
                        ${res.data.map(card => {
                const brandName = card.brand.charAt(0).toUpperCase() + card.brand.slice(1);
                return `
                            <div data-card-id="${card.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 15px 20px; border-bottom: 1px solid var(--border-color);">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="background: var(--bg-secondary); padding: 8px; border-radius: 4px;">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" stroke-width="2" width="24" height="24">
                                            <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
                                            <line x1="2" y1="10" x2="22" y2="10" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div style="font-weight: 600; color: var(--text-primary);">${brandName} terminant par •••• ${card.last4}</div>
                                        <div style="font-size: 0.8rem; color: var(--text-secondary);">Expire ${String(card.exp_month).padStart(2, '0')}/${card.exp_year}</div>
                                    </div>
                                </div>
                                <button class="btn btn-secondary btn-sm" onclick="deleteStripeCard('${card.id}')" style="color: var(--color-error); border-color: var(--color-error);">Supprimer</button>
                            </div>`;
            }).join('')}
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="empty-state small" style="padding: 20px;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40" style="margin: 0 auto 12px; color: var(--text-secondary); opacity: 0.5;">
                                <rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect>
                                <line x1="2" y1="10" x2="22" y2="10"></line>
                            </svg>
                            <p style="color: var(--text-secondary);">Aucun moyen de paiement enregistré.</p>
                            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;">Vos cartes seront automatiquement sauvegardées lors de votre premier achat ou abonnement.</p>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (err) {
        container.innerHTML = '<p style="color: var(--color-error); padding: 10px;">Erreur lors du chargement des moyens de paiement.</p>';
    }
}

async function deleteStripeCard(pmId) {
    showConfirmModal('Supprimer la carte', 'Êtes-vous sûr de vouloir supprimer ce moyen de paiement ?', async () => {
        try {
            const res = await apiDelete(`/api/billing/stripe-payment-methods/${pmId}`);
            if (res.success) {
                showToast(res.message || 'Carte supprimée.', 'success');
                // Remove just the card element from DOM instead of re-rendering everything
                const cardEl = document.querySelector(`[data-card-id="${pmId}"]`);
                if (cardEl) {
                    cardEl.style.transition = 'opacity 0.3s, max-height 0.3s';
                    cardEl.style.opacity = '0';
                    cardEl.style.maxHeight = '0';
                    cardEl.style.overflow = 'hidden';
                    cardEl.style.padding = '0';
                    setTimeout(() => {
                        cardEl.remove();
                        // Check if there are any cards left
                        const remaining = document.querySelectorAll('[data-card-id]');
                        if (remaining.length === 0) {
                            loadPaymentMethods(); // Show empty state
                        }
                    }, 350);
                } else {
                    loadPaymentMethods();
                }
            } else {
                showToast(res.error || 'Erreur', 'error');
            }
        } catch (err) {
            showToast('Erreur réseau', 'error');
        }
    }, 'Supprimer', true);
}

// ============ API HELPERS ============
async function apiGet(path) {
    const res = await fetch(path);
    return res.json();
}

async function apiPost(path, body) {
    const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return res.json();
}

async function apiDelete(path) {
    const res = await fetch(path, { method: 'DELETE' });
    return res.json();
}

// ============ MINDMAP ============
function initMindmap() {
    mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
            primaryColor: '#d4a053',
            primaryTextColor: '#e8e6e3',
            primaryBorderColor: '#d4a053',
            lineColor: '#5e5a66',
            secondaryColor: '#1c1e28',
            tertiaryColor: '#21232f',
            background: '#1a1c26',
            mainBkg: '#1a1c26',
            nodeBorder: '#d4a053'
        }
    });

    document.getElementById('renderMindmap').addEventListener('click', renderMindmap);

    document.getElementById('loadExample').addEventListener('click', () => {
        document.getElementById('mindmapInput').value = `mindmap
  root((Intelligence Artificielle et Éducation))
    Applications pédagogiques
      Tuteurs intelligents
      Apprentissage adaptatif
      Évaluation automatisée
    Technologies sous-jacentes
      Machine Learning
      Traitement du langage naturel
      Systèmes de recommandation
    Enjeux éthiques
      Biais algorithmiques
      Protection des données
      Accessibilité
    Perspectives
      Personnalisation
      Gamification
      Métavers éducatif`;
        renderMindmap();
    });

    // Launch RESEARCH (not all agents)
    document.getElementById('launchResearch').addEventListener('click', launchResearch);

    // Stop process
    document.getElementById('stopProcess').addEventListener('click', stopProcess);

    // Threshold slider label
    const slider = document.getElementById('relevanceThreshold');
    const sliderLabel = document.getElementById('thresholdValue');
    if (slider && sliderLabel) {
        slider.addEventListener('input', () => { sliderLabel.textContent = slider.value; });
    }

    // Generate from title
    document.getElementById('generateFromTitle').addEventListener('click', generateFromTitle);
    document.getElementById('thesisTitle').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') generateFromTitle();
    });
}

async function renderMindmap() {
    const input = document.getElementById('mindmapInput').value.trim();
    const renderDiv = document.getElementById('mindmapRender');

    if (!input) {
        renderDiv.innerHTML = '<div class="empty-state"><p>Veuillez entrer une mindmap</p></div>';
        return;
    }

    try {
        renderDiv.innerHTML = '';
        const id = 'mermaid-' + Date.now();
        const { svg } = await mermaid.render(id, input);
        renderDiv.innerHTML = svg;

        const result = await apiPost('/api/mindmap/parse', { mindmapText: input });
        if (result.success) {
            showParsedNodes(result.data);
        }
    } catch (err) {
        renderDiv.innerHTML = `<div class="empty-state"><p style="color:var(--color-error)">Erreur de rendu: ${err.message}</p></div>`;
    }
}

async function generateFromTitle() {
    const titleInput = document.getElementById('thesisTitle');
    const title = titleInput.value.trim();
    if (!title) {
        alert('Veuillez entrer un sujet de mémoire.');
        return;
    }

    const btn = document.getElementById('generateFromTitle');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<svg class="spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Génération...';
    btn.disabled = true;

    try {
        const result = await apiPost('/api/mindmap/generate', { title });
        if (result.success) {
            document.getElementById('mindmapInput').value = result.data;
            await renderMindmap();
        } else {
            alert('Erreur: ' + result.error);
        }
    } catch (err) {
        alert('Erreur de connexion: ' + err.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function showParsedNodes(tree) {
    const card = document.getElementById('parsedNodesCard');
    const list = document.getElementById('parsedNodesList');
    const flat = flattenTree(tree);

    if (flat.length === 0) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    list.innerHTML = flat.map(node =>
        `<span class="node-tag"><span class="node-depth">N${node.depth}</span> ${node.label}</span>`
    ).join('');
}

function flattenTree(node, depth = 0) {
    const result = [{ label: node.label, depth }];
    if (node.children) {
        for (const child of node.children) {
            result.push(...flattenTree(child, depth + 1));
        }
    }
    return result;
}

// ============ RESEARCH (Step 1) ============
let isResearching = false;

async function launchResearch() {
    if (isResearching) return;

    const mindmapText = document.getElementById('mindmapInput').value.trim();
    if (!mindmapText) {
        alert('Veuillez d\'abord entrer une mindmap !');
        return;
    }

    isResearching = true;
    const btn = document.getElementById('launchResearch');
    const stopBtn = document.getElementById('stopProcess');
    if (btn) btn.disabled = true;
    if (btn) btn.innerHTML = '<svg class="spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/></svg> Recherche en cours...';
    if (stopBtn) stopBtn.style.display = 'inline-flex';

    const threshold = document.getElementById('relevanceThreshold') ? document.getElementById('relevanceThreshold').value : '30';
    const depth = document.getElementById('depthLevel') ? document.getElementById('depthLevel').value : '4';

    try {
        const result = await apiPost('/api/agents/research', { mindmapText, threshold, depth });

        if (result.success) {
            if (result.user) {
                currentUser = result.user;
                loadUserProfile(currentUser);
                showToast(`Recherche lancée ! (Solde: ${currentUser.credits} crédits)`, 'info');
            }

            document.getElementById('pipeline-research').classList.add('active');
            navigateTo('agents');
            startPolling();
            // Start source polling too (real-time updates)
            startSourcePolling();
        } else {
            alert('Erreur: ' + (result.error || 'Impossible de démarrer la recherche'));
        }
    } catch (err) {
        alert('Erreur de connexion: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> Lancer la recherche';
        }
        if (stopBtn) stopBtn.style.display = 'none';
        isResearching = false;
    }
}

async function stopProcess() {
    try {
        await apiPost('/api/agents/stop', {});
        const stopBtn = document.getElementById('stopProcess');
        if (stopBtn) stopBtn.style.display = 'none';
        document.getElementById('launchResearch').disabled = false;
        document.getElementById('launchResearch').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> Lancer la recherche';
        if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
        stopSourcePolling();
        // Hide all inline stop buttons
        document.querySelectorAll('.stop-round-btn').forEach(b => b.style.display = 'none');
    } catch (err) {
        alert('Erreur: ' + err.message);
    }
}

// ============ SYNTHESIS (Step 2) ============
let selectedProjectId = null;

async function launchSynthesis() {
    if (!selectedProjectId) {
        alert('Sélectionnez un projet (dossier) d\'abord.');
        return;
    }
    const btn = document.getElementById('launchSynthesis');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<svg class="spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/></svg> Synthèse en cours...';
    }

    try {
        const result = await apiPost('/api/agents/synthesize', { projectId: selectedProjectId });

        if (result.success) {
            if (result.user) {
                currentUser = result.user;
                loadUserProfile(currentUser);
                showToast(`Synthèse lancée ! (Solde: ${currentUser.credits} crédits)`, 'info');
            }

            document.getElementById('pipeline-research').classList.remove('active');
            navigateTo('agents');
            startPolling();
        } else {
            alert('Erreur: ' + (result.error || 'Impossible de démarrer la synthèse'));
        }
    } catch (err) {
        alert('Erreur de connexion: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3" /></svg> Lancer la synthèse';
        }
    }
}

// ============ SOURCES ============
let sourcePollingInterval = null;

function initSources() {
    document.getElementById('sourceSearch').addEventListener('input', filterSources);
    document.getElementById('sourceSort').addEventListener('change', loadSources);
    document.getElementById('refreshSources').addEventListener('click', loadSources);
    document.getElementById('addSourceBtn').addEventListener('click', addSourceManual);
    document.getElementById('launchSynthesis').addEventListener('click', () => launchSynthesis());
    document.getElementById('backToFolders').addEventListener('click', closeFolder);

    // Event delegation for project folder clicks
    document.getElementById('projectFoldersGrid').addEventListener('click', (e) => {
        // Delete project button
        const delBtn = e.target.closest('[data-delete-project]');
        if (delBtn) {
            e.stopPropagation();
            deleteProject(delBtn.dataset.deleteProject);
            return;
        }
        // Open folder
        const card = e.target.closest('[data-folder-id]');
        if (card) {
            openFolder(card.dataset.folderId, card.dataset.folderTitle);
        }
    });

    // Event delegation for source delete clicks
    document.getElementById('sourcesList').addEventListener('click', (e) => {
        const delBtn = e.target.closest('[data-delete-source]');
        if (delBtn) {
            deleteSource(delBtn.dataset.deleteSource);
        }
    });

    loadProjects();
}

function startSourcePolling() {
    if (sourcePollingInterval) clearInterval(sourcePollingInterval);
    sourcePollingInterval = setInterval(() => {
        if (selectedProjectId) loadSources();
        else loadProjects();
    }, 3000);
}

function stopSourcePolling() {
    if (sourcePollingInterval) {
        clearInterval(sourcePollingInterval);
        sourcePollingInterval = null;
    }
}

async function loadProjects() {
    try {
        const result = await apiGet('/api/projects');
        if (!result.success) return;
        const projects = result.data || [];
        const container = document.getElementById('projectFoldersGrid');

        if (projects.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <p>Aucun projet trouvé.<br>Lancez la recherche depuis la section Mindmap.</p>
            </div>`;
            return;
        }

        container.innerHTML = projects.map(p => `
            <div class="project-folder-card" data-folder-id="${p.id}" data-folder-title="${escapeHtml(p.title)}">
                <div class="folder-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                </div>
                <div class="folder-title">${escapeHtml(p.title)}</div>
                <div class="folder-count">${p.sourceCount} source${p.sourceCount !== 1 ? 's' : ''}</div>
                <button class="folder-delete-btn" data-delete-project="${p.id}" title="Supprimer le projet">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                </button>
            </div>
        `).join('');

        // Update dashboard count with total
        const countEl = document.getElementById('sourceCount');
        if (countEl) countEl.textContent = projects.reduce((s, p) => s + p.sourceCount, 0);

    } catch (err) {
        console.error('Error loading projects:', err);
    }
}

function openFolder(projectId, projectTitle) {
    selectedProjectId = projectId;

    // Switch to folder-open view
    document.getElementById('projectFoldersGrid').style.display = 'none';
    document.getElementById('sourcesList').style.display = '';
    document.getElementById('sourcesToolbar').style.display = '';
    document.getElementById('addSourceCard').style.display = '';
    document.getElementById('folderBreadcrumb').style.display = 'flex';
    document.getElementById('launchSynthesis').style.display = '';

    // Update header
    document.getElementById('sourcesTitle').textContent = projectTitle;
    document.getElementById('sourcesSubtitle').textContent = 'Vérifiez, ajoutez ou supprimez des sources, puis lancez la synthèse';
    document.getElementById('breadcrumbProjectName').textContent = projectTitle;

    loadSources();
}

function closeFolder() {
    selectedProjectId = null;

    // Switch back to folders view
    document.getElementById('projectFoldersGrid').style.display = '';
    document.getElementById('sourcesList').style.display = 'none';
    document.getElementById('sourcesToolbar').style.display = 'none';
    document.getElementById('addSourceCard').style.display = 'none';
    document.getElementById('folderBreadcrumb').style.display = 'none';
    document.getElementById('launchSynthesis').style.display = 'none';

    // Restore header
    document.getElementById('sourcesTitle').textContent = 'Sources Collectées';
    document.getElementById('sourcesSubtitle').textContent = 'Sélectionnez un projet pour voir ses sources et lancer la synthèse';

    loadProjects();
}

async function deleteProject(projectId) {
    showConfirmModal('Supprimer le projet', 'Voulez-vous vraiment supprimer ce projet et toutes ses sources ?', async () => {
        try {
            await apiDelete(`/api/projects/${projectId}`);
            if (selectedProjectId === projectId) closeFolder();
            loadProjects();
        } catch (err) {
            alert('Erreur: ' + err.message);
        }
    });
}

async function loadSources() {
    if (!selectedProjectId) return;
    try {
        const result = await apiGet(`/api/sources?project=${selectedProjectId}`);
        if (!result.success) return;

        const sources = result.data || [];
        const sortBy = document.getElementById('sourceSort').value;

        // Sort
        if (sortBy === 'relevance') sources.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
        else if (sortBy === 'date') sources.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
        else if (sortBy === 'title') sources.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

        renderSourcesList(sources);

    } catch (err) {
        console.error('Error loading sources:', err);
    }
}

function renderSourcesList(sources) {
    const container = document.getElementById('sourcesList');

    if (sources.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <p>Aucune source dans ce projet.<br>Lancez la recherche depuis la section Mindmap.</p>
        </div>`;
        return;
    }

    container.innerHTML = sources.map(source => {
        const score = source.relevanceScore || 0;
        const scoreClass = score >= 70 ? 'relevance-high' : score >= 40 ? 'relevance-medium' : 'relevance-low';
        const typeLabel = source.type === 'deep-scraped' ? '🔬 Scraped' : source.type === 'manual' ? '✏️ Manuel' : '📋 Snippet';

        return `<div class="source-card" data-id="${source.id}">
            <div class="source-card-header">
                <div class="source-title">${escapeHtml(source.title)}</div>
                <div class="relevance-badge ${scoreClass}">${score}</div>
            </div>
            ${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" class="source-url">${escapeHtml(source.url)}</a>` : ''}
            <div class="source-summary">${escapeHtml(source.summary || source.content || '')}</div>
            ${source.academicAnalysis ? `<div class="source-analysis"><strong>Analyse:</strong> ${escapeHtml(source.academicAnalysis).substring(0, 200)}...</div>` : ''}
            ${source.keyFindings && source.keyFindings.length > 0 ? `<div class="source-findings"><strong>Découvertes:</strong> ${source.keyFindings.map(f => escapeHtml(f)).join(' • ')}</div>` : ''}
            <div class="source-tags">
                <span class="source-tag">${typeLabel}</span>
                ${(source.relatedNodes || []).slice(0, 3).map(n =>
            `<span class="source-tag">${escapeHtml(n.label)}</span>`
        ).join('')}
            </div>
            <div class="source-actions">
                <button class="btn btn-secondary btn-sm" data-delete-source="${source.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Supprimer
                </button>
            </div>
        </div>`;
    }).join('');
}

function filterSources() {
    const query = document.getElementById('sourceSearch').value.toLowerCase();
    document.querySelectorAll('.source-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(query) ? '' : 'none';
    });
}

async function addSourceManual() {
    const title = document.getElementById('addSourceTitle').value.trim();
    const url = document.getElementById('addSourceUrl').value.trim();
    const content = document.getElementById('addSourceContent').value.trim();

    if (!title) {
        alert('Le titre est obligatoire.');
        return;
    }

    try {
        await apiPost('/api/sources', {
            title,
            url,
            summary: content,
            content,
            relevanceScore: 50,
            type: 'manual',
            projectId: selectedProjectId || null
        });
        // Clear form
        document.getElementById('addSourceTitle').value = '';
        document.getElementById('addSourceUrl').value = '';
        document.getElementById('addSourceContent').value = '';
        loadSources();
    } catch (err) {
        alert('Erreur: ' + err.message);
    }
}

async function deleteSource(id) {
    showConfirmModal('Supprimer la source', 'Êtes-vous sûr de vouloir supprimer cette source ?', async () => {
        try {
            await apiDelete(`/api/sources/${id}`);
            loadSources();
        } catch (err) {
            alert('Erreur: ' + err.message);
        }
    });
}


// ============ AGENTS STATUS ============
let pollingInterval = null;

function initAgents() {
    document.getElementById('clearLogs').addEventListener('click', () => {
        document.getElementById('agentLogs').innerHTML =
            '<div class="empty-state small"><p>Logs effacés.</p></div>';
    });
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(pollAgentStatus, 2000);
    pollAgentStatus();
}

async function pollAgentStatus() {
    try {
        const result = await apiGet('/api/agents/status');
        if (!result.success) return;

        const status = result.data;
        updatePipelineUI(status);

        // Update logs
        const logsDiv = document.getElementById('agentLogs');
        if (status.logs && status.logs.length > 0) {
            logsDiv.innerHTML = status.logs.slice(-50).map(log => {
                const time = new Date(log.time).toLocaleTimeString('fr-FR');
                return `<div class="log-line">
                    <span class="log-line-time">${time}</span>
                    ${log.agent ? `<span class="log-line-agent">${log.agent}</span>` : ''}
                    <span class="log-line-msg">${escapeHtml(log.message)}</span>
                </div>`;
            }).join('');
            logsDiv.scrollTop = logsDiv.scrollHeight;
        }

        // Dashboard status
        document.getElementById('agentStatus').textContent = getStatusLabel(status.phase);

        // Stop polling if done, error, stopped, or research_done
        if (status.phase === 'done' || status.phase === 'error' || status.phase === 'research_done' || status.phase === 'stopped') {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
            stopSourcePolling();

            if (status.phase === 'research_done') {
                // Auto-open the project folder
                const pid = status.projectId;
                if (pid) {
                    const projTitle = status.projectTitle || pid;
                    setTimeout(() => {
                        navigateTo('sources');
                        openFolder(pid, projTitle);
                    }, 1500);
                } else {
                    setTimeout(() => navigateTo('sources'), 1500);
                }
            }

            if (status.phase === 'done') {
                setTimeout(() => {
                    loadProjects();
                    loadMemoirProjects();
                    refreshDashboard();
                }, 1000);
            }
        }
    } catch (err) {
        console.error('Polling error:', err);
    }
}

function getStatusLabel(phase) {
    const labels = {
        'idle': 'Inactif',
        'research': 'Recherche...',
        'research_done': 'Sources prêtes',
        'synthesis': 'Synthèse...',
        'structure': 'Structuration...',
        'done': 'Terminé ✓',
        'error': 'Erreur ✗',
        'stopped': 'Arrêté ⏹'
    };
    return labels[phase] || phase;
}

function updatePipelineUI(status) {
    const magnifyingSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

    const steps = {
        'pipeline-research': { phases: ['research'], donePhases: ['research_done', 'synthesis', 'structure', 'done'] },
        'pipeline-synthesis': { phases: ['synthesis'], donePhases: ['structure', 'done'] },
        'pipeline-structure': { phases: ['structure'], donePhases: ['done'] }
    };

    for (const [id, config] of Object.entries(steps)) {
        const el = document.getElementById(id);
        const badge = el.querySelector('.status-badge');
        const stopBtn = el.querySelector('.stop-round-btn');

        el.classList.remove('active', 'completed', 'error');
        badge.className = 'status-badge';

        // Remove any previous action icon
        const oldAction = el.querySelector('.pipeline-action-icon');
        if (oldAction) oldAction.remove();

        if (config.phases.includes(status.phase)) {
            el.classList.add('active');
            badge.classList.add('running');
            badge.textContent = `${status.progress || 0}%`;
            if (stopBtn) stopBtn.style.display = 'inline-flex';
        } else if (config.donePhases.includes(status.phase)) {
            el.classList.add('completed');
            badge.classList.add('done');
            badge.textContent = 'Terminé';
            if (stopBtn) stopBtn.style.display = 'none';
        } else if (status.phase === 'error') {
            badge.classList.add('error');
            badge.textContent = 'Erreur';
            if (stopBtn) stopBtn.style.display = 'none';
        } else {
            badge.classList.add('idle');
            badge.textContent = 'En attente';
            if (stopBtn) stopBtn.style.display = 'none';
        }

        // Orange magnifying glass on Synthesis step when research is done (waiting for user to launch synthesis)
        if (id === 'pipeline-synthesis' && status.phase === 'research_done') {
            badge.textContent = '';
            badge.className = 'status-badge';
            const actionBtn = document.createElement('span');
            actionBtn.className = 'pipeline-action-icon';
            actionBtn.innerHTML = `Vérifier ${magnifyingSvg}`;
            actionBtn.title = 'Voir les sources et lancer la synthèse';
            actionBtn.style.cssText = 'cursor:pointer; color:var(--accent-primary); display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:20px; background:var(--accent-primary-bg); transition:all 0.2s; font-size:0.85rem; font-weight:600;';
            actionBtn.addEventListener('mouseenter', () => { actionBtn.style.background = 'rgba(212,160,83,0.25)'; });
            actionBtn.addEventListener('mouseleave', () => { actionBtn.style.background = 'var(--accent-primary-bg)'; });
            actionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigateTo('sources');
                if (status.projectId) {
                    setTimeout(() => openFolder(status.projectId, status.projectTitle || status.projectId), 100);
                }
            });
            badge.after(actionBtn);
        }

        // Green magnifying glass on Structure step when project is fully done
        if (id === 'pipeline-structure' && status.phase === 'done') {
            const actionBtn = document.createElement('span');
            actionBtn.className = 'pipeline-action-icon';
            actionBtn.innerHTML = `Vérifier ${magnifyingSvg}`;
            actionBtn.title = 'Voir le mémoire structuré';
            actionBtn.style.cssText = 'cursor:pointer; color:var(--color-success); display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:20px; background:var(--color-success-bg); transition:all 0.2s; font-size:0.85rem; font-weight:600; margin-left:8px;';
            actionBtn.addEventListener('mouseenter', () => { actionBtn.style.background = 'rgba(106,191,123,0.25)'; });
            actionBtn.addEventListener('mouseleave', () => { actionBtn.style.background = 'var(--color-success-bg)'; });
            actionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigateTo('memoir');
                if (status.projectId) {
                    setTimeout(() => openMemoirFolder(status.projectId, status.projectTitle || status.projectId), 100);
                }
            });
            badge.after(actionBtn);
        }
    }
}

// ============ MEMOIR ============
let selectedMemoirProjectId = null;

function initMemoir() {
    // Event delegation for memoir folder clicks
    document.getElementById('memoirFoldersGrid').addEventListener('click', (e) => {
        // Delete memoir project button
        const delBtn = e.target.closest('[data-delete-memoir-project]');
        if (delBtn) {
            e.stopPropagation();
            deleteMemoirProject(delBtn.dataset.deleteMemoirProject);
            return;
        }
        const card = e.target.closest('[data-memoir-folder-id]');
        if (card) {
            openMemoirFolder(card.dataset.memoirFolderId, card.dataset.memoirFolderTitle);
        }
    });
    document.getElementById('backToMemoirFolders').addEventListener('click', closeMemoirFolder);
    loadMemoirProjects();
}

async function loadMemoirProjects() {
    try {
        const result = await apiGet('/api/projects');
        if (!result.success) return;
        const projects = result.data || [];
        const container = document.getElementById('memoirFoldersGrid');

        if (projects.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                </svg>
                <p>Aucun projet trouvé.<br>Lancez la recherche depuis la section Mindmap.</p>
            </div>`;
            return;
        }

        container.innerHTML = projects.map(p => `
            <div class="project-folder-card" data-memoir-folder-id="${p.id}" data-memoir-folder-title="${escapeHtml(p.title)}">
                <div class="folder-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                </div>
                <div class="folder-title">${escapeHtml(p.title)}</div>
                <div class="folder-count">${p.hasMemoir ? '✅ Mémoire disponible' : `${p.sourceCount} source${p.sourceCount !== 1 ? 's' : ''}`}</div>
                <button class="folder-delete-btn" data-delete-memoir-project="${p.id}" title="Supprimer le projet">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                </button>
            </div>
        `).join('');

    } catch (err) {
        console.error('Error loading memoir projects:', err);
    }
}

async function deleteMemoirProject(projectId) {
    showConfirmModal('Supprimer le projet', 'Êtes-vous sûr de vouloir supprimer ce projet et tout son contenu (sources, mémoire, etc.) ?', async () => {
        try {
            await apiDelete(`/api/projects/${projectId}`);
            loadMemoirProjects();
            loadProjects();
        } catch (err) {
            showToast('Erreur: ' + err.message, 'error');
        }
    });
}

function openMemoirFolder(projectId, projectTitle) {
    selectedMemoirProjectId = projectId;

    document.getElementById('memoirFoldersGrid').style.display = 'none';
    document.getElementById('memoirContent').style.display = '';
    document.getElementById('memoirBreadcrumb').style.display = 'flex';
    document.getElementById('downloadMemoir').style.display = 'none';

    document.getElementById('memoirTitle').textContent = projectTitle;
    document.getElementById('memoirSubtitle').textContent = 'Structure et synthèse du mémoire';
    document.getElementById('memoirBreadcrumbProjectName').textContent = projectTitle;

    loadMemoir(projectId);
}

function closeMemoirFolder() {
    selectedMemoirProjectId = null;

    document.getElementById('memoirFoldersGrid').style.display = '';
    document.getElementById('memoirContent').style.display = 'none';
    document.getElementById('memoirBreadcrumb').style.display = 'none';
    document.getElementById('downloadMemoir').style.display = 'none';

    document.getElementById('memoirTitle').textContent = 'Mémoires Générés';
    document.getElementById('memoirSubtitle').textContent = 'Sélectionnez un projet pour consulter son mémoire';

    loadMemoirProjects();
}

async function loadMemoir(projectId) {
    try {
        const url = projectId ? `/api/memoir/${projectId}` : '/api/memoir';
        const result = await apiGet(url);
        if (!result.success) return;

        const { structure, synthesis } = result.data;
        const container = document.getElementById('memoirContent');
        const downloadBtn = document.getElementById('downloadMemoir');

        if (!structure) {
            container.innerHTML = `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                </svg>
                <p>La structure du mémoire sera générée après la synthèse.<br>Lancez la synthèse depuis la section Sources.</p>
            </div>`;
            downloadBtn.style.display = 'none';
            return;
        }

        downloadBtn.style.display = 'flex';
        downloadBtn.onclick = () => downloadMemoir(structure, synthesis);

        let html = `<div class="memoir-header">
            <h2 class="memoir-title">${escapeHtml(structure.title || 'Mémoire')}</h2>
            ${structure.problemStatement ? `<div class="memoir-problem">${escapeHtml(structure.problemStatement)}</div>` : ''}
            <div class="memoir-meta">
                ${structure.methodology ? `<div class="memoir-meta-item"><strong>Méthodologie:</strong> ${escapeHtml(structure.methodology).substring(0, 150)}${structure.methodology.length > 150 ? '...' : ''}</div>` : ''}
                ${structure.estimatedPages ? `<div class="memoir-meta-item"><strong>Pages estimées:</strong> ${structure.estimatedPages}</div>` : ''}
            </div>
        </div>`;

        if (structure.sections) {
            html += '<div class="memoir-sections">';
            for (const section of structure.sections) {
                html += `<div class="memoir-section">
                    <div class="memoir-section-header" onclick="this.parentElement.classList.toggle('open')">
                        <span class="memoir-section-number">${escapeHtml(String(section.number))}</span>
                        <span class="memoir-section-title">${escapeHtml(section.title)}</span>
                        ${section.estimatedPages ? `<span class="memoir-meta-item" style="margin-left:auto; margin-right:12px;font-size:0.8rem">${section.estimatedPages} pages</span>` : ''}
                        <svg class="memoir-section-toggle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </div>
                    <div class="memoir-section-body">
                        <p class="memoir-section-desc">${escapeHtml(section.description)}</p>
                        ${section.subsections && section.subsections.length > 0 ? `
                        <div class="memoir-subsections">
                            ${section.subsections.map(sub => `
                            <div class="memoir-subsection">
                                <span class="memoir-subsection-number">${escapeHtml(String(sub.number))}</span>
                                <span class="memoir-subsection-title">${escapeHtml(sub.title)}</span>
                                ${sub.description ? `<p class="memoir-subsection-desc">${escapeHtml(sub.description)}</p>` : ''}
                            </div>`).join('')}
                        </div>` : ''}
                    </div>
                </div>`;
            }
            html += '</div>';
        }

        // Synthesis display (rich)
        if (synthesis && synthesis.themes && synthesis.themes.length > 0) {
            html += '<div class="synthesis-section"><h2>Synthèse académique</h2>';

            for (const theme of synthesis.themes) {
                html += `<div class="synthesis-theme">
                    <h3>${escapeHtml(theme.theme)}</h3>
                    <div class="synthesis-text">${escapeHtml(theme.synthesis)}</div>`;

                if (theme.criticalAnalysis) {
                    html += `<div class="synthesis-block"><h4>🔍 Analyse critique</h4><p>${escapeHtml(theme.criticalAnalysis)}</p></div>`;
                }
                if (theme.theoreticalFramework) {
                    html += `<div class="synthesis-block"><h4>📐 Cadre théorique</h4><p>${escapeHtml(theme.theoreticalFramework)}</p></div>`;
                }
                if (theme.keyPoints && theme.keyPoints.length > 0) {
                    html += `<div class="synthesis-block"><h4>📌 Points clés</h4><ul class="key-points">${theme.keyPoints.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul></div>`;
                }
                if (theme.methodologies && theme.methodologies.length > 0) {
                    html += `<div class="synthesis-block"><h4>🔬 Méthodologies identifiées</h4><div class="methodology-tags">${theme.methodologies.map(m => `<span class="source-tag">${escapeHtml(m)}</span>`).join('')}</div></div>`;
                }

                // Tables
                if (theme.tables && theme.tables.length > 0) {
                    html += '<div class="synthesis-block"><h4>📊 Tableaux</h4>';
                    for (const table of theme.tables) {
                        html += `<div class="data-table-wrapper">
                            <p class="table-title"><strong>${escapeHtml(table.title)}</strong></p>
                            <div class="markdown-table">${parseMarkdownTable(table.markdown)}</div>
                        </div>`;
                    }
                    html += '</div>';
                }

                // Figures
                if (theme.figures && theme.figures.length > 0) {
                    html += '<div class="synthesis-block"><h4>📈 Figures proposées</h4>';
                    for (const fig of theme.figures) {
                        html += `<div class="figure-card">
                            <span class="figure-type">${escapeHtml(fig.type || 'diagram')}</span>
                            <strong>${escapeHtml(fig.title)}</strong>
                            <p>${escapeHtml(fig.description)}</p>
                        </div>`;
                    }
                    html += '</div>';
                }

                // Statistics
                if (theme.statistics && theme.statistics.length > 0) {
                    html += '<div class="synthesis-block"><h4>📉 Statistiques clés</h4><div class="stats-row">';
                    for (const stat of theme.statistics) {
                        html += `<div class="stat-mini">
                            <span class="stat-mini-value">${escapeHtml(stat.value)}</span>
                            <span class="stat-mini-label">${escapeHtml(stat.metric)}</span>
                            ${stat.source ? `<span class="stat-mini-source">${escapeHtml(stat.source)}</span>` : ''}
                        </div>`;
                    }
                    html += '</div></div>';
                }

                // Comparative data
                if (theme.comparativeData) {
                    html += `<div class="synthesis-block"><h4>⚖️ Comparaison</h4><p>${escapeHtml(theme.comparativeData)}</p></div>`;
                }

                if (theme.reflectionPaths && theme.reflectionPaths.length > 0) {
                    html += `<div class="synthesis-block reflection-paths"><h4>💡 Pistes de réflexion</h4><ul class="key-points">${theme.reflectionPaths.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>`;
                }
                html += '</div>';
            }

            // Cross-theme analysis
            if (synthesis.crossAnalysis) {
                html += `<div class="synthesis-theme cross-analysis"><h3>🔗 Synthèse comparative inter-thèmes</h3><p>${escapeHtml(synthesis.crossAnalysis)}</p>`;
                if (synthesis.interconnections && synthesis.interconnections.length > 0) {
                    html += `<h4>Interconnexions</h4><ul class="key-points">${synthesis.interconnections.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
                }
                if (synthesis.tensions && synthesis.tensions.length > 0) {
                    html += `<h4>Tensions</h4><ul class="key-points">${synthesis.tensions.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
                }
                html += '</div>';
            }

            // Global summary
            if (synthesis.globalSummary) {
                html += `<div class="synthesis-theme global-summary"><h3>🌐 Résumé global</h3><div class="synthesis-text">${escapeHtml(synthesis.globalSummary)}</div></div>`;
            }

            // Overview tables
            if (synthesis.overviewTables) {
                const ot = synthesis.overviewTables;
                html += '<div class="synthesis-theme"><h3>📋 Tableaux récapitulatifs</h3>';
                if (ot.summaryTable) {
                    html += `<div class="data-table-wrapper"><p class="table-title"><strong>Synthèse par thème</strong></p><div class="markdown-table">${parseMarkdownTable(ot.summaryTable)}</div></div>`;
                }
                if (ot.methodologyTable) {
                    html += `<div class="data-table-wrapper"><p class="table-title"><strong>Comparaison méthodologique</strong></p><div class="markdown-table">${parseMarkdownTable(ot.methodologyTable)}</div></div>`;
                }
                if (ot.sourceMatrix) {
                    html += `<div class="data-table-wrapper"><p class="table-title"><strong>Matrice sources-thèmes</strong></p><div class="markdown-table">${parseMarkdownTable(ot.sourceMatrix)}</div></div>`;
                }
                html += '</div>';
            }

            // Gaps, contradictions, recommendations
            if (synthesis.gaps && synthesis.gaps.length > 0) {
                html += `<div class="synthesis-theme"><h3>🔎 Lacunes identifiées</h3><ul class="key-points">${synthesis.gaps.map(g => `<li>${escapeHtml(g)}</li>`).join('')}</ul></div>`;
            }
            if (synthesis.contradictions && synthesis.contradictions.length > 0) {
                html += `<div class="synthesis-theme"><h3>⚡ Contradictions</h3><ul class="key-points">${synthesis.contradictions.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul></div>`;
            }
            if (synthesis.recommendations && synthesis.recommendations.length > 0) {
                html += `<div class="synthesis-theme"><h3>🎯 Recommandations</h3><ul class="key-points">${synthesis.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>`;
            }

            // Future research + epistemic reflection
            if (synthesis.futureResearch) {
                html += `<div class="synthesis-theme"><h3>🚀 Programme de recherche future</h3><p>${escapeHtml(synthesis.futureResearch)}</p></div>`;
            }
            if (synthesis.epistemologicalReflection) {
                html += `<div class="synthesis-theme"><h3>🧠 Réflexion épistémologique</h3><p>${escapeHtml(synthesis.epistemologicalReflection)}</p></div>`;
            }

            html += '</div>';
        }

        container.innerHTML = html;
        document.getElementById('sectionCount').textContent = (structure.sections || []).length;

    } catch (err) {
        console.error('Load memoir error:', err);
    }
}

function toggleSection(header) {
    const body = header.nextElementSibling;
    const toggle = header.querySelector('.memoir-section-toggle');
    body.classList.toggle('open');
    toggle.classList.toggle('open');
}

// ============ PARSE MARKDOWN TABLE ============
function parseMarkdownTable(md) {
    if (!md) return '';
    const lines = md.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) return `<pre>${escapeHtml(md)}</pre>`;

    let html = '<table class="synthesis-table">';
    let isHeader = true;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.match(/^\|?\s*[-:]+\s*\|/)) continue; // skip separator rows

        const cells = line.split('|').filter((c, idx, arr) =>
            !(idx === 0 && c.trim() === '') && !(idx === arr.length - 1 && c.trim() === '')
        );

        if (cells.length === 0) continue;

        if (isHeader) {
            html += '<thead><tr>';
            cells.forEach(c => { html += `<th>${escapeHtml(c.trim())}</th>`; });
            html += '</tr></thead><tbody>';
            isHeader = false;
        } else {
            html += '<tr>';
            cells.forEach(c => { html += `<td>${escapeHtml(c.trim())}</td>`; });
            html += '</tr>';
        }
    }

    html += '</tbody></table>';
    return html;
}

// ============ HTML ESCAPE ============
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// ============ DOWNLOAD MEMOIR (PDF) ============
async function downloadMemoir(structure, synthesis) {
    if (!structure) { alert('Aucune structure disponible.'); return; }

    // Fetch sources for bibliography
    let sources = [];
    try {
        const pid = selectedProjectId;
        const url = pid ? `/api/sources?project=${pid}` : '/api/sources';
        const res = await apiGet(url);
        if (res.success) sources = res.data || [];
    } catch (e) { /* ignore */ }

    // Shared inline styles for PDF
    const ST = {
        p: 'font-size:13px;color:#333;margin-bottom:10px;text-align:justify;line-height:1.8;',
        h1: 'font-size:24px;color:#1a1a2e;margin:36px 0 12px;border-bottom:3px solid #8b7355;padding-bottom:8px;',
        h2: 'font-size:20px;color:#2c2c2c;margin:28px 0 10px;border-bottom:2px solid #8b7355;padding-bottom:6px;',
        h3: 'font-size:16px;color:#8b7355;margin:20px 0 8px;',
        h4: 'font-size:14px;color:#555;margin:14px 0 6px;font-weight:700;',
        li: 'font-size:13px;color:#333;margin-bottom:4px;line-height:1.6;',
        tbl: 'width:100%;border-collapse:collapse;margin:12px 0;font-size:12px;',
        th: 'background:#f0ebe0;padding:8px 10px;text-align:left;font-weight:700;border:1px solid #ccc;font-size:11px;',
        td: 'padding:6px 10px;border:1px solid #ddd;font-size:11px;',
        fig: 'background:#f8f6f0;border:1px solid #e0d8c8;border-radius:6px;padding:14px;margin:10px 0;text-align:center;',
        stat: 'display:inline-block;background:#f8f6f0;border:1px solid #e0d8c8;border-radius:6px;padding:10px 16px;margin:4px;text-align:center;min-width:100px;vertical-align:top;',
        sub: 'margin-left:20px;padding-left:14px;border-left:2px solid #ddd;margin-bottom:10px;',
        hr: 'border:none;border-top:1px solid #ddd;margin:28px 0;',
        pb: 'page-break-before:always;',
        tocLine: 'font-size:13px;color:#333;margin:4px 0;line-height:1.6;',
        tocSub: 'font-size:12px;color:#666;margin:2px 0 2px 24px;line-height:1.5;',
        bibEntry: 'font-size:11px;color:#333;margin-bottom:8px;line-height:1.5;padding-left:28px;text-indent:-28px;',
    };

    function pdfTbl(md) {
        if (!md) return '';
        const lines = md.split('\n').filter(l => l.trim());
        if (lines.length < 2) return `<pre style="font-size:11px;">${escapeHtml(md)}</pre>`;
        let h = `<table style="${ST.tbl}">`;
        let isH = true;
        for (const line of lines) {
            if (line.match(/^\|?\s*[-:]+\s*\|/)) continue;
            const cells = line.split('|').filter((c, i, a) => !(i === 0 && !c.trim()) && !(i === a.length - 1 && !c.trim()));
            if (!cells.length) continue;
            if (isH) {
                h += '<thead><tr>' + cells.map(c => `<th style="${ST.th}">${escapeHtml(c.trim())}</th>`).join('') + '</tr></thead><tbody>';
                isH = false;
            } else {
                h += '<tr>' + cells.map(c => `<td style="${ST.td}">${escapeHtml(c.trim())}</td>`).join('') + '</tr>';
            }
        }
        return h + '</tbody></table>';
    }

    // ===== Generate chart images from figure/stats data =====
    const chartImages = [];
    if (synthesis && synthesis.themes) {
        for (const theme of synthesis.themes) {
            // Generate a bar chart from statistics if available
            if (theme.statistics && theme.statistics.length > 0) {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 600;
                    canvas.height = 300;
                    document.body.appendChild(canvas);

                    const labels = theme.statistics.map(s => s.metric || 'N/A').slice(0, 8);
                    const values = theme.statistics.map(s => {
                        const v = parseFloat(String(s.value).replace(/[^0-9.,-]/g, '').replace(',', '.'));
                        return isNaN(v) ? 0 : v;
                    }).slice(0, 8);

                    const hasValidValues = values.some(v => v > 0);
                    if (hasValidValues) {
                        const chart = new Chart(canvas, {
                            type: 'bar',
                            data: {
                                labels,
                                datasets: [{
                                    label: theme.theme,
                                    data: values,
                                    backgroundColor: ['#8b7355', '#d4a053', '#a0522d', '#c19a6b', '#6b4226', '#deb887', '#cd853f', '#b8860b'],
                                    borderRadius: 4,
                                }]
                            },
                            options: {
                                responsive: false,
                                animation: false,
                                plugins: { legend: { display: false }, title: { display: true, text: theme.theme, font: { size: 14 } } },
                                scales: { y: { beginAtZero: true } }
                            }
                        });
                        await new Promise(r => setTimeout(r, 100));
                        chartImages.push({
                            theme: theme.theme,
                            dataUrl: canvas.toDataURL('image/png'),
                            caption: `Statistiques clés — ${theme.theme}`
                        });
                        chart.destroy();
                    }
                    document.body.removeChild(canvas);
                } catch (e) {
                    console.warn('Chart generation failed:', e);
                }
            }

            // Generate pie chart from figures if they have numeric data
            if (theme.figures && theme.figures.length >= 2) {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 500;
                    canvas.height = 300;
                    document.body.appendChild(canvas);

                    const figLabels = theme.figures.map(f => f.title || 'Figure').slice(0, 6);
                    const figValues = theme.figures.map((f, i) => i + 1).slice(0, 6);

                    const chart = new Chart(canvas, {
                        type: 'doughnut',
                        data: {
                            labels: figLabels,
                            datasets: [{
                                data: figValues,
                                backgroundColor: ['#8b7355', '#d4a053', '#a0522d', '#c19a6b', '#6b4226', '#deb887'],
                            }]
                        },
                        options: {
                            responsive: false,
                            animation: false,
                            plugins: {
                                title: { display: true, text: `Répartition — ${theme.theme}`, font: { size: 13 } },
                                legend: { position: 'right', labels: { font: { size: 10 } } }
                            }
                        }
                    });
                    await new Promise(r => setTimeout(r, 100));
                    chartImages.push({
                        theme: theme.theme,
                        dataUrl: canvas.toDataURL('image/png'),
                        caption: `Répartition des éléments — ${theme.theme}`
                    });
                    chart.destroy();
                    document.body.removeChild(canvas);
                } catch (e) {
                    console.warn('Pie chart generation failed:', e);
                }
            }
        }
    }

    let html = `<div style="font-family:'Palatino Linotype','Book Antiqua',Palatino,serif;color:#2c2c2c;line-height:1.7;max-width:800px;margin:0 auto;padding:40px;">`;

    // ===== TITLE PAGE =====
    html += `<div style="text-align:center;padding:100px 0 60px;">
        <h1 style="font-size:28px;color:#1a1a2e;margin-bottom:10px;">${escapeHtml(structure.refinedTitle || structure.title || 'Mémoire')}</h1>
        ${structure.problematic || structure.problemStatement ? `<p style="font-size:15px;color:#8b7355;font-style:italic;margin:16px 30px;">${escapeHtml(structure.problematic || structure.problemStatement)}</p>` : ''}
        <p style="font-size:12px;color:#888;margin-top:30px;">Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
        ${sources.length > 0 ? `<p style="font-size:12px;color:#888;">${sources.length} sources analysées</p>` : ''}
    </div>`;

    if (structure.methodology) html += `<p style="${ST.p}"><strong>Méthodologie :</strong> ${escapeHtml(structure.methodology)}</p>`;
    if (structure.estimatedPages) html += `<p style="${ST.p}"><strong>Pages estimées :</strong> ${structure.estimatedPages}</p>`;
    if (structure.keyContributions && structure.keyContributions.length > 0) {
        html += `<p style="${ST.p}"><strong>Contributions clés :</strong></p><ul>`;
        for (const c of structure.keyContributions) html += `<li style="${ST.li}">${escapeHtml(c)}</li>`;
        html += '</ul>';
    }

    // ===== SOMMAIRE (Table of Contents) =====
    if (structure.sections && structure.sections.length > 0) {
        html += `<div style="${ST.pb}"></div>`;
        html += `<h1 style="${ST.h1}">Sommaire</h1>`;
        html += `<div style="margin-bottom:20px;">`;

        // TOC entries for structure sections
        for (const section of structure.sections) {
            const pages = section.estimatedPages ? ` (≈${section.estimatedPages} p.)` : '';
            html += `<div style="${ST.tocLine}"><strong>${escapeHtml(String(section.number))}.</strong> ${escapeHtml(section.title)}${pages}</div>`;
            if (section.subsections) {
                for (const sub of section.subsections) {
                    html += `<div style="${ST.tocSub}">${escapeHtml(String(sub.number))} ${escapeHtml(sub.title)}</div>`;
                }
            }
        }

        // Meta-sections from synthesis
        if (synthesis && synthesis.themes && synthesis.themes.length > 0) {
            html += `<div style="margin-top:12px;border-top:1px solid #ddd;padding-top:8px;">`;
            html += `<div style="${ST.tocLine}"><strong>Synthèse académique complète</strong></div>`;
            for (const theme of synthesis.themes) {
                html += `<div style="${ST.tocSub}">— ${escapeHtml(theme.theme)}</div>`;
            }
            if (synthesis.crossAnalysis) html += `<div style="${ST.tocLine}"><strong>Synthèse comparative inter-thèmes</strong></div>`;
            if (synthesis.globalSummary) html += `<div style="${ST.tocLine}"><strong>Résumé global</strong></div>`;
            html += `<div style="${ST.tocLine}"><strong>Bibliographie</strong></div>`;
            html += `</div>`;
        }
        html += `</div>`;
    }

    html += `<hr style="${ST.hr}">`;

    // ===== STRUCTURE SECTION =====
    if (structure.sections) {
        html += `<div style="${ST.pb}"></div><h1 style="${ST.h1}">Plan du mémoire</h1>`;
        for (const section of structure.sections) {
            html += `<div style="margin-bottom:24px;page-break-inside:avoid;">
                <h2 style="${ST.h2}">${escapeHtml(String(section.number))}. ${escapeHtml(section.title)}</h2>
                <p style="${ST.p}">${escapeHtml(section.description)}</p>`;
            if (section.subsections) {
                for (const sub of section.subsections) {
                    html += `<div style="${ST.sub}"><h3 style="${ST.h3}">${escapeHtml(String(sub.number))} ${escapeHtml(sub.title)}</h3>
                        ${sub.description ? `<p style="${ST.p}">${escapeHtml(sub.description)}</p>` : ''}</div>`;
                }
            }
            html += '</div>';
        }
    }

    // ===== FULL SYNTHESIS =====
    if (synthesis && synthesis.themes && synthesis.themes.length > 0) {
        html += `<div style="${ST.pb}"></div><h1 style="${ST.h1}">Synthèse académique complète</h1>`;

        for (const theme of synthesis.themes) {
            html += `<div style="margin-bottom:30px;">
                <h2 style="${ST.h2}">${escapeHtml(theme.theme)}</h2>
                <p style="${ST.p}">${escapeHtml(theme.synthesis)}</p>`;

            if (theme.criticalAnalysis) html += `<h4 style="${ST.h4}">Analyse critique</h4><p style="${ST.p}">${escapeHtml(theme.criticalAnalysis)}</p>`;
            if (theme.theoreticalFramework) html += `<h4 style="${ST.h4}">Cadre théorique</h4><p style="${ST.p}">${escapeHtml(theme.theoreticalFramework)}</p>`;

            if (theme.keyPoints && theme.keyPoints.length > 0) {
                html += `<h4 style="${ST.h4}">Points clés</h4><ul>`;
                for (const pt of theme.keyPoints) html += `<li style="${ST.li}">${escapeHtml(pt)}</li>`;
                html += '</ul>';
            }
            if (theme.methodologies && theme.methodologies.length > 0) {
                html += `<h4 style="${ST.h4}">Méthodologies</h4><p style="${ST.p}">${theme.methodologies.map(m => escapeHtml(m)).join(' • ')}</p>`;
            }

            // TABLES
            if (theme.tables && theme.tables.length > 0) {
                html += `<h4 style="${ST.h4}">Tableaux</h4>`;
                for (const t of theme.tables) {
                    html += `<p style="font-size:12px;font-weight:700;color:#555;margin:8px 0 4px;">${escapeHtml(t.title)}</p>`;
                    html += pdfTbl(t.markdown);
                }
            }

            // CHART IMAGES (from Chart.js)
            const themeCharts = chartImages.filter(c => c.theme === theme.theme);
            if (themeCharts.length > 0) {
                html += `<h4 style="${ST.h4}">Figures et graphiques</h4>`;
                for (const chart of themeCharts) {
                    html += `<div style="${ST.fig}">
                        <img src="${chart.dataUrl}" style="max-width:100%;height:auto;margin:0 auto;display:block;" alt="${escapeHtml(chart.caption)}" />
                        <p style="font-size:11px;color:#666;margin:8px 0 0;font-style:italic;">${escapeHtml(chart.caption)}</p>
                    </div>`;
                }
            }

            // TEXT-ONLY FIGURES (descriptions)
            if (theme.figures && theme.figures.length > 0) {
                const noChartFigures = themeCharts.length === 0;
                if (noChartFigures) html += `<h4 style="${ST.h4}">Figures</h4>`;
                for (const f of theme.figures) {
                    html += `<div style="${ST.fig}">
                        <p style="font-size:10px;color:#8b7355;text-transform:uppercase;margin:0 0 4px;font-weight:700;">${escapeHtml(f.type || 'figure')}</p>
                        <p style="font-weight:700;font-size:13px;margin:0 0 6px;">${escapeHtml(f.title)}</p>
                        <p style="font-size:12px;color:#555;margin:0;line-height:1.5;">${escapeHtml(f.description)}</p>
                    </div>`;
                }
            }

            // STATISTICS
            if (theme.statistics && theme.statistics.length > 0) {
                html += `<h4 style="${ST.h4}">Statistiques clés</h4><div>`;
                for (const s of theme.statistics) {
                    html += `<div style="${ST.stat}">
                        <div style="font-size:20px;font-weight:700;color:#8b7355;">${escapeHtml(s.value)}</div>
                        <div style="font-size:11px;color:#666;">${escapeHtml(s.metric)}</div>
                        ${s.source ? `<div style="font-size:10px;color:#999;font-style:italic;margin-top:2px;">${escapeHtml(s.source)}</div>` : ''}
                    </div>`;
                }
                html += '</div><div style="clear:both;"></div>';
            }

            // COMPARATIVE DATA
            if (theme.comparativeData) html += `<h4 style="${ST.h4}">Données comparatives</h4><p style="${ST.p}">${escapeHtml(theme.comparativeData)}</p>`;

            // REFLECTION PATHS
            if (theme.reflectionPaths && theme.reflectionPaths.length > 0) {
                html += `<h4 style="${ST.h4}">Pistes de réflexion</h4><ul>`;
                for (const r of theme.reflectionPaths) html += `<li style="${ST.li}">${escapeHtml(r)}</li>`;
                html += '</ul>';
            }

            html += '</div>';
        }

        // CROSS-ANALYSIS
        if (synthesis.crossAnalysis) {
            html += `<div style="${ST.pb}"></div><h1 style="${ST.h1}">Synthèse comparative inter-thèmes</h1>`;
            html += `<p style="${ST.p}">${escapeHtml(synthesis.crossAnalysis)}</p>`;
            if (synthesis.interconnections && synthesis.interconnections.length > 0) {
                html += `<h4 style="${ST.h4}">Interconnexions</h4><ul>`;
                for (const i of synthesis.interconnections) html += `<li style="${ST.li}">${escapeHtml(i)}</li>`;
                html += '</ul>';
            }
            if (synthesis.tensions && synthesis.tensions.length > 0) {
                html += `<h4 style="${ST.h4}">Tensions</h4><ul>`;
                for (const t of synthesis.tensions) html += `<li style="${ST.li}">${escapeHtml(t)}</li>`;
                html += '</ul>';
            }
        }

        // GLOBAL SUMMARY
        if (synthesis.globalSummary) {
            html += `<div style="${ST.pb}"></div><div style="background:#f8f6f0;padding:20px;border-radius:8px;border-left:4px solid #8b7355;">
                <h2 style="${ST.h2};border:none;margin-top:0;">Résumé global</h2>
                <p style="${ST.p}">${escapeHtml(synthesis.globalSummary)}</p></div>`;
        }

        // OVERVIEW TABLES
        if (synthesis.overviewTables) {
            const ot = synthesis.overviewTables;
            html += `<div style="${ST.pb}"></div><h1 style="${ST.h1}">Tableaux récapitulatifs</h1>`;
            if (ot.summaryTable) { html += `<h4 style="${ST.h4}">Synthèse par thème</h4>` + pdfTbl(ot.summaryTable); }
            if (ot.methodologyTable) { html += `<h4 style="${ST.h4}">Comparaison méthodologique</h4>` + pdfTbl(ot.methodologyTable); }
            if (ot.sourceMatrix) { html += `<h4 style="${ST.h4}">Matrice sources-thèmes</h4>` + pdfTbl(ot.sourceMatrix); }
        }

        // GAPS / CONTRADICTIONS / RECOMMENDATIONS
        if (synthesis.gaps && synthesis.gaps.length > 0) {
            html += `<h2 style="${ST.h2}">Lacunes identifiées</h2><ul>`;
            for (const g of synthesis.gaps) html += `<li style="${ST.li}">${escapeHtml(g)}</li>`;
            html += '</ul>';
        }
        if (synthesis.contradictions && synthesis.contradictions.length > 0) {
            html += `<h2 style="${ST.h2}">Contradictions</h2><ul>`;
            for (const c of synthesis.contradictions) html += `<li style="${ST.li}">${escapeHtml(c)}</li>`;
            html += '</ul>';
        }
        if (synthesis.recommendations && synthesis.recommendations.length > 0) {
            html += `<h2 style="${ST.h2}">Recommandations</h2><ul>`;
            for (const r of synthesis.recommendations) html += `<li style="${ST.li}">${escapeHtml(r)}</li>`;
            html += '</ul>';
        }

        // FUTURE RESEARCH + EPISTEMIC
        if (synthesis.futureResearch) html += `<h2 style="${ST.h2}">Programme de recherche future</h2><p style="${ST.p}">${escapeHtml(synthesis.futureResearch)}</p>`;
        if (synthesis.epistemologicalReflection) html += `<h2 style="${ST.h2}">Réflexion épistémologique</h2><p style="${ST.p}">${escapeHtml(synthesis.epistemologicalReflection)}</p>`;
    }

    // ===== BIBLIOGRAPHY =====
    if (sources.length > 0) {
        html += `<div style="${ST.pb}"></div><h1 style="${ST.h1}">Bibliographie</h1>`;
        html += `<p style="font-size:12px;color:#666;margin-bottom:16px;">${sources.length} sources référencées</p>`;

        // Sort sources alphabetically by title
        const sortedSources = [...sources].sort((a, b) => (a.title || '').localeCompare(b.title || ''));

        for (let i = 0; i < sortedSources.length; i++) {
            const s = sortedSources[i];
            const date = s.addedAt ? new Date(s.addedAt).getFullYear() : 'n.d.';
            const urlPart = s.url ? ` Disponible sur : <span style="color:#8b7355;">${escapeHtml(s.url)}</span>` : '';
            const typePart = s.type === 'deep-scraped' ? 'Source web analysée' : s.type === 'manual' ? 'Source manuelle' : 'Source web';

            html += `<div style="${ST.bibEntry}">
                [${i + 1}] ${escapeHtml(s.title)} (${date}). <em>${typePart}.</em>${urlPart}
                ${s.relevanceScore ? ` [Pertinence : ${s.relevanceScore}/100]` : ''}
            </div>`;
        }
    }

    html += '</div>';

    // Open in new window for print-to-PDF (100% reliable)
    const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Mémoire — ${escapeHtml(structure.title || 'Export')}</title>
<style>
  @media print {
    body { margin: 0; }
    @page { margin: 15mm; size: A4; }
    .no-print { display: none !important; }
  }
  body { background: #fff; margin: 0; padding: 0; }
</style>
</head>
<body>
<div class="no-print" style="background:#8b7355;color:#fff;padding:12px 24px;font-family:sans-serif;display:flex;align-items:center;justify-content:space-between;">
  <span>📄 Aperçu du mémoire — Utilisez <b>Ctrl+P</b> → <b>Enregistrer en PDF</b></span>
  <button onclick="window.print()" style="background:#fff;color:#8b7355;border:none;padding:8px 20px;border-radius:6px;font-weight:700;cursor:pointer;font-size:14px;">Imprimer / PDF</button>
</div>
${html}
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(fullHtml);
        printWindow.document.close();
        // Auto-trigger print after content loads
        printWindow.onload = () => {
            setTimeout(() => printWindow.print(), 500);
        };
    } else {
        // Popup blocked — fallback: download as HTML file
        const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `memoire_${new Date().toISOString().slice(0, 10)}.html`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
