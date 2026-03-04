/**
 * Synthesis Agent — Maximum-Depth Doctoral Synthesis
 * 
 * Multi-pass approach with heavy AI computing:
 *   Pass 1: Deep per-theme analysis (800+ words each)
 *   Pass 2: Per-theme data extraction (tables, stats, figures)
 *   Pass 3: Cross-theme comparative synthesis
 *   Pass 4: Global meta-analysis with research gaps
 *   Pass 5: Generate structured data tables and visual references
 */

const axios = require('axios');

const SAMBANOVA_API_URL = 'https://api.sambanova.ai/v1/chat/completions';
const MODEL = 'DeepSeek-V3.1-cb';

class SynthesisAgent {
    constructor() {
        this.name = 'SynthesisAgent';
        this.status = 'idle';
        this.progress = 0;
        this._aborted = false;
    }

    async run(sources, mindmap, apiKey, onProgress) {
        this.status = 'running';
        this.progress = 0;
        this._aborted = false;

        if (!apiKey) {
            onProgress && onProgress({ agent: this.name, step: 'Pas de clé API — synthèse démo', progress: 50 });
            const result = this._mockSynthesis(sources, mindmap);
            this.status = 'done';
            this.progress = 100;
            return result;
        }

        try {
            const sourceContext = this._buildSourceContext(sources);
            const themes = mindmap.children || [mindmap];
            const themeAnalyses = [];

            // ===== PASS 1: Deep per-theme analysis =====
            for (let i = 0; i < themes.length; i++) {
                if (this._aborted) break;
                const theme = themes[i];
                const pct = Math.round((i / themes.length) * 30);
                onProgress && onProgress({
                    agent: this.name,
                    step: `Pass 1/5 — Analyse approfondie: "${theme.label}" (${i + 1}/${themes.length})`,
                    progress: pct
                });

                try {
                    const analysis = await this._deepThemeAnalysis(theme, sourceContext, apiKey);
                    themeAnalyses.push(analysis);
                } catch (err) {
                    console.warn(`Theme analysis failed for ${theme.label}:`, err.message);
                    themeAnalyses.push(this._fallbackTheme(theme));
                }

                await this._delay(300);
            }

            if (this._aborted) return this._mockSynthesis(sources, mindmap);

            // ===== PASS 2: Data extraction (tables, stats, figures) =====
            onProgress && onProgress({
                agent: this.name,
                step: 'Pass 2/5 — Extraction de données, tableaux et figures...',
                progress: 35
            });

            for (let i = 0; i < themeAnalyses.length; i++) {
                if (this._aborted) break;
                const theme = themeAnalyses[i];
                onProgress && onProgress({
                    agent: this.name,
                    step: `Pass 2/5 — Tableaux et figures: "${theme.theme}" (${i + 1}/${themeAnalyses.length})`,
                    progress: 35 + Math.round((i / themeAnalyses.length) * 15)
                });

                try {
                    const dataExtract = await this._extractDataAndFigures(theme, sourceContext, apiKey);
                    theme.tables = dataExtract.tables || [];
                    theme.figures = dataExtract.figures || [];
                    theme.statistics = dataExtract.statistics || [];
                    theme.comparativeData = dataExtract.comparativeData || '';
                } catch (err) {
                    console.warn(`Data extraction failed for ${theme.theme}:`, err.message);
                    theme.tables = [];
                    theme.figures = [];
                    theme.statistics = [];
                    theme.comparativeData = '';
                }

                await this._delay(300);
            }

            if (this._aborted) return this._mockSynthesis(sources, mindmap);

            // ===== PASS 3: Content expansion (MAXIMUM depth per theme) =====
            onProgress && onProgress({
                agent: this.name,
                step: 'Pass 3/6 — Expansion du contenu académique...',
                progress: 42
            });

            for (let i = 0; i < themeAnalyses.length; i++) {
                if (this._aborted) break;
                const theme = themeAnalyses[i];
                onProgress && onProgress({
                    agent: this.name,
                    step: `Pass 3/6 — Rédaction approfondie: "${theme.theme}" (${i + 1}/${themeAnalyses.length})`,
                    progress: 42 + Math.round((i / themeAnalyses.length) * 13)
                });

                try {
                    const expanded = await this._expandThemeContent(theme, sourceContext, apiKey);
                    // Merge expanded content into the existing synthesis
                    if (expanded.expandedSynthesis) {
                        theme.synthesis = theme.synthesis + '\n\n' + expanded.expandedSynthesis;
                    }
                    if (expanded.additionalAnalysis) {
                        theme.criticalAnalysis = (theme.criticalAnalysis || '') + '\n\n' + expanded.additionalAnalysis;
                    }
                    if (expanded.additionalKeyPoints && expanded.additionalKeyPoints.length > 0) {
                        theme.keyPoints = [...(theme.keyPoints || []), ...expanded.additionalKeyPoints];
                    }
                } catch (err) {
                    console.warn(`Content expansion failed for ${theme.theme}:`, err.message);
                }

                await this._delay(300);
            }

            if (this._aborted) return this._mockSynthesis(sources, mindmap);

            // ===== PASS 4: Cross-theme comparative synthesis =====
            onProgress && onProgress({
                agent: this.name,
                step: 'Pass 4/6 — Synthèse comparative inter-thèmes...',
                progress: 58
            });

            let comparativeSynthesis;
            try {
                comparativeSynthesis = await this._crossThemeSynthesis(themeAnalyses, mindmap.label, apiKey);
            } catch (err) {
                comparativeSynthesis = { crossAnalysis: '', interconnections: [], tensions: [] };
            }

            if (this._aborted) return this._mockSynthesis(sources, mindmap);

            // ===== PASS 5: Global meta-analysis =====
            onProgress && onProgress({
                agent: this.name,
                step: 'Pass 5/6 — Méta-analyse globale et lacunes...',
                progress: 70
            });

            let globalAnalysis;
            try {
                globalAnalysis = await this._globalMetaAnalysis(themeAnalyses, mindmap.label, sourceContext, sources.length, apiKey);
            } catch (err) {
                globalAnalysis = {
                    globalSummary: `Synthèse de ${sources.length} sources sur "${mindmap.label}".`,
                    gaps: [], contradictions: [], recommendations: [],
                    futureResearch: '', epistemologicalReflection: ''
                };
            }

            if (this._aborted) return this._mockSynthesis(sources, mindmap);

            // ===== PASS 6: Generate overview tables =====
            onProgress && onProgress({
                agent: this.name,
                step: 'Pass 6/6 — Tableaux récapitulatifs et synthèse finale...',
                progress: 85
            });

            let overviewTables;
            try {
                overviewTables = await this._generateOverviewTables(themeAnalyses, sources, mindmap.label, apiKey);
            } catch (err) {
                overviewTables = { summaryTable: '', methodologyTable: '', sourceMatrix: '' };
            }

            onProgress && onProgress({ agent: this.name, step: 'Synthèse académique complète', progress: 100 });

            this.status = 'done';
            this.progress = 100;

            return {
                themes: themeAnalyses,
                globalSummary: globalAnalysis.globalSummary,
                gaps: globalAnalysis.gaps || [],
                contradictions: globalAnalysis.contradictions || [],
                recommendations: globalAnalysis.recommendations || [],
                futureResearch: globalAnalysis.futureResearch || '',
                epistemologicalReflection: globalAnalysis.epistemologicalReflection || '',
                crossAnalysis: comparativeSynthesis.crossAnalysis || '',
                interconnections: comparativeSynthesis.interconnections || [],
                tensions: comparativeSynthesis.tensions || [],
                overviewTables,
                sourcesCount: sources.length,
                analysisDate: new Date().toISOString()
            };

        } catch (err) {
            console.error('Synthesis error:', err.message);
            this.status = 'done';
            return this._mockSynthesis(sources, mindmap);
        }
    }

