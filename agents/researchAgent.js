<<<<<<< HEAD
/**
 * Research Agent — Deep Academic Research
 * 
 * Multi-layer approach:
 *   1. AI generates targeted academic search queries from mindmap nodes
 *   2. Web search via Google/Bing/DuckDuckGo (with fallback chain)
 *   3. Deep page scraping — visits URLs, extracts full content
 *   4. AI summarizes each source with academic analysis
 *   5. AI-generated academic sources as enrichment layer
 *   6. Sources pushed to store in real-time
 */

const axios = require('axios');
const cheerio = require('cheerio');

const TOGETHER_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

class ResearchAgent {
    constructor() {
        this.name = 'ResearchAgent';
        this.status = 'idle';
        this.progress = 0;
        this._aborted = false;
    }

    /**
     * Run deep research on mindmap nodes
     */
    async run(nodes, sourceStore, apiKey, onProgress, settings = {}, projectId = null) {
        this.status = 'running';
        this.progress = 0;
        this._aborted = false;
        const seenUrls = new Set();
        for (const s of sourceStore.getAll()) {
            if (s.url) seenUrls.add(s.url);
        }

        const queriesPerNode = settings.queriesPerNode || 4;

        const researchNodes = nodes.filter(n => n.label && n.label.length > 2);
        const totalSteps = researchNodes.length;
        let completedSteps = 0;

        for (const node of researchNodes) {
            if (this._aborted) break;
            completedSteps++;
            const pct = Math.round((completedSteps / totalSteps) * 100);

            onProgress && onProgress({
                agent: this.name,
                step: `Recherche approfondie: "${node.label}" (${completedSteps}/${totalSteps})`,
                progress: pct
            });

            try {
                // Step 1: Generate search queries via AI
                const queries = await this._generateSearchQueries(node.label, apiKey, queriesPerNode);

                onProgress && onProgress({
                    agent: this.name,
                    step: `${queries.length} requêtes pour "${node.label}"`,
                    progress: pct
                });

                // Step 2: Search and deep-scrape
                let foundAny = false;
                for (const query of queries) {
                    if (this._aborted) break;
                    try {
                        const searchResults = await this._search(query);

                        for (const result of searchResults) {
                            if (seenUrls.has(result.url)) continue;
                            seenUrls.add(result.url);

                            // Step 3: Deep scrape the page
                            let pageContent = null;
                            try {
                                pageContent = await this._scrapePageContent(result.url);
                            } catch (e) { /* page unreachable */ }

                            const fullContent = pageContent || result.snippet || '';

                            // Step 4: AI analysis
                            let analysis = null;
                            if (apiKey && fullContent.length > 100) {
                                try {
                                    analysis = await this._analyzeSource(result.title, fullContent, node.label, apiKey);
                                } catch (e) { /* AI failed */ }
                            }

                            const relevance = this._calculateRelevance(
                                { title: result.title, snippet: fullContent }, researchNodes
                            );

                            sourceStore.add({
                                title: result.title,
                                url: result.url,
                                summary: analysis ? analysis.summary : this._truncate(fullContent, 500),
                                content: this._truncate(fullContent, 3000),
                                academicAnalysis: analysis ? analysis.analysis : '',
                                keyFindings: analysis ? analysis.keyFindings : [],
                                methodology: analysis ? analysis.methodology : '',
                                relevanceScore: analysis ? Math.max(analysis.relevanceScore, relevance.score) : relevance.score,
                                relatedNodes: relevance.relatedNodes,
                                searchQuery: query,
                                type: pageContent ? 'deep-scraped' : 'snippet'
                            }, projectId);

                            foundAny = true;
                            onProgress && onProgress({
                                agent: this.name,
                                step: `✓ Source: "${this._truncate(result.title, 50)}"`,
                                progress: pct
                            });
                        }
                    } catch (err) {
                        console.warn(`Search error for "${query}":`, err.message);
                    }
                    await this._delay(500);
                }

                // Step 5: AI-enriched sources if web search found nothing
                if (!foundAny && apiKey) {
                    onProgress && onProgress({
                        agent: this.name,
                        step: `Enrichissement IA pour "${node.label}"...`,
                        progress: pct
                    });

                    try {
                        const aiSources = await this._generateAISources(node.label, apiKey);
                        for (const src of aiSources) {
                            sourceStore.add(src, projectId);
                            onProgress && onProgress({
                                agent: this.name,
                                step: `✓ Source IA: "${this._truncate(src.title, 50)}"`,
                                progress: pct
                            });
                        }
                    } catch (e) {
                        console.warn('AI source generation failed:', e.message);
                    }
                }

            } catch (err) {
                console.warn(`Research error for "${node.label}":`, err.message);
            }
        }

        // Final enrichment: generate additional AI-based academic sources
        if (apiKey && sourceStore.getAll().length < 5) {
            onProgress && onProgress({
                agent: this.name,
                step: 'Enrichissement final via IA...',
                progress: 95
            });
            const rootLabel = nodes.length > 0 ? nodes[0].label : 'Recherche';
            try {
                const aiSources = await this._generateAISources(rootLabel, apiKey, 8);
                for (const src of aiSources) {
                    sourceStore.add(src, projectId);
                }
            } catch (e) { /* ignore */ }
        }

        this.status = 'done';
        this.progress = 100;
        const total = sourceStore.getAll().length;
        onProgress && onProgress({
            agent: this.name,
            step: `Recherche terminée: ${total} sources collectées`,
            progress: 100
        });
    }

