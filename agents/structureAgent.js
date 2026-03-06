/**
 * Structure Agent — Doctoral-Level Memoir Structuration
 * 
 * Uses DeepSeek to generate a comprehensive academic memoir structure
 * with detailed section descriptions backed by source evidence.
 */

const axios = require('axios');
const { callLLM } = require('../utils/apiClient');

class StructureAgent {
    constructor() {
        this.name = 'StructureAgent';
        this.status = 'idle';
        this.progress = 0;
    }

    async run(synthesisData, mindmap, sources, apiKey, onProgress) {
        this.status = 'running';
        this.progress = 0;

        if (!process.env.GEMINI_API_KEY) {
            onProgress && onProgress({ agent: this.name, step: 'Mode démo — structure générique', progress: 50 });
            const result = this._mockStructure(synthesisData, mindmap, sources);
            this.status = 'done';
            this.progress = 100;
            onProgress && onProgress({ agent: this.name, step: 'Structure générée (démo)', progress: 100 });
            return result;
        }

        try {
            onProgress && onProgress({ agent: this.name, step: 'Génération de la structure du mémoire...', progress: 10 });

            // Build rich context from synthesis
            const synthesisText = JSON.stringify(synthesisData, null, 2);

            // Build source bibliography
            const bibliography = sources.map((s, i) =>
                `[${i + 1}] ${s.title}${s.url ? ' — ' + s.url : ''}${s.academicAnalysis ? '\n    Analyse: ' + s.academicAnalysis.substring(0, 200) : ''}`
            ).join('\n');

            const prompt = `Tu es un étudiant de Master 2 très rigoureux qui rédige le plan détaillé de son mémoire, guidé par une logique implacable et un véritable "fil conducteur".

SUJET: ${mindmap.label}

SYNTHÈSE DE RECHERCHE (${sources.length} sources analysées):
${synthesisText.substring(0, 15000)}

BIBLIOGRAPHIE:
${bibliography.substring(0, 5000)}

Propose une structure de mémoire COMPLÈTE et DÉTAILLÉE. Le ton doit être académique mais humain, naturel, et surtout cohérent.

EXIGENCES:
- Chaque section doit avoir une description SUBSTANTIELLE (100+ mots) rédigée comme de vrais paragraphes (pas une simple liste de mots-clés). Explique précisément ce qu'elle contiendra et son rôle dans la démonstration globale.
- Les sous-sections doivent être détaillées et s'enchaîner logiquement (il faut qu'on sente un vrai cheminement de pensée).
- Intègre tes sources de façon fluide et naturelle [Source X] au fil de ton argumentation, sans que ça ne ressemble à un catalogue.
- La problématique doit être formulée comme une vraie question de recherche humaine et motivée.
- Estimer le nombre de pages par section.

Réponds en JSON:
{
  "title": "Titre académique complet du mémoire",
  "problemStatement": "Problématique formulée comme question de recherche",
  "sections": [
    {
      "number": "1",
      "title": "Titre de la section",
      "description": "Description détaillée de 100+ mots de ce que contient cette section, avec références [Source X]",
      "estimatedPages": 5,
      "subsections": [
        {
          "number": "1.1",
          "title": "Sous-section",
          "description": "Description détaillée avec contenu attendu",
          "relatedSources": [1, 2, 3]
        }
      ]
    }
  ],
  "methodology": "Description détaillée de la méthodologie de recherche (100+ mots)",
  "estimatedPages": 80,
  "keyContributions": ["contribution 1", "contribution 2"]
}`;

            onProgress && onProgress({ agent: this.name, step: 'Attente de la réponse Gemini...', progress: 40 });

            const response = await callLLM({
                label: 'Memoir structure',
                maxTokens: 8000,
                temperature: 0.3,
                timeout: 90000,
                messages: [
                    { role: 'system', content: 'Tu es un expert en rédaction académique. Tu conçois des plans de mémoire fluides, logiques et rédigés de manière très humaine, comme le ferait un brillant étudiant. Réponds en JSON valide.' },
                    { role: 'user', content: prompt }
                ]
            });

            onProgress && onProgress({ agent: this.name, step: 'Traitement de la structure...', progress: 80 });

            const content = response;
            let structureData;
            try {
                const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
                structureData = JSON.parse(jsonMatch ? jsonMatch[1] : content);
            } catch (e) {
                structureData = this._mockStructure(synthesisData, mindmap, sources);
                structureData.rawResponse = content;
            }

            this.status = 'done';
            this.progress = 100;
            onProgress && onProgress({ agent: this.name, step: 'Structure du mémoire complète', progress: 100 });

            return structureData;

        } catch (err) {
            console.error('Structure API error:', err.message);
            onProgress && onProgress({ agent: this.name, step: `Erreur API — structure de secours`, progress: 50 });
            const result = this._mockStructure(synthesisData, mindmap, sources);
            this.status = 'done';
            this.progress = 100;
            return result;
        }
    }

