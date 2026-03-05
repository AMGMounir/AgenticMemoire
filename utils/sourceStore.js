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
        return rows.map(p => ({
            id: p.id,
            title: p.title,
            createdAt: p.created_at,
            sourceCount: this._stmts.countByProject.get(p.id).count,
            hasMindmap: !!p.mindmap_data,
            hasMemoir: !!p.memoir_data
        }));
    }

    getProject(projectId) {
        const row = this._stmts.getProject.get(projectId);
        if (!row) return null;
        return {
            ...row,
            mindmapData: row.mindmap_data ? JSON.parse(row.mindmap_data) : null,
            memoirData: row.memoir_data ? JSON.parse(row.memoir_data) : null,
            sources: this._stmts.getByProject.all(projectId).map(s => this._deserializeSource(s))
        };
    }

    ensureProject(projectId, title) {
        this._stmts.insertProject.run(
            projectId, null, title || projectId, null, null, new Date().toISOString()
        );
        return this.getProject(projectId);
    }

    setMindmapData(projectId, mindmapData) {
        this._stmts.updateMindmap.run(JSON.stringify(mindmapData), projectId);
    }

    setMemoirData(projectId, memoirData) {
        this._stmts.updateMemoir.run(JSON.stringify(memoirData), projectId);
    }

    getMemoirData(projectId) {
        const row = this._stmts.getProject.get(projectId);
        return row && row.memoir_data ? JSON.parse(row.memoir_data) : null;
    }

    removeProject(projectId) {
        this._stmts.deleteProject.run(projectId); // CASCADE deletes sources
    }

    // ========== SOURCE MANAGEMENT ==========

    _deserializeSource(row) {
        return {
            id: row.id,
            projectId: row.project_id,
            title: row.title,
            url: row.url,
            summary: row.summary,
            content: row.content,
            relevanceScore: row.relevance_score,
            relatedNodes: JSON.parse(row.related_nodes || '[]'),
            addedAt: row.added_at,
            type: row.type,
            keyFindings: JSON.parse(row.key_findings || '[]'),
            methodology: row.methodology
        };
    }

    getByProject(projectId) {
        return this._stmts.getByProject.all(projectId).map(s => this._deserializeSource(s));
    }

    getAll() {
        return this._stmts.getAllSources.all().map(s => this._deserializeSource(s));
    }

    getById(id) {
        const row = this._stmts.getSourceById.get(id);
        return row ? this._deserializeSource(row) : null;
    }

    add(sourceData, projectId = null) {
        const id = `src_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const pid = projectId || '_default';

        // Ensure project exists
        if (!this._stmts.getProject.get(pid)) {
            this.ensureProject(pid, pid === '_default' ? 'Projet par défaut' : pid);
        }

        this._stmts.insertSource.run(
            id, pid,
            sourceData.title || 'Untitled',
            sourceData.url || '',
            sourceData.summary || '',
            sourceData.content || '',
            sourceData.relevanceScore || 0,
            JSON.stringify(sourceData.relatedNodes || []),
            new Date().toISOString(),
            sourceData.type || 'web',
            JSON.stringify(sourceData.keyFindings || []),
            sourceData.methodology || ''
        );

        return this.getById(id);
    }

    addMany(sourcesArray, projectId = null) {
        const addTx = db.transaction((sources) => {
            return sources.map(s => this.add(s, projectId));
        });
        return addTx(sourcesArray);
    }

    update(id, updates) {
        const existing = this.getById(id);
        if (!existing) throw new Error(`Source ${id} not found`);

        const merged = { ...existing, ...updates };
        this._stmts.updateSource.run(
            merged.title, merged.url, merged.summary, merged.content,
            merged.relevanceScore,
            JSON.stringify(merged.relatedNodes || []),
            merged.type,
            JSON.stringify(merged.keyFindings || []),
            merged.methodology,
            id
        );
        return this.getById(id);
    }

    remove(id) {
        const result = this._stmts.deleteSource.run(id);
        if (result.changes === 0) throw new Error(`Source ${id} not found`);
    }

    clearProject(projectId) {
        this._stmts.clearProjectSources.run(projectId);
    }

    clearAll() {
        db.exec('DELETE FROM sources');
    }
}

module.exports = { SourceStore };