    /**
     * AI-generated search queries
     */
    async _generateSearchQueries(topic, apiKey, queryCount = 4) {
        if (!apiKey) {
            return [`${topic} research`, `${topic} étude académique`, `${topic} review`].slice(0, queryCount);
        }

        try {
            const response = await axios.post(TOGETHER_API_URL, {
                model: MODEL,
                messages: [
                    { role: 'system', content: 'Génère des requêtes de recherche. Réponds UNIQUEMENT avec un tableau JSON de strings.' },
                    { role: 'user', content: `Génère ${queryCount} requêtes de recherche web variées (français + anglais) pour trouver des articles scientifiques sur: "${topic}".\nRéponds UNIQUEMENT: ["query1", "query2", ...]` }
                ],
                max_tokens: 400,
                temperature: 0.7
            }, {
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 15000
            });

            const content = response.data.choices[0].message.content.trim();
            const cleaned = content.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
            const queries = JSON.parse(cleaned);
            return Array.isArray(queries) ? queries.slice(0, queryCount) : [topic];
        } catch (err) {
            return [`${topic} academic research`, `${topic} étude`, `${topic} review article`].slice(0, queryCount);
        }
    }

    /**
     * Search with fallback chain: Google → Bing → DuckDuckGo
     */
    async _search(query) {
        // Try Google
        try {
            const results = await this._searchGoogle(query);
            if (results.length > 0) return results;
        } catch (e) { /* fallback */ }

        // Try Bing
        try {
            const results = await this._searchBing(query);
            if (results.length > 0) return results;
        } catch (e) { /* fallback */ }

        // Try DuckDuckGo
        try {
            const results = await this._searchDuckDuckGo(query);
            if (results.length > 0) return results;
        } catch (e) { /* all failed */ }

        return [];
    }

    async _searchGoogle(query) {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=6&hl=fr`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const results = [];

        $('div.g').each((i, el) => {
            if (i >= 6) return false;
            const linkEl = $(el).find('a').first();
            const href = linkEl.attr('href');
            const title = $(el).find('h3').first().text().trim();
            const snippet = $(el).find('.VwiC3b, .IsZvec, span.aCOpRe').first().text().trim();

            if (title && href && href.startsWith('http') && !href.includes('google.com')) {
                results.push({ title, url: href, snippet });
            }
        });

        return results;
    }

    async _searchBing(query) {
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=6`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html',
                'Accept-Language': 'fr-FR,fr;q=0.9'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const results = [];

        $('li.b_algo').each((i, el) => {
            if (i >= 6) return false;
            const linkEl = $(el).find('h2 a').first();
            const href = linkEl.attr('href');
            const title = linkEl.text().trim();
            const snippet = $(el).find('.b_caption p').first().text().trim();

            if (title && href && href.startsWith('http')) {
                results.push({ title, url: href, snippet });
            }
        });

        return results;
    }