    _mockStructure(synthesisData, mindmap, sources) {
        const themes = synthesisData.themes || [];
        const stateOfArtSubsections = themes.map((theme, i) => ({
            number: `2.${i + 1}`,
            title: theme.theme,
            description: theme.synthesis || `Analyse approfondie de ${theme.theme}`,
            relatedSources: theme.sourcesUsed || []
        }));

        return {
            title: `Étude et analyse : ${mindmap.label}`,
            problemStatement: `Comment optimiser et structurer une approche innovante dans le domaine de "${mindmap.label}" ?`,
            sections: [
                {
                    number: '1', title: 'Introduction', estimatedPages: 8,
                    description: 'Présentation du contexte, de la problématique et de la méthodologie.',
                    subsections: [
                        { number: '1.1', title: 'Contexte et motivations', description: `Présentation du domaine "${mindmap.label}".`, relatedSources: [] },
                        { number: '1.2', title: 'Problématique', description: 'Question de recherche.', relatedSources: [] },
                        { number: '1.3', title: 'Méthodologie', description: 'Approche méthodologique.', relatedSources: [] }
                    ]
                },
                {
                    number: '2', title: 'État de l\'art', estimatedPages: 25,
                    description: 'Revue de la littérature.',
                    subsections: stateOfArtSubsections.length > 0 ? stateOfArtSubsections : [
                        { number: '2.1', title: 'Concepts fondamentaux', description: 'Définitions clés.', relatedSources: [] }
                    ]
                },
                {
                    number: '3', title: 'Proposition de solution', estimatedPages: 15,
                    description: 'Approche innovante.',
                    subsections: [
                        { number: '3.1', title: 'Architecture proposée', description: 'Solution technique.', relatedSources: [] },
                        { number: '3.2', title: 'Aspects innovants', description: 'Contributions originales.', relatedSources: [] }
                    ]
                },
                {
                    number: '4', title: 'Implémentation et résultats', estimatedPages: 15,
                    description: 'Mise en œuvre et résultats.',
                    subsections: [
                        { number: '4.1', title: 'Cas d\'étude', description: 'Contexte d\'application.', relatedSources: [] },
                        { number: '4.2', title: 'Résultats', description: 'Analyse des résultats.', relatedSources: [] }
                    ]
                },
                {
                    number: '5', title: 'Discussion et critique', estimatedPages: 10,
                    description: 'Analyse critique.',
                    subsections: [
                        { number: '5.1', title: 'Forces', description: 'Avantages.', relatedSources: [] },
                        { number: '5.2', title: 'Limites', description: 'Limitations.', relatedSources: [] }
                    ]
                },
                {
                    number: '6', title: 'Conclusion', estimatedPages: 5,
                    description: 'Synthèse et perspectives.',
                    subsections: []
                }
            ],
            methodology: 'Approche mixte avec revue systématique et prototype.',
            estimatedPages: 78,
            keyContributions: ['Analyse approfondie de la littérature', 'Proposition de solution innovante']
        };
    }
}

module.exports = { StructureAgent };