    // ============ PASS 1: Deep Theme Analysis ============
    async _deepThemeAnalysis(themeNode, sourceContext, apiKey) {
        const subTopics = (themeNode.children || []).map(c => c.label).join(', ');

        const response = await axios.post(SAMBANOVA_API_URL, {
            model: MODEL,
            messages: [
                { role: 'system', content: 'Tu es un chercheur doctoral produisant un état de l\'art de 800+ mots par thème. Tu écris en français académique soutenu avec des citations [Source X]. Réponds en JSON.' },
                {
                    role: 'user', content: `ANALYSE APPROFONDIE pour un mémoire doctoral.

THÈME: "${themeNode.label}"
${subTopics ? `SOUS-THÈMES: ${subTopics}` : ''}

CORPUS (${sourceContext.split('---').length} sources):
${sourceContext}

Tu dois produire une analyse académique DE HAUTE QUALITÉ. Pas de résumé superficiel.

EXIGENCES STRICTES:
1. SYNTHÈSE (800+ mots MINIMUM): Rédige un texte académique fluide structuré en sous-parties. Cite systématiquement les sources [Source X]. Analyse les convergences, divergences, évolutions historiques. Discute les cadres théoriques. Évalue les méthodologies. Identifie les paradigmes dominants et émergents.

2. POINTS CLÉS (8-12 items): Chaque point doit être une phrase complète avec sa source.

3. ANALYSE CRITIQUE (200+ mots): Évalue la robustesse des arguments, biais, reproductibilité, validité interne/externe.

4. CADRE THÉORIQUE (150+ mots): Théories, modèles, paradigmes utilisés dans la littérature.

5. PISTES DE RÉFLEXION (5-8): Angles de recherche originaux et questions ouvertes.

6. MÉTHODOLOGIES IDENTIFIÉES: Liste des approches méthodologiques trouvées dans les sources.

JSON:
{
  "theme": "${themeNode.label}",
  "synthesis": "synthèse de 800+ mots...",
  "keyPoints": ["point détaillé avec [Source X]", ...],
  "sourcesUsed": [1, 2, 3],
  "criticalAnalysis": "analyse critique de 200+ mots...",
  "theoreticalFramework": "cadres théoriques de 150+ mots...",
  "reflectionPaths": ["piste 1", "piste 2", ...],
  "methodologies": ["méthode 1", "méthode 2"]
}` }
            ],
            max_tokens: 8000,
            temperature: 0.25
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 120000
        });

        return this._parseJSON(response.data.choices[0].message.content);
    }

