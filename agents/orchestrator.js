/**
 * Orchestrator — Iterative 2-Step Workflow with Stop Support
 * 
 * Step 1: runResearch() — Research agent only → sources populate in real-time
 * Step 2: runSynthesis() — User triggers after reviewing sources → Synthesis + Structure
 * stop() — Abort at any point
 */

const { ResearchAgent } = require('./researchAgent');
const { SynthesisAgent } = require('./synthesisAgent');
const { StructureAgent } = require('./structureAgent');
const { flattenNodes } = require('../utils/mindmapParser');

class Orchestrator {
    constructor() {
        this.researchAgent = new ResearchAgent();
        this.synthesisAgent = new SynthesisAgent();
        this.structureAgent = new StructureAgent();

        this._aborted = false;

        this.status = {
            phase: 'idle',
            currentAgent: null,
            progress: 0,
            logs: [],
            startedAt: null,
            completedAt: null,
            error: null
        };

        this.memoir = null;
        this.synthesisData = null;
        this.mindmapData = null;
        this.currentProjectId = null;
    }

    getStatus() {
        return { ...this.status };
    }

    getMemoir() {
        return {
            structure: this.memoir,
            synthesis: this.synthesisData
        };
    }

    /**
     * Abort whatever is currently running
     */
    stop() {
        this._aborted = true;
        // Signal agents to stop
        this.researchAgent._aborted = true;
        this.synthesisAgent._aborted = true;
        this.structureAgent._aborted = true;

        this.status.phase = 'stopped';
        this.status.currentAgent = null;
        this._log('⏹ Processus arrêté par l\'utilisateur.');
    }

    /**
     * Step 1: Run ONLY the research agent (with settings, per-project)
     */
    async runResearch(mindmapData, sourceStore, apiKey, settings = {}, projectId = null) {
        this.mindmapData = mindmapData;
        this.currentProjectId = projectId;
        this._aborted = false;
        this.researchAgent._aborted = false;

        this.status = {
            phase: 'research',
            currentAgent: 'ResearchAgent',
            progress: 0,
            logs: [{ time: new Date().toISOString(), message: `Lancement de la recherche pour "${mindmapData.label}"...` }],
            startedAt: new Date().toISOString(),
            completedAt: null,
            error: null,
            projectId: projectId,
            projectTitle: mindmapData.label || projectId
        };
        this.memoir = null;
        this.synthesisData = null;

        const onProgress = (data) => {
            if (this._aborted) return;
            this.status.progress = data.progress;
            this.status.logs.push({
                time: new Date().toISOString(),
                agent: data.agent,
                message: data.step
            });
        };

        try {
            const nodes = flattenNodes(mindmapData);

            await this.researchAgent.run(nodes, sourceStore, apiKey, onProgress, settings, projectId);

            if (this._aborted) return;

            // Apply relevance threshold filter (per project)
            const threshold = settings.relevanceThreshold || 0;
            if (threshold > 0 && projectId) {
                const projSources = sourceStore.getByProject(projectId);
                const removed = projSources.filter(s => (s.relevanceScore || 0) < threshold);
                for (const s of removed) {
                    sourceStore.remove(s.id);
                }
                if (removed.length > 0) {
                    this._log(`Filtre de pertinence: ${removed.length} sources sous le seuil de ${threshold} supprimées.`);
                }
            }

            const total = projectId ? sourceStore.getByProject(projectId).length : sourceStore.getAll().length;
            this._log(`Recherche terminée: ${total} sources collectées`);
            this._log('→ Vérifiez les sources dans l\'onglet "Sources", puis lancez la synthèse.');

            this.status.phase = 'research_done';
            this.status.currentAgent = null;
            this.status.progress = 100;

        } catch (err) {
            if (this._aborted) return;
            this.status.phase = 'error';
            this.status.error = err.message;
            this._log(`Erreur: ${err.message}`);
        }
    }

    /**
     * Step 2: Run Synthesis + Structure (for a specific project)
     */
    async runSynthesis(sourceStore, apiKey, projectId = null) {
        const mindmapData = this.mindmapData;
        if (!mindmapData) throw new Error('Aucune mindmap chargée.');

        const pid = projectId || this.currentProjectId;
        const sources = pid ? sourceStore.getByProject(pid) : sourceStore.getAll();
        if (sources.length === 0) throw new Error('Aucune source disponible pour ce projet.');

        this._aborted = false;
        this.synthesisAgent._aborted = false;
        this.structureAgent._aborted = false;

        const onProgress = (data) => {
            if (this._aborted) return;
            this.status.progress = data.progress;
            this.status.logs.push({
                time: new Date().toISOString(),
                agent: data.agent,
                message: data.step
            });
        };

        try {
            // Synthesis
            this.status.phase = 'synthesis';
            this.status.currentAgent = 'SynthesisAgent';
            this.status.progress = 0;
            this._log(`Phase Synthèse: Analyse approfondie de ${sources.length} sources...`);

            this.synthesisData = await this.synthesisAgent.run(sources, mindmapData, apiKey, onProgress);
            if (this._aborted) return;

            this._log('Synthèse terminée');

            // Structure
            this.status.phase = 'structure';
            this.status.currentAgent = 'StructureAgent';
            this.status.progress = 0;
            this._log('Phase Structuration: Génération du plan de mémoire...');

            this.memoir = await this.structureAgent.run(this.synthesisData, mindmapData, sources, apiKey, onProgress);
            if (this._aborted) return;

            this._log('Structure du mémoire générée');

            // Persist memoir data per project
            if (pid && sourceStore.setMemoirData) {
                sourceStore.setMemoirData(pid, {
                    structure: this.memoir,
                    synthesis: this.synthesisData,
                    generatedAt: new Date().toISOString()
                });
            }

            // Done
            this.status.phase = 'done';
            this.status.currentAgent = null;
            this.status.progress = 100;
            this.status.completedAt = new Date().toISOString();
            this._log('Mémoire complet ! Consultez la section Mémoire et téléchargez le PDF.');

        } catch (err) {
            if (this._aborted) return;
            this.status.phase = 'error';
            this.status.error = err.message;
            this._log(`Erreur: ${err.message}`);
        }
    }

    _log(message) {
        this.status.logs.push({ time: new Date().toISOString(), message });
    }
}

module.exports = { Orchestrator };
