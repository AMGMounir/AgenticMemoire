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
                INSERT INTO users (id, google_id, email, username, password_hash, profile_picture, credits, is_premium, has_payment_method, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 50, 0, 0, ?, ?)
            `),
            updateProfile: db.prepare(`
                UPDATE users SET username = ?, profile_picture = ?, updated_at = ? WHERE id = ?
            `),
            updateCredits: db.prepare(`
                UPDATE users SET credits = credits - ?, updated_at = ? WHERE id = ?
            `),
            addCredits: db.prepare(`
                UPDATE users SET credits = credits + ?, updated_at = ? WHERE id = ?
            `),
            setPremium: db.prepare(`
                UPDATE users SET is_premium = ?, premium_until = ?, subscription_status = ?, updated_at = ? WHERE id = ?
            `),
            cancelPremium: db.prepare(`
                UPDATE users SET subscription_status = 'canceling', updated_at = ? WHERE id = ?
            `),
            updatePaymentMethod: db.prepare(`
                UPDATE users SET has_payment_method = ?, updated_at = ? WHERE id = ?
            `),
            deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),

            insertTransaction: db.prepare(`
                INSERT INTO transactions (id, user_id, type, amount, credits_changed, description, receipt_url, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `),
            getTransactions: db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC')
        };
    }

    _evaluatePremium(user) {
        if (!user) return null;
        if (user.is_premium === 1 && user.premium_until) {
            if (new Date() > new Date(user.premium_until)) {
                // Expired!
                user.is_premium = 0;
                user.subscription_status = 'expired';
                // Technically we should update DB here to be completely correct, 
                // but doing it in memory is enough to gate access.
                const now = new Date().toISOString();
                db.prepare("UPDATE users SET is_premium = 0, subscription_status = 'expired', updated_at = ? WHERE id = ?").run(now, user.id);
            }
        }
        return user;
    }

    findById(userId) {
        return this._evaluatePremium(this._stmts.findById.get(userId) || null);
    }

    findByGoogleId(googleId) {
        return this._evaluatePremium(this._stmts.findByGoogleId.get(googleId) || null);
    }

    findByEmail(email) {
        return this._evaluatePremium(this._stmts.findByEmail.get(email.toLowerCase()) || null);
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

    deductCredits(userId, amount) {
        const user = this.findById(userId);
        if (!user || user.credits < amount) throw new Error('Crédits insuffisants');
        const now = new Date().toISOString();
        this._stmts.updateCredits.run(amount, now, userId);
        return this.findById(userId);
    }

    addCredits(userId, amount) {
        const now = new Date().toISOString();
        this._stmts.addCredits.run(amount, now, userId);
        return this.findById(userId);
    }

    setPremium(userId, isPremium) {
        const now = new Date().toISOString();
        let premiumUntil = null;
        let subStatus = 'inactive';
        if (isPremium) {
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            premiumUntil = nextMonth.toISOString();
            subStatus = 'active';
        }
        this._stmts.setPremium.run(isPremium ? 1 : 0, premiumUntil, subStatus, now, userId);
        return this.findById(userId);
    }

    cancelPremium(userId) {
        const now = new Date().toISOString();
        this._stmts.cancelPremium.run(now, userId);
        return this.findById(userId);
    }

    updatePaymentMethod(userId, hasMethod) {
        const now = new Date().toISOString();
        this._stmts.updatePaymentMethod.run(hasMethod ? 1 : 0, now, userId);
        return this.findById(userId);
    }

    setStripeCustomerId(userId, stripeCustomerId) {
        const now = new Date().toISOString();
        // Dynamic prepare is fine here since it's a one-off update not defined in constructor
        db.prepare('UPDATE users SET stripe_customer_id = ?, updated_at = ? WHERE id = ?').run(stripeCustomerId, now, userId);
        return this.findById(userId);
    }

    deleteUser(userId) {
        const result = this._stmts.deleteUser.run(userId);
        if (result.changes === 0) throw new Error('User not found');
    }

    addTransaction(userId, type, amount, creditsChanged, description, receiptUrl = null) {
        const id = uuidv4();
        const now = new Date().toISOString();
        this._stmts.insertTransaction.run(id, userId, type, amount, creditsChanged, description, receiptUrl, now);
        return id;
    }

    getTransactionsByUserId(userId) {
        return this._stmts.getTransactions.all(userId);
    }

    // Sanitize user object for API responses (strip password_hash)
    sanitize(user) {
        if (!user) return null;
        const { password_hash, ...safe } = user;
        return safe;
    }
}

module.exports = { UserStore };