    // ============ PASS 3: Content Expansion ============
    async _expandThemeContent(themeAnalysis, sourceContext, apiKey) {
        const response = await axios.post(SAMBANOVA_API_URL, {
            model: MODEL,
            messages: [
                { role: 'system', content: 'Tu es un rédacteur académique de niveau doctoral. Tu produis des textes denses, analytiques et riches en citations. Écris en français académique soutenu. Réponds en JSON.' },
                {
                    role: 'user', content: `EXPANSION ACADÉMIQUE APPROFONDIE.

THÈME: "${themeAnalysis.theme}"

SYNTHÈSE INITIALE (à compléter et approfondir):
${(themeAnalysis.synthesis || '').substring(0, 3000)}

ANALYSE CRITIQUE INITIALE:
${(themeAnalysis.criticalAnalysis || '').substring(0, 1000)}

SOURCES DISPONIBLES:
${sourceContext.substring(0, 4000)}

MISSION: Produis du contenu SUPPLÉMENTAIRE qui vient COMPLÉTER et APPROFONDIR la synthèse existante.

EXIGENCES ABSOLUES (tu DOIS les respecter):

1. expandedSynthesis (1500+ mots MINIMUM): Rédige une analyse COMPLÉMENTAIRE qui couvre:
   - L'ÉVOLUTION HISTORIQUE du sujet (origines, étapes clés, état actuel)
   - Une CRITIQUE MÉTHODOLOGIQUE détaillée (forces et faiblesses des approches utilisées dans les études)
   - Les PREUVES EMPIRIQUES avec des chiffres, données, résultats d'études spécifiques [Source X]
   - Les IMPLICATIONS THÉORIQUES et pratiques
   - Les PERSPECTIVES FUTURES et défis à relever
   - Les CONTROVERSES et débats académiques dans le domaine
   Utilise des paragraphes structurés avec sous-titres. Cite SYSTÉMATIQUEMENT les sources [Source X].

2. additionalAnalysis (400+ mots): Analyse critique supplémentaire:
   - Validité des méthodologies employées
   - Biais potentiels identifiés
   - Reproductibilité des résultats
   - Limites des études citées
   - Recommandations pour de futures recherches

3. additionalKeyPoints (6-10 items): Points supplémentaires non couverts dans l'analyse initiale.

JSON:
{
  "expandedSynthesis": "1500+ mots supplémentaires...",
  "additionalAnalysis": "400+ mots d'analyse critique supplémentaire...",
  "additionalKeyPoints": ["point 1 avec [Source X]", "point 2", ...]
}` }
            ],
            max_tokens: 8000,
            temperature: 0.25
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 120000
        });

        return this._parseJSON(response.data.choices[0].message.content);
    }

