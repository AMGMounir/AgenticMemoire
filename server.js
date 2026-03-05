require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const { OAuth2Client } = require('google-auth-library');
const multer = require('multer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16'
});

const { parseMindmap } = require('./utils/mindmapParser');
const { SourceStore } = require('./utils/sourceStore');
const { UserStore } = require('./utils/userStore');
const { Orchestrator } = require('./agents/orchestrator');
const { callLLM } = require('./utils/apiClient');

const app = express();
const PORT = process.env.PORT || 3000;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads', 'avatars');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer config for avatar uploads
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `${req.session.userId}_${Date.now()}${ext}`);
    }
});
const avatarUpload = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype.split('/')[1]);
        cb(null, !!ok);
    }
});

// Middleware
app.use(cors());
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        if (req.originalUrl.startsWith('/api/webhooks/stripe')) {
            req.rawBody = buf.toString();
        }
    }
}));
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

// Data stores
const sourceStore = new SourceStore();
const userStore = new UserStore();
const orchestrator = new Orchestrator();

// ============ AUTH API ============

// Google Sign-In
app.post('/api/auth/google', async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) return res.status(400).json({ error: 'Missing credential' });

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();

        let user = userStore.findByGoogleId(payload.sub);
        if (!user) {
            user = userStore.createFromGoogle(payload);
        }

        req.session.userId = user.id;
        res.json({ success: true, data: userStore.sanitize(user) });
    } catch (err) {
        console.error('Google auth error:', err.message);
        res.status(401).json({ error: 'Identifiant Google invalide' });
    }
});