    async _searchDuckDuckGo(query) {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html',
                'Accept-Language': 'fr-FR,fr;q=0.9'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const results = [];

        $('.result').each((i, el) => {
            if (i >= 6) return false;
            const titleEl = $(el).find('.result__title a');
            const snippetEl = $(el).find('.result__snippet');
            const href = titleEl.attr('href');

            if (titleEl.text() && href) {
                let actualUrl = href;
                try {
                    const urlObj = new URL(href, 'https://duckduckgo.com');
                    actualUrl = urlObj.searchParams.get('uddg') || href;
                } catch (e) { }

                results.push({
                    title: titleEl.text().trim(),
                    url: actualUrl,
                    snippet: snippetEl.text().trim()
                });
            }
        });

        return results;
    }

    /**
     * AI-generated academic sources with realistic content
     */
    async _generateAISources(topic, apiKey, count = 4) {
        const response = await axios.post(TOGETHER_API_URL, {
            model: MODEL,
            messages: [
                { role: 'system', content: 'Tu es un expert bibliographique. Génère des sources académiques réalistes et détaillées. Réponds en JSON.' },
                {
                    role: 'user', content: `Pour un mémoire sur "${topic}", génère ${count} sources académiques réalistes avec un contenu détaillé.

Pour chaque source, fournis:
- Un titre d'article académique réaliste
- Une URL plausible (arxiv.org, hal.science, scholar, revues académiques)
- Un résumé détaillé de 150-200 mots couvrant la problématique, la méthodologie, les résultats et conclusions
- 3-4 découvertes clés
- La méthodologie utilisée
- Un score de pertinence (60-95)

Réponds en JSON:
[
  {
    "title": "Titre de l'article",
    "url": "https://...",
    "summary": "Résumé détaillé de 150-200 mots...",
    "keyFindings": ["découverte 1", "découverte 2", "découverte 3"],
    "methodology": "Méthodologie...",
    "relevanceScore": 85
  }
]` }
            ],
            max_tokens: 4000,
            temperature: 0.5
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 45000
        });

        const content = response.data.choices[0].message.content.trim();
        const cleaned = content.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);