    // ============ PASS 2: Data Extraction ============
    async _extractDataAndFigures(themeAnalysis, sourceContext, apiKey) {
        const response = await axios.post(SAMBANOVA_API_URL, {
            model: MODEL,
            messages: [
                { role: 'system', content: 'Tu extrais des données structurées pour un mémoire. Crée des tableaux, des figures et des statistiques. Réponds en JSON.' },
                {
                    role: 'user', content: `Pour le thème "${themeAnalysis.theme}", crée des données visuelles académiques.

SYNTHÈSE DU THÈME:
${(themeAnalysis.synthesis || '').substring(0, 2000)}

SOURCES DISPONIBLES:
${sourceContext.substring(0, 3000)}

Crée:
1. TABLEAUX COMPARATIFS (markdown): Au moins 2 tableaux pertinents comparant approches, technologies, résultats, ou auteurs. Format markdown avec | et ---.

2. PROPOSITIONS DE FIGURES (descriptions textuelles): Décris 2-3 figures/graphiques pertinents avec leurs données, axes, légendes. (Ex: "Graphique en barres montrant la performance de X vs Y selon [Source 3]")

3. STATISTIQUES CLÉS: Chiffres, pourcentages, métriques extraits ou dérivés des sources.

4. DONNÉES COMPARATIVES (texte): Paragraphe de comparaison méthodique entre les approches étudiées.

JSON:
{
  "tables": [
    { "title": "Titre du tableau", "markdown": "| Col1 | Col2 | Col3 |\\n|---|---|---|\\n| val | val | val |" }
  ],
  "figures": [
    { "title": "Titre de la figure", "description": "Description détaillée du graphique/figure avec données", "type": "bar_chart|line_chart|pie_chart|diagram" }
  ],
  "statistics": [
    { "metric": "Nom de la métrique", "value": "Valeur", "source": "Source X" }
  ],
  "comparativeData": "Paragraphe comparatif..."
}` }
            ],
            max_tokens: 4000,
            temperature: 0.3
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 60000
        });

        return this._parseJSON(response.data.choices[0].message.content);
    }

    // ============ PASS 3: Cross-Theme Synthesis ============
    async _crossThemeSynthesis(themeAnalyses, mainTopic, apiKey) {
        const themeSummaries = themeAnalyses.map(t =>
            `Thème: ${t.theme}\nPoints clés: ${(t.keyPoints || []).join('; ')}\nMéthodos: ${(t.methodologies || []).join(', ')}`
        ).join('\n\n');

        const response = await axios.post(SAMBANOVA_API_URL, {
            model: MODEL,
            messages: [
                { role: 'system', content: 'Synthèse comparative inter-thèmes pour mémoire doctoral. Réponds en JSON.' },
                {
                    role: 'user', content: `SUJET: "${mainTopic}"

ANALYSES THÉMATIQUES:
${themeSummaries}

Produis une SYNTHÈSE COMPARATIVE INTER-THÈMES (400+ mots):
1. Comment les thèmes s'articulent entre eux
2. Les fils conducteurs transversaux
3. Les tensions/contradictions entre thèmes
4. Les synergies et complémentarités

JSON:
{
  "crossAnalysis": "Synthèse comparative de 400+ mots...",
  "interconnections": ["lien inter-thème 1", "lien 2", ...],
  "tensions": ["tension identifiée 1", ...]
}` }
            ],
            max_tokens: 4000,
            temperature: 0.3
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 60000
        });

        return this._parseJSON(response.data.choices[0].message.content);
    }

    // ============ PASS 4: Global Meta-Analysis ============
    async _globalMetaAnalysis(themeAnalyses, mainTopic, sourceContext, sourceCount, apiKey) {
        const themeSummaries = themeAnalyses.map(t =>
            `${t.theme}: ${(t.synthesis || '').substring(0, 400)}...\nCritique: ${(t.criticalAnalysis || '').substring(0, 200)}`
        ).join('\n\n');

        const response = await axios.post(SAMBANOVA_API_URL, {
            model: MODEL,
            messages: [
                { role: 'system', content: 'Tu es un directeur de thèse produisant une méta-analyse finale. Réponds en JSON.' },
                {
                    role: 'user', content: `SUJET: "${mainTopic}" | ${sourceCount} sources analysées

SYNTHÈSES THÉMATIQUES:
${themeSummaries}

Produis une MÉTA-ANALYSE de niveau directeur de thèse:

1. RÉSUMÉ GLOBAL (400+ mots): Vision d'ensemble du champ, tendances, maturité du domaine, principaux debates
2. LACUNES (5-8): Aspects manquants dans la littérature avec explications
3. CONTRADICTIONS (3-5): Points de tension entre les sources/approches
4. RECOMMANDATIONS (5-8): Directions de recherche concrètes
5. RECHERCHE FUTURE (200+ mots): Programme de recherche proposé
6. RÉFLEXION ÉPISTÉMOLOGIQUE (150+ mots): Positionnement épistémologique et limites des approches

JSON:
{
  "globalSummary": "400+ mots...",
  "gaps": ["lacune détaillée 1", ...],
  "contradictions": ["contradiction 1", ...],
  "recommendations": ["recommandation 1", ...],
  "futureResearch": "200+ mots sur la recherche future...",
  "epistemologicalReflection": "150+ mots..."
}` }
            ],
            max_tokens: 6000,
            temperature: 0.25
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 90000
        });

        return this._parseJSON(response.data.choices[0].message.content);
    }

