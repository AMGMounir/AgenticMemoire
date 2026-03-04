<<<<<<< HEAD
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const { OAuth2Client } = require('google-auth-library');
const multer = require('multer');

const { parseMindmap } = require('./utils/mindmapParser');
const { SourceStore } = require('./utils/sourceStore');
const { UserStore } = require('./utils/userStore');
const { Orchestrator } = require('./agents/orchestrator');

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
app.use(express.json({ limit: '10mb' }));
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

        const apiKey = process.env.TOGETHER_API_KEY || '';
        let mindmapText;

        if (apiKey && apiKey !== 'your_together_ai_key_here') {
            const axios = require('axios');
            const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
                model: 'deepseek-ai/DeepSeek-V3',
                messages: [
                    { role: 'system', content: 'Tu génères des mindmaps au format Mermaid.js. Réponds UNIQUEMENT avec le code mermaid, sans explication.' },
                    { role: 'user', content: `Génère une mindmap Mermaid.js détaillée pour un mémoire de Master 2 sur: "${title}". 4-5 branches principales, 2-3 sous-branches chacune. Syntaxe:\nmindmap\n  root((${title}))\n    Branche\n      Sous-branche\n\nRéponds UNIQUEMENT le code mermaid.` }
                ],
                max_tokens: 1000,
                temperature: 0.5
            }, {
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 30000
            });

            let content = response.data.choices[0].message.content.trim();
            content = content.replace(/```mermaid\s*/gi, '').replace(/```\s*/g, '').trim();
            mindmapText = content;
        } else {
            mindmapText = `mindmap\n  root((${title}))\n    Contexte et enjeux\n      Définitions clés\n      Historique\n      Problématiques actuelles\n    État de l'art\n      Approches théoriques\n      Solutions existantes\n      Analyse comparative\n    Méthodologie\n      Collecte de données\n      Outils et frameworks\n      Protocole expérimental\n    Résultats et analyse\n      Résultats quantitatifs\n      Analyse qualitative\n      Discussion\n    Perspectives\n      Limites identifiées\n      Améliorations possibles\n      Travaux futurs`;
        }

        res.json({ success: true, data: mindmapText });
    } catch (err) {
        console.error('Mindmap generation error:', err.message);
        const { title } = req.body;
        const fallback = `mindmap\n  root((${title}))\n    Contexte\n      Définitions\n      Historique\n    État de l'art\n      Approches\n      Comparaison\n    Méthodologie\n      Outils\n      Protocole\n    Résultats\n      Analyse\n    Perspectives\n      Limites\n      Travaux futurs`;
        res.json({ success: true, data: fallback });
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

// Step 1: Launch RESEARCH only
app.post('/api/agents/research', async (req, res) => {
    try {
        const { mindmapText, threshold, depth } = req.body;
        if (!mindmapText) return res.status(400).json({ error: 'mindmapText is required' });

        const apiKey = process.env.TOGETHER_API_KEY || '';
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

        res.json({ success: true, message: 'Research started', projectId, data: orchestrator.getStatus() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Step 2: Launch SYNTHESIS + STRUCTURE (for a specific project)
app.post('/api/agents/synthesize', async (req, res) => {
    try {
        const apiKey = process.env.TOGETHER_API_KEY || '';
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

        orchestrator.mindmapData = mindmapData;
        orchestrator.runSynthesis(sourceStore, apiKey, projectId);

        res.json({ success: true, message: 'Synthesis started', data: orchestrator.getStatus() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Legacy endpoint for backward compat
app.post('/api/agents/run', async (req, res) => {
    try {
        const { mindmapText } = req.body;
        if (!mindmapText) return res.status(400).json({ error: 'mindmapText is required' });

        const apiKey = process.env.TOGETHER_API_KEY || '';
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

// ============ SERVE FRONTEND ============
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    const hasKey = process.env.TOGETHER_API_KEY && process.env.TOGETHER_API_KEY !== 'your_together_ai_key_here';
    const hasGoogleId = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE';
    console.log(`\n  🎓 Memoir Assistant Server running at http://localhost:${PORT}`);
    console.log(`  🔑 Together AI API Key: ${hasKey ? '✓ Detected' : '✗ Not set (demo mode)'}`);
    console.log(`  🔐 Google OAuth: ${hasGoogleId ? '✓ Configured' : '✗ Not set — add GOOGLE_CLIENT_ID to .env'}`);
    console.log(`     Edit .env file to configure\n`);
});
=======
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const { OAuth2Client } = require('google-auth-library');
const multer = require('multer');

const { parseMindmap } = require('./utils/mindmapParser');
const { SourceStore } = require('./utils/sourceStore');
const { UserStore } = require('./utils/userStore');
const { Orchestrator } = require('./agents/orchestrator');

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
app.use(express.json({ limit: '10mb' }));
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

        const apiKey = process.env.TOGETHER_API_KEY || '';
        let mindmapText;

        if (apiKey && apiKey !== 'your_together_ai_key_here') {
            const axios = require('axios');
            const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
                model: 'deepseek-ai/DeepSeek-V3',
                messages: [
                    { role: 'system', content: 'Tu génères des mindmaps au format Mermaid.js. Réponds UNIQUEMENT avec le code mermaid, sans explication.' },
                    { role: 'user', content: `Génère une mindmap Mermaid.js détaillée pour un mémoire de Master 2 sur: "${title}". 4-5 branches principales, 2-3 sous-branches chacune. Syntaxe:\nmindmap\n  root((${title}))\n    Branche\n      Sous-branche\n\nRéponds UNIQUEMENT le code mermaid.` }
                ],
                max_tokens: 1000,
                temperature: 0.5
            }, {
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 30000
            });

            let content = response.data.choices[0].message.content.trim();
            content = content.replace(/```mermaid\s*/gi, '').replace(/```\s*/g, '').trim();
            mindmapText = content;
        } else {
            mindmapText = `mindmap\n  root((${title}))\n    Contexte et enjeux\n      Définitions clés\n      Historique\n      Problématiques actuelles\n    État de l'art\n      Approches théoriques\n      Solutions existantes\n      Analyse comparative\n    Méthodologie\n      Collecte de données\n      Outils et frameworks\n      Protocole expérimental\n    Résultats et analyse\n      Résultats quantitatifs\n      Analyse qualitative\n      Discussion\n    Perspectives\n      Limites identifiées\n      Améliorations possibles\n      Travaux futurs`;
        }

        res.json({ success: true, data: mindmapText });
    } catch (err) {
        console.error('Mindmap generation error:', err.message);
        const { title } = req.body;
        const fallback = `mindmap\n  root((${title}))\n    Contexte\n      Définitions\n      Historique\n    État de l'art\n      Approches\n      Comparaison\n    Méthodologie\n      Outils\n      Protocole\n    Résultats\n      Analyse\n    Perspectives\n      Limites\n      Travaux futurs`;
        res.json({ success: true, data: fallback });
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

// Step 1: Launch RESEARCH only
app.post('/api/agents/research', async (req, res) => {
    try {
        const { mindmapText, threshold, depth } = req.body;
        if (!mindmapText) return res.status(400).json({ error: 'mindmapText is required' });

        const apiKey = process.env.TOGETHER_API_KEY || '';
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

        res.json({ success: true, message: 'Research started', projectId, data: orchestrator.getStatus() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Step 2: Launch SYNTHESIS + STRUCTURE (for a specific project)
app.post('/api/agents/synthesize', async (req, res) => {
    try {
        const apiKey = process.env.TOGETHER_API_KEY || '';
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

        orchestrator.mindmapData = mindmapData;
        orchestrator.runSynthesis(sourceStore, apiKey, projectId);

        res.json({ success: true, message: 'Synthesis started', data: orchestrator.getStatus() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Legacy endpoint for backward compat
app.post('/api/agents/run', async (req, res) => {
    try {
        const { mindmapText } = req.body;
        if (!mindmapText) return res.status(400).json({ error: 'mindmapText is required' });

        const apiKey = process.env.TOGETHER_API_KEY || '';
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

// ============ SERVE FRONTEND ============
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    const hasKey = process.env.TOGETHER_API_KEY && process.env.TOGETHER_API_KEY !== 'your_together_ai_key_here';
    const hasGoogleId = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE';
    console.log(`\n  🎓 Memoir Assistant Server running at http://localhost:${PORT}`);
    console.log(`  🔑 Together AI API Key: ${hasKey ? '✓ Detected' : '✗ Not set (demo mode)'}`);
    console.log(`  🔐 Google OAuth: ${hasGoogleId ? '✓ Configured' : '✗ Not set — add GOOGLE_CLIENT_ID to .env'}`);
    console.log(`     Edit .env file to configure\n`);
});
>>>>>>> bd3b8f710204045058fa663319866f741df14205
