/**
 * User Store — SQLite-backed user persistence
 * Supports Google Sign-In and email/password authentication.
 */

const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

class UserStore {
    constructor() {
        // Prepared statements for performance
        this._stmts = {
            findById: db.prepare('SELECT * FROM users WHERE id = ?'),
            findByGoogleId: db.prepare('SELECT * FROM users WHERE google_id = ?'),
            findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
            insert: db.prepare(`
                INSERT INTO users (id, google_id, email, username, password_hash, profile_picture, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `),
            updateProfile: db.prepare(`
                UPDATE users SET username = ?, profile_picture = ?, updated_at = ? WHERE id = ?
            `),
            deleteUser: db.prepare('DELETE FROM users WHERE id = ?')
        };
    }

    findById(userId) {
        return this._stmts.findById.get(userId) || null;
    }

    findByGoogleId(googleId) {
        return this._stmts.findByGoogleId.get(googleId) || null;
    }

    findByEmail(email) {
        return this._stmts.findByEmail.get(email.toLowerCase()) || null;
    }

    createFromGoogle(profile) {
        const id = uuidv4();
        const now = new Date().toISOString();
        this._stmts.insert.run(
            id,
            profile.sub,
            (profile.email || '').toLowerCase(),
            profile.name || profile.email.split('@')[0],
            null, // no password for Google users
            profile.picture || '',
            now, now
        );
        return this.findById(id);
    }

    createWithEmail(email, username, password) {
        const existing = this.findByEmail(email);
        if (existing) throw new Error('Un compte avec cet email existe déjà');

        const id = uuidv4();
        const now = new Date().toISOString();
        const hash = bcrypt.hashSync(password, 10);
        this._stmts.insert.run(id, null, email.toLowerCase(), username, hash, '', now, now);
        return this.findById(id);
    }

    verifyPassword(email, password) {
        const user = this.findByEmail(email);
        if (!user) return null;
        if (!user.password_hash) return null; // Google-only user
        if (!bcrypt.compareSync(password, user.password_hash)) return null;
        return user;
    }

    updateProfile(userId, updates) {
        const user = this.findById(userId);
        if (!user) throw new Error('User not found');

        const username = updates.username !== undefined ? updates.username : user.username;
        const profilePicture = updates.profilePicture !== undefined ? updates.profilePicture : user.profile_picture;
        const now = new Date().toISOString();

        this._stmts.updateProfile.run(username, profilePicture, now, userId);
        return this.findById(userId);
    }

    deleteUser(userId) {
        const result = this._stmts.deleteUser.run(userId);
        if (result.changes === 0) throw new Error('User not found');
    }

    // Sanitize user object for API responses (strip password_hash)
    sanitize(user) {
        if (!user) return null;
        const { password_hash, ...safe } = user;
        return safe;
    }
}

module.exports = { UserStore };