// Email/Password Registration
app.post('/api/auth/register', (req, res) => {
    try {
        const { email, username, password } = req.body;
        if (!email || !username || !password) {
            return res.status(400).json({ error: 'Email, nom d\'utilisateur et mot de passe requis' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères' });
        }

        const user = userStore.createWithEmail(email, username, password);
        req.session.userId = user.id;
        res.json({ success: true, data: userStore.sanitize(user) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Email/Password Login
app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        const user = userStore.verifyPassword(email, password);
        if (!user) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        req.session.userId = user.id;
        res.json({ success: true, data: userStore.sanitize(user) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Current user
app.get('/api/auth/me', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = userStore.findById(req.session.userId);
    if (!user) {
        req.session.destroy();
        return res.status(401).json({ error: 'User not found' });
    }
    res.json({ success: true, data: userStore.sanitize(user) });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// Update profile
app.put('/api/auth/profile', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const user = userStore.updateProfile(req.session.userId, req.body);
        res.json({ success: true, data: userStore.sanitize(user) });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Avatar upload
app.post('/api/auth/avatar', avatarUpload.single('avatar'), (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier envoyé' });

    try {
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        const user = userStore.updateProfile(req.session.userId, { profilePicture: avatarUrl });
        res.json({ success: true, data: userStore.sanitize(user), avatarUrl });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete account
app.delete('/api/auth/account', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    try {
        userStore.deleteUser(req.session.userId);
        req.session.destroy(() => {
            res.json({ success: true });
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Auth config
app.get('/api/auth/config', (req, res) => {
    res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// ============ MINDMAP API ============

app.post('/api/mindmap/parse', (req, res) => {
    try {
        const { mindmapText } = req.body;
        if (!mindmapText) return res.status(400).json({ error: 'mindmapText is required' });
        const parsed = parseMindmap(mindmapText);
        res.json({ success: true, data: parsed });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/mindmap/generate', async (req, res) => {
    try {
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: 'title is required' });

        const hasKey = !!process.env.GEMINI_API_KEY;
        let mindmapText;

        if (hasKey) {
            const content = await callLLM({
                label: 'Mindmap generation',
                maxTokens: 2500,
                temperature: 0.75,
                maxRetries: 5,
                messages: [
                    {
                        role: 'system', content: `Tu es un expert en structuration de mémoires académiques. Tu génères des mindmaps Mermaid.js SPÉCIFIQUES au sujet donné.

RÈGLES ABSOLUES:
- Réponds UNIQUEMENT avec le code mermaid, sans aucun texte avant ou après.
- Les branches doivent être SPÉCIFIQUES au sujet, PAS des catégories académiques génériques.
- INTERDIT d'utiliser ces branches génériques: "Contexte", "État de l'art", "Méthodologie", "Résultats", "Perspectives", "Introduction", "Conclusion", "Analyse", "Discussion".
- Chaque branche doit refléter un THÈME ou CONCEPT concret et unique du sujet.
- Utilise des termes techniques et précis du domaine.` },
                    {
                        role: 'user', content: `Génère une mindmap Mermaid.js pour un mémoire de Master 2 sur: "${title}".

EXIGENCES:
- 5 à 7 branches principales, chacune représentant un THÈME SPÉCIFIQUE du sujet (pas une section académique).
- Chaque branche doit avoir 3 à 4 sous-branches détaillées avec des concepts concrets.
- Les sous-branches peuvent elles-mêmes avoir 1-2 sous-sous-branches si pertinent.
- Utilise la terminologie technique du domaine "${title}".

EXEMPLE pour "Intelligence Artificielle en Médecine":
mindmap
  root((IA en Médecine))
    Diagnostic assisté par IA
      Imagerie médicale et deep learning
      Détection précoce de cancers
      Analyse de radiographies
    Traitement du langage naturel clinique
      Extraction de données des dossiers patients
      Résumé automatique de comptes rendus
      Codification médicale automatisée
    Robots chirurgicaux intelligents
      Chirurgie mini-invasive assistée
      Planification opératoire 3D
      Retour haptique et précision
    Médecine personnalisée
      Génomique et pharmacogénétique
      Modèles prédictifs de traitement
      Biomarqueurs et apprentissage
    Éthique et régulation de l'IA médicale
      Biais algorithmiques en santé
      Responsabilité juridique
      Consentement éclairé et transparence

Maintenant génère pour: "${title}"
Réponds UNIQUEMENT avec le code mermaid.` }
                ]
            });

            mindmapText = content.replace(/```mermaid\s*/gi, '').replace(/```\s*/g, '').trim();
        } else {
            mindmapText = `mindmap\n  root((${title}))\n    Contexte et enjeux\n      Définitions clés\n      Historique\n      Problématiques actuelles\n    État de l'art\n      Approches théoriques\n      Solutions existantes\n      Analyse comparative\n    Méthodologie\n      Collecte de données\n      Outils et frameworks\n      Protocole expérimental\n    Résultats et analyse\n      Résultats quantitatifs\n      Analyse qualitative\n      Discussion\n    Perspectives\n      Limites identifiées\n      Améliorations possibles\n      Travaux futurs`;
        }

        res.json({ success: true, data: mindmapText });
    } catch (err) {
        console.error('Mindmap generation error:', err.message);
        // Return the error to the user instead of hiding it behind a generic fallback
        const isRateLimit = err.message && err.message.includes('429');
        if (isRateLimit) {
            res.status(429).json({
                error: 'Limite de requêtes API atteinte. Veuillez attendre 1-2 minutes avant de réessayer.',
                rateLimited: true
            });
        } else {
            const { title } = req.body;
            const fallback = `mindmap\n  root((${title}))\n    Contexte\n      Définitions\n      Historique\n    État de l'art\n      Approches\n      Comparaison\n    Méthodologie\n      Outils\n      Protocole\n    Résultats\n      Analyse\n    Perspectives\n      Limites\n      Travaux futurs`;
            res.json({ success: true, data: fallback });
        }
    }
});

// ============ SOURCES API ============

app.get('/api/sources', (req, res) => {
    const projectId = req.query.project;
    if (projectId) {
        res.json({ success: true, data: sourceStore.getByProject(projectId) });
    } else {
        res.json({ success: true, data: sourceStore.getAll() });
    }
});

app.post('/api/sources', (req, res) => {
    try {
        const source = sourceStore.add(req.body, req.body.projectId || null);
        res.json({ success: true, data: source });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/sources/:id', (req, res) => {
    try {
        sourceStore.remove(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// ============ PROJECTS API ============

app.get('/api/projects', (req, res) => {
    res.json({ success: true, data: sourceStore.getProjects() });
});

app.delete('/api/projects/:id', (req, res) => {
    try {
        sourceStore.removeProject(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// ============ AGENTS API — ITERATIVE ============

app.get('/api/agents/status', (req, res) => {
    res.json({ success: true, data: orchestrator.getStatus() });
});

// Stop all agents
app.post('/api/agents/stop', (req, res) => {
    orchestrator.stop();
    res.json({ success: true, message: 'Process stopped' });
});

app.post('/api/agents/research', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Vous devez être connecté pour lancer une recherche.' });
        }

        const { mindmapText, threshold, depth } = req.body;
        if (!mindmapText) return res.status(400).json({ error: 'mindmapText is required' });

        const user = userStore.findById(req.session.userId);
        if (!user) return res.status(401).json({ error: 'Utilisateur introuvable.' });

        const numericDepth = parseInt(depth) || 4;
        let cost = 0;
        if (numericDepth <= 2) {
            cost = 5;
        } else if (numericDepth <= 4) {
            cost = 15;
        } else {
            // Depth 6+ or 8+
            if (!user.is_premium) {
                return res.status(403).json({ error: 'La recherche approfondie nécessite l\'abonnement Premium.' });
            }
            cost = numericDepth === 6 ? 25 : 35;
        }

        if (user.credits < cost) {
            return res.status(402).json({ error: `Crédits insuffisants. Il vous faut ${cost} crédits.` });
        }

        // Deduct credits
        userStore.deductCredits(req.session.userId, cost);
        userStore.addTransaction(req.session.userId, 'usage', 0, -cost, `Recherche approfondie (Profondeur: ${depth})`);

        const apiKey = process.env.GEMINI_API_KEY || '';
        const mindmapData = parseMindmap(mindmapText);

        // Derive projectId from mindmap root label
        const projectTitle = mindmapData.label || 'Untitled';
        const projectId = SourceStore.slugify(projectTitle);
        sourceStore.ensureProject(projectId, projectTitle);
        sourceStore.clearProject(projectId); // fresh research
        sourceStore.setMindmapData(projectId, mindmapData);

        const settings = {
            relevanceThreshold: parseInt(threshold) || 30,
            queriesPerNode: parseInt(depth) || 4
        };

        orchestrator.runResearch(mindmapData, sourceStore, apiKey, settings, projectId);

        res.json({
            success: true,
            message: 'Research started',
            projectId,
            data: orchestrator.getStatus(),
            user: userStore.sanitize(userStore.findById(req.session.userId))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Step 2: Launch SYNTHESIS + STRUCTURE (for a specific project)
app.post('/api/agents/synthesize', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY || '';
        const { projectId } = req.body;

        // Load mindmap from project storage (survives server restarts)
        let mindmapData = orchestrator.mindmapData;
        if (projectId) {
            const proj = sourceStore.getProject(projectId);
            if (proj && proj.mindmapData) {
                mindmapData = proj.mindmapData;
            }
            // Fallback: generate minimal mindmap from project title and sources
            if (!mindmapData && proj) {
                const sources = sourceStore.getByProject(projectId);
                const relatedNodes = [...new Set(sources.flatMap(s => s.relatedNodes || []))];
                mindmapData = {
                    label: proj.title,
                    children: relatedNodes.length > 0
                        ? relatedNodes.map(n => ({ label: n, children: [] }))
                        : [{ label: proj.title, children: [] }]
                };
                sourceStore.setMindmapData(projectId, mindmapData);
            }
        }

        if (!mindmapData) {
            return res.status(400).json({ error: 'Aucune mindmap chargée. Lancez d\'abord une recherche ou sélectionnez un projet.' });
        }

        // Deduct credits for synthesis
        const user = userStore.findById(req.session.userId);
        if (!user) return res.status(401).json({ error: 'Utilisateur introuvable.' });

        const cost = 10;
        if (user.credits < cost) {
            return res.status(402).json({ error: `Crédits insuffisants. Il vous faut ${cost} crédits.` });
        }
        userStore.deductCredits(req.session.userId, cost);
        userStore.addTransaction(req.session.userId, 'usage', 0, -cost, 'Synthèse de documents générée');

        orchestrator.mindmapData = mindmapData;
        orchestrator.runSynthesis(sourceStore, apiKey, projectId);

        res.json({
            success: true,
            message: 'Synthesis started',
            data: orchestrator.getStatus(),
            user: userStore.sanitize(userStore.findById(req.session.userId))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Legacy endpoint for backward compat
app.post('/api/agents/run', async (req, res) => {
    try {
        const { mindmapText } = req.body;
        if (!mindmapText) return res.status(400).json({ error: 'mindmapText is required' });

        const apiKey = process.env.GEMINI_API_KEY || '';
        const mindmapData = parseMindmap(mindmapText);
        orchestrator.runResearch(mindmapData, sourceStore, apiKey);

        res.json({ success: true, message: 'Research started', data: orchestrator.getStatus() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/memoir', (req, res) => {
    res.json({ success: true, data: orchestrator.getMemoir() });
});

app.get('/api/memoir/:projectId', (req, res) => {
    const memoirData = sourceStore.getMemoirData(req.params.projectId);
    if (memoirData) {
        res.json({ success: true, data: memoirData });
    } else {
        // Fallback to orchestrator's current memoir
        res.json({ success: true, data: orchestrator.getMemoir() });
    }
});

// ============ BILLING API ============

// Helper to get or create a Stripe Customer
async function getOrCreateStripeCustomer(userId) {
    const user = userStore.findById(userId);
    if (!user) throw new Error("Utilisateur introuvable");

    if (user.stripe_customer_id) {
        return user.stripe_customer_id;
    }

    const customer = await stripe.customers.create({
        email: user.email,
        name: user.username,
        metadata: { userId: user.id }
    });

    userStore.setStripeCustomerId(userId, customer.id);
    return customer.id;
}


app.post('/api/billing/buy-credits', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Non authentifié' });
        const { packageId, saveCard } = req.body; // 'small' or 'large'

        let amountInCents = 0;
        let credits = 0;
        if (packageId === 'small') { amountInCents = 99; credits = 100; }
        else if (packageId === 'large') { amountInCents = 399; credits = 500; }
        else return res.status(400).json({ error: 'Forfait invalide' });

        const customerId = await getOrCreateStripeCustomer(req.session.userId);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'usd',
            customer: customerId,
            setup_future_usage: saveCard ? 'off_session' : undefined,
            metadata: {
                type: 'credits',
                credits: credits.toString(),
                packageId,
                userId: req.session.userId
            }
        });

        res.json({ success: true, clientSecret: paymentIntent.client_secret });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/billing/subscribe-premium', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Non authentifié' });

        const customerId = await getOrCreateStripeCustomer(req.session.userId);

        // We need a Price ID for subscriptions. We'll use a dynamic price for simplicity,
        // but normally you create a Product/Price in Stripe Dashboard and hardcode the Price ID.
        // For testing, creating inline:
        const product = await stripe.products.create({ name: 'Forfait Premium ProjetBreda' });
        const price = await stripe.prices.create({
            product: product.id,
            unit_amount: 299,
            currency: 'usd',
            recurring: { interval: 'month' },
        });

        // Create the subscription. Note: we set payment_behavior to 'default_incomplete'
        // so it returns a PaymentIntent client_secret to collect the card.
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: price.id }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
            metadata: { type: 'premium', userId: req.session.userId }
        });

        // Safeguard to reliably get the PaymentIntent client_secret
        let paymentIntent = null;
        let latestInvoice = subscription.latest_invoice;

        console.log(`[Stripe Debug] Subscription created:`, subscription.id, 'Status:', subscription.status);

        if (typeof latestInvoice === 'string') {
            console.log(`[Stripe Debug] latest_invoice is a string ID:`, latestInvoice);
            try {
                latestInvoice = await stripe.invoices.retrieve(latestInvoice);
                console.log(`[Stripe Debug] Retrieved invoice total:`, latestInvoice.total, 'amount_due:', latestInvoice.amount_due, 'payment_intent:', latestInvoice.payment_intent);
            } catch (err) {
                console.log(`[Stripe Debug] Error retrieving invoice:`, err.message);
            }
        } else if (latestInvoice) {
            console.log(`[Stripe Debug] latest_invoice is an object. payment_intent:`, latestInvoice.payment_intent);
        } else {
            console.log(`[Stripe Debug] latest_invoice is null or undefined!`);
        }

        if (latestInvoice && latestInvoice.payment_intent) {
            if (typeof latestInvoice.payment_intent === 'string') {
                paymentIntent = await stripe.paymentIntents.retrieve(latestInvoice.payment_intent);
            } else {
                paymentIntent = latestInvoice.payment_intent;
            }
        }

        if (!paymentIntent || !paymentIntent.client_secret) {
            if (subscription.status === 'active') {
                return res.json({
                    success: true,
                    subscriptionId: subscription.id,
                    status: 'active'
                });
            }
            throw new Error('Impossible de générer le PaymentIntent pour cet abonnement.');
        }

        res.json({
            success: true,
            subscriptionId: subscription.id,
            clientSecret: paymentIntent.client_secret,
            status: subscription.status
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/billing/cancel-premium', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Non authentifié' });

        const userId = req.session.userId;
        const user = userStore.findById(userId);

        if (!user || (!user.is_premium && user.subscription_status !== 'active')) {
            return res.status(400).json({ error: "Vous n'êtes pas abonné au Premium." });
        }

        if (user.stripe_customer_id) {
            // Find the active subscription for this customer
            const subscriptions = await stripe.subscriptions.list({
                customer: user.stripe_customer_id,
                status: 'active',
                limit: 1
            });

            if (subscriptions.data.length > 0) {
                const subId = subscriptions.data[0].id;
                // Set to cancel at period end so they don't lose time they paid for
                await stripe.subscriptions.update(subId, {
                    cancel_at_period_end: true
                });
            }
        }

        // Update local database to 'canceling' (or false if premium_until applies soon)
        const updatedUser = userStore.cancelPremium(userId);
        res.json({ success: true, message: 'Forfait Premium annulé. Vous conservez vos avantages jusqu\'à la fin de la période.', data: userStore.sanitize(updatedUser) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/billing/confirm-subscription', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Non authentifié' });

        const { subscriptionId } = req.body;
        if (!subscriptionId) return res.status(400).json({ error: 'Subscription ID is required' });

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Verify it belongs to the user and is active
        if (subscription.metadata.userId !== req.session.userId) {
            return res.status(403).json({ error: 'Non autorisé' });
        }

        if (subscription.status === 'active') {
            const user = userStore.findById(req.session.userId);
            // Only update if not already premium to prevent duplicate transactions
            if (!user.is_premium) {
                userStore.setPremium(req.session.userId, true);
                // Fetch the latest invoice to get receipt URL
                let receiptUrl = null;
                try {
                    const invoices = await stripe.invoices.list({ subscription: subscriptionId, limit: 1 });
                    if (invoices.data.length > 0 && invoices.data[0].invoice_pdf) {
                        receiptUrl = invoices.data[0].invoice_pdf;
                    }
                } catch (e) { /* ignore */ }
                userStore.addTransaction(req.session.userId, 'subscription', 2.99, 0, 'Abonnement Premium (Stripe)', receiptUrl);
            }
            return res.json({ success: true, data: userStore.sanitize(userStore.findById(req.session.userId)) });
        } else {
            return res.status(400).json({ error: 'Paiement non finalisé' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Synchronously confirm credit purchase and store receipt
app.post('/api/billing/confirm-credits', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Non authentifié' });

        const { paymentIntentId } = req.body;
        if (!paymentIntentId) return res.status(400).json({ error: 'PaymentIntent ID manquant' });

        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (pi.metadata.userId !== req.session.userId) {
            return res.status(403).json({ error: 'Non autorisé' });
        }

        if (pi.status === 'succeeded' && pi.metadata.type === 'credits') {
            const credits = parseInt(pi.metadata.credits, 10);
            const amountInDollars = pi.amount_received / 100;

            // Get receipt URL from the charge
            let receiptUrl = null;
            if (pi.latest_charge) {
                try {
                    const charge = await stripe.charges.retrieve(pi.latest_charge);
                    receiptUrl = charge.receipt_url || null;
                } catch (e) { /* ignore */ }
            }

            userStore.addCredits(req.session.userId, credits);
            userStore.addTransaction(req.session.userId, 'purchase', amountInDollars, credits, `Achat de ${credits} crédits`, receiptUrl);

            return res.json({ success: true, data: userStore.sanitize(userStore.findById(req.session.userId)) });
        } else {
            return res.status(400).json({ error: 'Paiement non finalisé' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/billing/stripe-payment-methods', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Non authentifié' });

        const user = userStore.findById(req.session.userId);
        if (!user || !user.stripe_customer_id) {
            return res.json({ success: true, data: [] });
        }

        const paymentMethods = await stripe.paymentMethods.list({
            customer: user.stripe_customer_id,
            type: 'card',
        });

        // Deduplicate cards by fingerprint (same physical card saved multiple times)
        const seen = new Set();
        const cards = [];
        for (const pm of paymentMethods.data) {
            const fingerprint = pm.card.fingerprint;
            if (!seen.has(fingerprint)) {
                seen.add(fingerprint);
                cards.push({
                    id: pm.id,
                    brand: pm.card.brand,
                    last4: pm.card.last4,
                    exp_month: pm.card.exp_month,
                    exp_year: pm.card.exp_year,
                });
            }
        }

        res.json({ success: true, data: cards });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a Stripe payment method (and all duplicates of the same card)
app.delete('/api/billing/stripe-payment-methods/:pmId', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Non authentifié' });

        const { pmId } = req.params;
        const user = userStore.findById(req.session.userId);

        // Retrieve the target payment method to get its fingerprint
        const pm = await stripe.paymentMethods.retrieve(pmId);
        if (pm.customer !== user.stripe_customer_id) {
            return res.status(403).json({ error: 'Non autorisé' });
        }

        const fingerprint = pm.card.fingerprint;

        // Find ALL payment methods with the same fingerprint and detach them all
        const allMethods = await stripe.paymentMethods.list({
            customer: user.stripe_customer_id,
            type: 'card',
        });

        const toDetach = allMethods.data.filter(m => m.card.fingerprint === fingerprint);
        await Promise.all(toDetach.map(m => stripe.paymentMethods.detach(m.id)));

        res.json({ success: true, message: `Carte supprimée (${toDetach.length} entrée(s)).` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch real Stripe invoices for the user
app.get('/api/billing/invoices', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Non authentifié' });

        const user = userStore.findById(req.session.userId);
        if (!user || !user.stripe_customer_id) {
            return res.json({ success: true, data: [] });
        }

        const invoices = await stripe.invoices.list({
            customer: user.stripe_customer_id,
            limit: 20,
        });

        const data = invoices.data.map(inv => ({
            id: inv.id,
            number: inv.number,
            amount: inv.amount_paid / 100,
            currency: inv.currency,
            status: inv.status,
            description: inv.lines.data.map(l => l.description).join(', '),
            created: new Date(inv.created * 1000).toISOString(),
            invoice_pdf: inv.invoice_pdf,
            hosted_invoice_url: inv.hosted_invoice_url,
        }));

        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/billing/customer-portal', async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Non authentifié' });

        const customerId = await getOrCreateStripeCustomer(req.session.userId);

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `http://localhost:${PORT}/`,
        });

        res.json({ success: true, url: session.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/billing/payment-method', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Non authentifié' });

        const user = userStore.updatePaymentMethod(req.session.userId, true);
        res.json({ success: true, message: 'Moyen de paiement enregistré.', data: userStore.sanitize(user) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/billing/history', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Non authentifié' });

        const transactions = userStore.getTransactionsByUserId(req.session.userId);
        res.json({ success: true, data: transactions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/billing/payment-method', (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ error: 'Non authentifié' });

        const user = userStore.updatePaymentMethod(req.session.userId, false);
        res.json({ success: true, message: 'Moyen de paiement supprimé.', data: userStore.sanitize(user) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============ STRIPE WEBHOOKS ============

app.post('/api/webhooks/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Stripe requires the raw body to verify the signature
        event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`⚠️  Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        // Handle the event
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            const metadata = paymentIntent.metadata || {};
            const userId = metadata.userId;

            if (userId && metadata.type === 'credits') {
                const credits = parseInt(metadata.credits, 10);
                const amountInDollars = paymentIntent.amount_received / 100;

                // Get receipt URL from the charge
                let receiptUrl = null;
                if (paymentIntent.latest_charge) {
                    try {
                        const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
                        receiptUrl = charge.receipt_url || null;
                    } catch (e) { /* ignore */ }
                }

                userStore.addCredits(userId, credits);
                userStore.addTransaction(userId, 'purchase', amountInDollars, credits, `Achat de ${credits} crédits`, receiptUrl);
            }
        } else if (event.type === 'invoice.payment_succeeded') {
            const invoice = event.data.object;
            // Subscription invoices have the subscription ID
            if (invoice.subscription) {
                const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
                const metadata = subscription.metadata || {};
                const userId = metadata.userId;

                if (userId && metadata.type === 'premium') {
                    userStore.setPremium(userId, true);
                    const amountInDollars = invoice.amount_paid / 100;
                    userStore.addTransaction(userId, 'subscription', amountInDollars, 0, 'Abonnement Premium (Stripe)');
                }
            }
        }
    } catch (err) {
        console.error('Erreur de traitement du webhook Stripe:', err);
    }

    res.json({ received: true });
});

// ============ SERVE FRONTEND ============
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    const hasGoogleId = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE';
    console.log(`\n  🎓 Memoir Assistant Server running at http://localhost:${PORT}`);
    console.log(`  🔑 Gemini API Key: ${hasKey ? '✓ Detected' : '✗ Not set (demo mode) — add GEMINI_API_KEY to .env'}`);
    console.log(`  🔐 Google OAuth: ${hasGoogleId ? '✓ Configured' : '✗ Not set — add GOOGLE_CLIENT_ID to .env'}`);
    console.log(`     Edit .env file to configure\n`);
});