    // ============ PASS 5: Overview Tables ============
    async _generateOverviewTables(themeAnalyses, sources, mainTopic, apiKey) {
        const sourceList = sources.map((s, i) =>
            `[${i + 1}] ${s.title} | Score: ${s.relevanceScore || 'N/A'} | Type: ${s.type || 'web'}`
        ).join('\n');

        const themeList = themeAnalyses.map(t => t.theme).join(', ');

        const response = await axios.post(SAMBANOVA_API_URL, {
            model: MODEL,
            messages: [
                { role: 'system', content: 'Crée des tableaux récapitulatifs en markdown pour un mémoire. Réponds en JSON.' },
                {
                    role: 'user', content: `SUJET: "${mainTopic}"
THÈMES: ${themeList}
SOURCES (${sources.length}):
${sourceList.substring(0, 3000)}

Crée 3 tableaux markdown récapitulatifs:

1. TABLEAU SYNTHÈSE: Résume chaque thème avec ses forces, faiblesses, et sources clés
2. TABLEAU MÉTHODOLOGIQUE: Compare les méthodologies utilisées dans les sources
3. MATRICE SOURCE-THÈME: Montre quelles sources couvrent quels thèmes (avec ✓ et ✗)

JSON:
{
  "summaryTable": "| Thème | Forces | Faiblesses | Sources clés |\\n|---|---|---|---|\\n...",
  "methodologyTable": "| Source | Méthodologie | Type | Résultats |\\n|---|---|---|---|\\n...",
  "sourceMatrix": "| Source | Thème1 | Thème2 | ... |\\n|---|---|---|---|\\n..."
}` }
            ],
            max_tokens: 4000,
            temperature: 0.3
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 60000
        });

        return this._parseJSON(response.data.choices[0].message.content);
    }

    // ============ Helpers ============
    _buildSourceContext(sources) {
        return sources.map((s, i) => {
            let entry = `[Source ${i + 1}] "${s.title}"`;
            entry += `\nURL: ${s.url}`;
            if (s.academicAnalysis) entry += `\nAnalyse: ${s.academicAnalysis}`;
            if (s.keyFindings && s.keyFindings.length > 0) entry += `\nDécouvertes: ${s.keyFindings.join(' ; ')}`;
            if (s.methodology) entry += `\nMéthodologie: ${s.methodology}`;
            entry += `\nContenu: ${(s.content || s.summary || '').substring(0, 1500)}`;
            return entry;
        }).join('\n\n---\n\n');
    }

    _parseJSON(content) {
        try {
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            return JSON.parse(jsonMatch ? jsonMatch[1] : content);
        } catch (e) {
            // Try to extract JSON from the content
            const start = content.indexOf('{');
            const end = content.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                try { return JSON.parse(content.substring(start, end + 1)); } catch (e2) { }
            }
            console.warn('JSON parse failed, returning raw');
            return { rawResponse: content };
        }
    }

    _fallbackTheme(themeNode) {
        return {
            theme: themeNode.label,
            synthesis: `Analyse en attente pour "${themeNode.label}".`,
            keyPoints: [`Concept lié à ${themeNode.label}`],
            sourcesUsed: [],
            criticalAnalysis: '',
            theoreticalFramework: '',
            reflectionPaths: [`Explorer ${themeNode.label} en profondeur`],
            methodologies: [],
            tables: [],
            figures: [],
            statistics: [],
            comparativeData: ''
        };
    }

    _mockSynthesis(sources, mindmap) {
        const themes = [];
        const nodes = mindmap.children || [mindmap];
        for (const node of nodes) {
            themes.push(this._fallbackTheme(node));
        }
        return {
            themes,
            globalSummary: `Synthèse de ${sources.length} sources — clé API requise pour analyse complète.`,
            gaps: ['Clé API requise'], contradictions: [], recommendations: ['Configurer SAMBANOVA_API_KEY ou TOGETHER_API_KEY dans .env'],
            futureResearch: '', epistemologicalReflection: '', crossAnalysis: '',
            interconnections: [], tensions: [], overviewTables: {}
        };
    }

    _delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

module.exports = { SynthesisAgent };