        return (Array.isArray(parsed) ? parsed : []).map(src => ({
            title: src.title,
            url: src.url || '',
            summary: src.summary,
            content: src.summary,
            academicAnalysis: '',
            keyFindings: src.keyFindings || [],
            methodology: src.methodology || '',
            relevanceScore: src.relevanceScore || 70,
            relatedNodes: [],
            type: 'ai-enriched'
        }));
    }

    /**
     * Deep scrape: visit URL, extract text
     */
    async _scrapePageContent(url) {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
            },
            timeout: 8000,
            maxRedirects: 3,
            maxContentLength: 2 * 1024 * 1024
        });

        const $ = cheerio.load(response.data);
        $('script, style, nav, footer, header, aside, .sidebar, .menu, .ad, iframe, noscript').remove();

        let contentArea = $('article, main, .content, .post, .article, .entry-content, #content').first();
        if (contentArea.length === 0) contentArea = $('body');

        const paragraphs = [];
        contentArea.find('p, h2, h3, h4, li').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 30) {
                const tag = $(el).prop('tagName').toLowerCase();
                if (tag.startsWith('h')) {
                    paragraphs.push(`\n## ${text}\n`);
                } else {
                    paragraphs.push(text);
                }
            }
        });

        const fullText = paragraphs.join('\n\n');
        if (fullText.length < 100) throw new Error('Insufficient content');
        return this._truncate(fullText, 4000);
    }

    /**
     * AI academic analysis of a source
     */
    async _analyzeSource(title, content, topic, apiKey) {
        const response = await axios.post(TOGETHER_API_URL, {
            model: MODEL,
            messages: [
                { role: 'system', content: 'Analyse académique. Réponds en JSON.' },
                {
                    role: 'user', content: `Analyse pour un mémoire sur "${topic}":

TITRE: ${title}
CONTENU: ${this._truncate(content, 2500)}

JSON requis:
{
  "summary": "Résumé académique détaillé (3-5 phrases)",
  "analysis": "Analyse critique approfondie (4-6 phrases)",
  "keyFindings": ["découverte 1", "découverte 2", "découverte 3"],
  "methodology": "Méthodologie identifiée",
  "relevanceScore": 75
}` }
            ],
            max_tokens: 1500,
            temperature: 0.3
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 30000
        });

        const raw = response.data.choices[0].message.content.trim();
        const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
        return JSON.parse(cleaned);
    }

    _calculateRelevance(source, nodes) {
        const sourceText = `${source.title} ${source.snippet}`.toLowerCase();
        let totalScore = 0;
        const relatedNodes = [];

        for (const node of nodes) {
            let nodeScore = 0;
            const keywords = node.keywords || [];
            for (const keyword of keywords) {
                if (sourceText.includes(keyword.toLowerCase())) nodeScore += 15;
            }
            if (sourceText.includes(node.label.toLowerCase())) nodeScore += 25;
            const words = node.label.toLowerCase().split(/\s+/);
            for (const word of words) {
                if (word.length > 3 && sourceText.includes(word)) nodeScore += 8;
            }
            if (nodeScore > 0) {
                relatedNodes.push({ nodeId: node.id, label: node.label, score: Math.min(nodeScore, 100) });
                totalScore += nodeScore;
            }
        }

        return {
            score: Math.min(Math.round(totalScore / Math.max(nodes.length, 1) * 1.5), 100),
            relatedNodes
        };
    }

    _truncate(str, maxLen) {
        if (!str || str.length <= maxLen) return str || '';
        return str.substring(0, maxLen) + '...';
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { ResearchAgent };
=======
/**
 * Research Agent — Deep Academic Research
 * 
 * Multi-layer approach:
 *   1. AI generates targeted academic search queries from mindmap nodes
 *   2. Web search via Google/Bing/DuckDuckGo (with fallback chain)
 *   3. Deep page scraping — visits URLs, extracts full content
 *   4. AI summarizes each source with academic analysis
 *   5. AI-generated academic sources as enrichment layer
 *   6. Sources pushed to store in real-time
 */

const axios = require('axios');
const cheerio = require('cheerio');

const TOGETHER_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

class ResearchAgent {
    constructor() {
        this.name = 'ResearchAgent';
        this.status = 'idle';
        this.progress = 0;
        this._aborted = false;
    }

    /**
     * Run deep research on mindmap nodes
     */
    async run(nodes, sourceStore, apiKey, onProgress, settings = {}, projectId = null) {
        this.status = 'running';
        this.progress = 0;
        this._aborted = false;
        const seenUrls = new Set();
        for (const s of sourceStore.getAll()) {
            if (s.url) seenUrls.add(s.url);
        }

        const queriesPerNode = settings.queriesPerNode || 4;

        const researchNodes = nodes.filter(n => n.label && n.label.length > 2);
        const totalSteps = researchNodes.length;
        let completedSteps = 0;

        for (const node of researchNodes) {
            if (this._aborted) break;
            completedSteps++;
            const pct = Math.round((completedSteps / totalSteps) * 100);

            onProgress && onProgress({
                agent: this.name,
                step: `Recherche approfondie: "${node.label}" (${completedSteps}/${totalSteps})`,
                progress: pct
            });

            try {
                // Step 1: Generate search queries via AI
                const queries = await this._generateSearchQueries(node.label, apiKey, queriesPerNode);

                onProgress && onProgress({
                    agent: this.name,
                    step: `${queries.length} requêtes pour "${node.label}"`,
                    progress: pct
                });

                // Step 2: Search and deep-scrape
                let foundAny = false;
                for (const query of queries) {
                    if (this._aborted) break;
                    try {
                        const searchResults = await this._search(query);

                        for (const result of searchResults) {
                            if (seenUrls.has(result.url)) continue;
                            seenUrls.add(result.url);

                            // Step 3: Deep scrape the page
                            let pageContent = null;
                            try {
                                pageContent = await this._scrapePageContent(result.url);
                            } catch (e) { /* page unreachable */ }

                            const fullContent = pageContent || result.snippet || '';

                            // Step 4: AI analysis
                            let analysis = null;
                            if (apiKey && fullContent.length > 100) {
                                try {
                                    analysis = await this._analyzeSource(result.title, fullContent, node.label, apiKey);
                                } catch (e) { /* AI failed */ }
                            }

                            const relevance = this._calculateRelevance(
                                { title: result.title, snippet: fullContent }, researchNodes
                            );

                            sourceStore.add({
                                title: result.title,
                                url: result.url,
                                summary: analysis ? analysis.summary : this._truncate(fullContent, 500),
                                content: this._truncate(fullContent, 3000),
                                academicAnalysis: analysis ? analysis.analysis : '',
                                keyFindings: analysis ? analysis.keyFindings : [],
                                methodology: analysis ? analysis.methodology : '',
                                relevanceScore: analysis ? Math.max(analysis.relevanceScore, relevance.score) : relevance.score,
                                relatedNodes: relevance.relatedNodes,
                                searchQuery: query,
                                type: pageContent ? 'deep-scraped' : 'snippet'
                            }, projectId);

                            foundAny = true;
                            onProgress && onProgress({
                                agent: this.name,
                                step: `✓ Source: "${this._truncate(result.title, 50)}"`,
                                progress: pct
                            });
                        }
                    } catch (err) {
                        console.warn(`Search error for "${query}":`, err.message);
                    }
                    await this._delay(500);
                }

                // Step 5: AI-enriched sources if web search found nothing
                if (!foundAny && apiKey) {
                    onProgress && onProgress({
                        agent: this.name,
                        step: `Enrichissement IA pour "${node.label}"...`,
                        progress: pct
                    });

                    try {
                        const aiSources = await this._generateAISources(node.label, apiKey);
                        for (const src of aiSources) {
                            sourceStore.add(src, projectId);
                            onProgress && onProgress({
                                agent: this.name,
                                step: `✓ Source IA: "${this._truncate(src.title, 50)}"`,
                                progress: pct
                            });
                        }
                    } catch (e) {
                        console.warn('AI source generation failed:', e.message);
                    }
                }

            } catch (err) {
                console.warn(`Research error for "${node.label}":`, err.message);
            }
        }

        // Final enrichment: generate additional AI-based academic sources
        if (apiKey && sourceStore.getAll().length < 5) {
            onProgress && onProgress({
                agent: this.name,
                step: 'Enrichissement final via IA...',
                progress: 95
            });
            const rootLabel = nodes.length > 0 ? nodes[0].label : 'Recherche';
            try {
                const aiSources = await this._generateAISources(rootLabel, apiKey, 8);
                for (const src of aiSources) {
                    sourceStore.add(src, projectId);
                }
            } catch (e) { /* ignore */ }
        }

        this.status = 'done';
        this.progress = 100;
        const total = sourceStore.getAll().length;
        onProgress && onProgress({
            agent: this.name,
            step: `Recherche terminée: ${total} sources collectées`,
            progress: 100
        });
    }

    /**
     * AI-generated search queries
     */
    async _generateSearchQueries(topic, apiKey, queryCount = 4) {
        if (!apiKey) {
            return [`${topic} research`, `${topic} étude académique`, `${topic} review`].slice(0, queryCount);
        }

        try {
            const response = await axios.post(TOGETHER_API_URL, {
                model: MODEL,
                messages: [
                    { role: 'system', content: 'Génère des requêtes de recherche. Réponds UNIQUEMENT avec un tableau JSON de strings.' },
                    { role: 'user', content: `Génère ${queryCount} requêtes de recherche web variées (français + anglais) pour trouver des articles scientifiques sur: "${topic}".\nRéponds UNIQUEMENT: ["query1", "query2", ...]` }
                ],
                max_tokens: 400,
                temperature: 0.7
            }, {
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 15000
            });

            const content = response.data.choices[0].message.content.trim();
            const cleaned = content.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
            const queries = JSON.parse(cleaned);
            return Array.isArray(queries) ? queries.slice(0, queryCount) : [topic];
        } catch (err) {
            return [`${topic} academic research`, `${topic} étude`, `${topic} review article`].slice(0, queryCount);
        }
    }

    /**
     * Search with fallback chain: Google → Bing → DuckDuckGo
     */
    async _search(query) {
        // Try Google
        try {
            const results = await this._searchGoogle(query);
            if (results.length > 0) return results;
        } catch (e) { /* fallback */ }

        // Try Bing
        try {
            const results = await this._searchBing(query);
            if (results.length > 0) return results;
        } catch (e) { /* fallback */ }

        // Try DuckDuckGo
        try {
            const results = await this._searchDuckDuckGo(query);
            if (results.length > 0) return results;
        } catch (e) { /* all failed */ }

        return [];
    }

    async _searchGoogle(query) {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=6&hl=fr`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const results = [];

        $('div.g').each((i, el) => {
            if (i >= 6) return false;
            const linkEl = $(el).find('a').first();
            const href = linkEl.attr('href');
            const title = $(el).find('h3').first().text().trim();
            const snippet = $(el).find('.VwiC3b, .IsZvec, span.aCOpRe').first().text().trim();

            if (title && href && href.startsWith('http') && !href.includes('google.com')) {
                results.push({ title, url: href, snippet });
            }
        });

        return results;
    }

    async _searchBing(query) {
        const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=6`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html',
                'Accept-Language': 'fr-FR,fr;q=0.9'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const results = [];

        $('li.b_algo').each((i, el) => {
            if (i >= 6) return false;
            const linkEl = $(el).find('h2 a').first();
            const href = linkEl.attr('href');
            const title = linkEl.text().trim();
            const snippet = $(el).find('.b_caption p').first().text().trim();

            if (title && href && href.startsWith('http')) {
                results.push({ title, url: href, snippet });
            }
        });

        return results;
    }

    async _searchDuckDuckGo(query) {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html',
                'Accept-Language': 'fr-FR,fr;q=0.9'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const results = [];

        $('.result').each((i, el) => {
            if (i >= 6) return false;
            const titleEl = $(el).find('.result__title a');
            const snippetEl = $(el).find('.result__snippet');
            const href = titleEl.attr('href');

            if (titleEl.text() && href) {
                let actualUrl = href;
                try {
                    const urlObj = new URL(href, 'https://duckduckgo.com');
                    actualUrl = urlObj.searchParams.get('uddg') || href;
                } catch (e) { }

                results.push({
                    title: titleEl.text().trim(),
                    url: actualUrl,
                    snippet: snippetEl.text().trim()
                });
            }
        });

        return results;
    }

    /**
     * AI-generated academic sources with realistic content
     */
    async _generateAISources(topic, apiKey, count = 4) {
        const response = await axios.post(TOGETHER_API_URL, {
            model: MODEL,
            messages: [
                { role: 'system', content: 'Tu es un expert bibliographique. Génère des sources académiques réalistes et détaillées. Réponds en JSON.' },
                {
                    role: 'user', content: `Pour un mémoire sur "${topic}", génère ${count} sources académiques réalistes avec un contenu détaillé.

Pour chaque source, fournis:
- Un titre d'article académique réaliste
- Une URL plausible (arxiv.org, hal.science, scholar, revues académiques)
- Un résumé détaillé de 150-200 mots couvrant la problématique, la méthodologie, les résultats et conclusions
- 3-4 découvertes clés
- La méthodologie utilisée
- Un score de pertinence (60-95)

Réponds en JSON:
[
  {
    "title": "Titre de l'article",
    "url": "https://...",
    "summary": "Résumé détaillé de 150-200 mots...",
    "keyFindings": ["découverte 1", "découverte 2", "découverte 3"],
    "methodology": "Méthodologie...",
    "relevanceScore": 85
  }
]` }
            ],
            max_tokens: 4000,
            temperature: 0.5
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 45000
        });

        const content = response.data.choices[0].message.content.trim();
        const cleaned = content.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);

        return (Array.isArray(parsed) ? parsed : []).map(src => ({
            title: src.title,
            url: src.url || '',
            summary: src.summary,
            content: src.summary,
            academicAnalysis: '',
            keyFindings: src.keyFindings || [],
            methodology: src.methodology || '',
            relevanceScore: src.relevanceScore || 70,
            relatedNodes: [],
            type: 'ai-enriched'
        }));
    }

    /**
     * Deep scrape: visit URL, extract text
     */
    async _scrapePageContent(url) {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
            },
            timeout: 8000,
            maxRedirects: 3,
            maxContentLength: 2 * 1024 * 1024
        });

        const $ = cheerio.load(response.data);
        $('script, style, nav, footer, header, aside, .sidebar, .menu, .ad, iframe, noscript').remove();

        let contentArea = $('article, main, .content, .post, .article, .entry-content, #content').first();
        if (contentArea.length === 0) contentArea = $('body');

        const paragraphs = [];
        contentArea.find('p, h2, h3, h4, li').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 30) {
                const tag = $(el).prop('tagName').toLowerCase();
                if (tag.startsWith('h')) {
                    paragraphs.push(`\n## ${text}\n`);
                } else {
                    paragraphs.push(text);
                }
            }
        });

        const fullText = paragraphs.join('\n\n');
        if (fullText.length < 100) throw new Error('Insufficient content');
        return this._truncate(fullText, 4000);
    }

    /**
     * AI academic analysis of a source
     */
    async _analyzeSource(title, content, topic, apiKey) {
        const response = await axios.post(TOGETHER_API_URL, {
            model: MODEL,
            messages: [
                { role: 'system', content: 'Analyse académique. Réponds en JSON.' },
                {
                    role: 'user', content: `Analyse pour un mémoire sur "${topic}":

TITRE: ${title}
CONTENU: ${this._truncate(content, 2500)}

JSON requis:
{
  "summary": "Résumé académique détaillé (3-5 phrases)",
  "analysis": "Analyse critique approfondie (4-6 phrases)",
  "keyFindings": ["découverte 1", "découverte 2", "découverte 3"],
  "methodology": "Méthodologie identifiée",
  "relevanceScore": 75
}` }
            ],
            max_tokens: 1500,
            temperature: 0.3
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 30000
        });

        const raw = response.data.choices[0].message.content.trim();
        const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
        return JSON.parse(cleaned);
    }

    _calculateRelevance(source, nodes) {
        const sourceText = `${source.title} ${source.snippet}`.toLowerCase();
        let totalScore = 0;
        const relatedNodes = [];

        for (const node of nodes) {
            let nodeScore = 0;
            const keywords = node.keywords || [];
            for (const keyword of keywords) {
                if (sourceText.includes(keyword.toLowerCase())) nodeScore += 15;
            }
            if (sourceText.includes(node.label.toLowerCase())) nodeScore += 25;
            const words = node.label.toLowerCase().split(/\s+/);
            for (const word of words) {
                if (word.length > 3 && sourceText.includes(word)) nodeScore += 8;
            }
            if (nodeScore > 0) {
                relatedNodes.push({ nodeId: node.id, label: node.label, score: Math.min(nodeScore, 100) });
                totalScore += nodeScore;
            }
        }

        return {
            score: Math.min(Math.round(totalScore / Math.max(nodes.length, 1) * 1.5), 100),
            relatedNodes
        };
    }

    _truncate(str, maxLen) {
        if (!str || str.length <= maxLen) return str || '';
        return str.substring(0, maxLen) + '...';
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { ResearchAgent };
>>>>>>> bd3b8f710204045058fa663319866f741df14205
