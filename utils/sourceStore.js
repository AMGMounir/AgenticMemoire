/**
 * Source Store — SQLite-backed, project-based storage
 * Sources are grouped by project. Each project persists independently.
 */

const db = require('./database');

class SourceStore {
    constructor() {
        this._stmts = {
            // Projects
            getProjects: db.prepare(`
                SELECT id, user_id, title, mindmap_data, memoir_data, created_at
                FROM projects ORDER BY created_at DESC
            `),
            getProject: db.prepare('SELECT * FROM projects WHERE id = ?'),
            insertProject: db.prepare(`
                INSERT OR IGNORE INTO projects (id, user_id, title, mindmap_data, memoir_data, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `),
            updateMindmap: db.prepare('UPDATE projects SET mindmap_data = ? WHERE id = ?'),
            updateMemoir: db.prepare('UPDATE projects SET memoir_data = ? WHERE id = ?'),
            deleteProject: db.prepare('DELETE FROM projects WHERE id = ?'),

            // Sources
            getByProject: db.prepare('SELECT * FROM sources WHERE project_id = ? ORDER BY added_at DESC'),
            getAllSources: db.prepare('SELECT * FROM sources ORDER BY added_at DESC'),
            getSourceById: db.prepare('SELECT * FROM sources WHERE id = ?'),
            insertSource: db.prepare(`
                INSERT INTO sources (id, project_id, title, url, summary, content, relevance_score, related_nodes, added_at, type, key_findings, methodology)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `),
            updateSource: db.prepare(`
                UPDATE sources SET title=?, url=?, summary=?, content=?, relevance_score=?, related_nodes=?, type=?, key_findings=?, methodology=?
                WHERE id = ?
            `),
            deleteSource: db.prepare('DELETE FROM sources WHERE id = ?'),
            clearProjectSources: db.prepare('DELETE FROM sources WHERE project_id = ?'),
            countByProject: db.prepare('SELECT COUNT(*) as count FROM sources WHERE project_id = ?')
        };
    }

    static slugify(text) {
        return text
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 60) || 'untitled';
    }

    // ========== PROJECT MANAGEMENT ==========

    getProjects() {
        const rows = this._stmts.getProjects.all();
        return rows.map(r => ({
            id: r.id,
            title: r.title,
            createdAt: r.created_at,
            sourceCount: this._stmts.countByProject.get(r.id).count,
            mindmapData: r.mindmap_data ? JSON.parse(r.mindmap_data) : null,
            memoirData: r.memoir_data ? JSON.parse(r.memoir_data) : null
        }));
    }

    getProject(projectId) {
        const r = this._stmts.getProject.get(projectId);
        if (!r) return null;
        return {
            id: r.id,
            title: r.title,
            createdAt: r.created_at,
            sourceCount: this._stmts.countByProject.get(r.id).count,
            mindmapData: r.mindmap_data ? JSON.parse(r.mindmap_data) : null,
            memoirData: r.memoir_data ? JSON.parse(r.memoir_data) : null
        };
    }

    ensureProject(projectId, title, userId = null) {
        const now = new Date().toISOString();
        this._stmts.insertProject.run(projectId, userId, title, null, null, now);
        return this.getProject(projectId);
    }

    setMindmapData(projectId, mindmapData) {
        this._stmts.updateMindmap.run(JSON.stringify(mindmapData), projectId);
    }

    setMemoirData(projectId, memoirData) {
        this._stmts.updateMemoir.run(JSON.stringify(memoirData), projectId);
    }

    getMemoirData(projectId) {
        const proj = this.getProject(projectId);
        return proj ? proj.memoirData : null;
    }

    removeProject(projectId) {
        // Cascades to sources automatically due to Foreign Key ON DELETE CASCADE
        this._stmts.deleteProject.run(projectId);
    }

    clearProject(projectId) {
        this._stmts.clearProjectSources.run(projectId);
    }

    // ========== SOURCE MANAGEMENT ==========

    _formatSourceRow(r) {
        if (!r) return null;
        return {
            id: r.id,
            projectId: r.project_id,
            title: r.title,
            url: r.url,
            summary: r.summary,
            content: r.content,
            relevanceScore: r.relevance_score,
            relatedNodes: JSON.parse(r.related_nodes),
            addedAt: r.added_at,
            type: r.type,
            keyFindings: JSON.parse(r.key_findings),
            methodology: r.methodology
        };
    }

    getAll() {
        const rows = this._stmts.getAllSources.all();
        return rows.map(r => this._formatSourceRow(r));
    }

    getByProject(projectId) {
        const rows = this._stmts.getByProject.all(projectId);
        return rows.map(r => this._formatSourceRow(r));
    }

    add(sourceData, projectId) {
        if (!projectId) {
            projectId = 'default';
            this.ensureProject(projectId, 'Default Project');
        } else {
            this.ensureProject(projectId, sourceData.projectTitle || projectId);
        }

        const addedAt = sourceData.addedAt || new Date().toISOString();
        const id = sourceData.id || `src_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const relatedNodes = JSON.stringify(sourceData.relatedNodes || []);
        const keyFindings = JSON.stringify(sourceData.keyFindings || []);

        this._stmts.insertSource.run(
            id,
            projectId,
            sourceData.title || 'Source sans titre',
            sourceData.url || '',
            sourceData.summary || '',
            sourceData.content || '',
            sourceData.relevanceScore || 0,
            relatedNodes,
            addedAt,
            sourceData.type || 'web',
            keyFindings,
            sourceData.methodology || ''
        );

        return this._formatSourceRow(this._stmts.getSourceById.get(id));
    }

    update(id, updates) {
        const existing = this._formatSourceRow(this._stmts.getSourceById.get(id));
        if (!existing) return null;

        const merged = { ...existing, ...updates };

        this._stmts.updateSource.run(
            merged.title,
            merged.url,
            merged.summary,
            merged.content,
            merged.relevanceScore,
            JSON.stringify(merged.relatedNodes),
            merged.type,
            JSON.stringify(merged.keyFindings),
            merged.methodology,
            id
        );

        return this._formatSourceRow(this._stmts.getSourceById.get(id));
    }

    remove(id) {
        this._stmts.deleteSource.run(id);
    }
}

module.exports = { SourceStore };