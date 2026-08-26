const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { isEmail, isIn, sanitize } = require('../middleware/validate');
const { sendMagicLink } = require('../lib/email');

const router = express.Router();

router.get('/', authenticate, authorize('admin'), (req, res) => {
    const members = db.prepare(`
        SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.phone, u.created_at,
            u.balance_cents, u.forfait_indiv_quota,
            u.password_hash IS NOT NULL AS has_password,
            (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id AND b.status = 'confirmed') AS total_bookings,
            (SELECT COALESCE(SUM(s.price_cents), 0) FROM bookings b JOIN slots s ON s.id = b.slot_id
                WHERE b.user_id = u.id AND b.status = 'confirmed' AND b.payment_method = 'cash' AND b.payment_status = 'pending'
            ) AS cash_pending_cents,
            (SELECT COUNT(*) FROM bookings b JOIN slots s ON s.id = b.slot_id
                WHERE b.user_id = u.id AND b.status = 'confirmed' AND s.audience = 'forfait_indiv'
            ) AS forfait_indiv_used
        FROM users u
        ORDER BY u.last_name, u.first_name, u.email
    `).all();
    res.json(members);
});

router.get('/:id', authenticate, authorize('admin'), (req, res) => {
    const member = db.prepare('SELECT id, email, role, first_name, last_name, phone, created_at FROM users WHERE id = ?')
        .get(req.params.id);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });

    const bookings = db.prepare(`
        SELECT b.*, s.date, s.start_time, s.duration_min, s.location, s.price_cents
        FROM bookings b JOIN slots s ON s.id = b.slot_id
        WHERE b.user_id = ?
        ORDER BY s.date DESC
    `).all(req.params.id);

    res.json({ ...member, bookings });
});

router.patch('/:id', authenticate, authorize('admin'), (req, res) => {
    const { role, first_name, last_name, phone, forfait_indiv_quota } = req.body;
    const member = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });

    if (role && !isIn(role, ['admin', 'prof', 'member'])) {
        return res.status(400).json({ error: 'Rôle invalide' });
    }

    // Quota : null = retirer le tag, entier >=0 = poser le tag avec ce quota
    let quotaValue = undefined;
    if (forfait_indiv_quota !== undefined) {
        if (forfait_indiv_quota === null || forfait_indiv_quota === '') {
            quotaValue = null;
        } else {
            const q = Number(forfait_indiv_quota);
            if (!Number.isInteger(q) || q < 0 || q > 1000) {
                return res.status(400).json({ error: 'Quota invalide (0-1000)' });
            }
            quotaValue = q;
        }
    }

    db.prepare(`
        UPDATE users SET
            role = COALESCE(?, role),
            first_name = COALESCE(?, first_name),
            last_name = COALESCE(?, last_name),
            phone = COALESCE(?, phone),
            forfait_indiv_quota = CASE WHEN ? = 1 THEN ? ELSE forfait_indiv_quota END,
            updated_at = datetime('now')
        WHERE id = ?
    `).run(
        role || null,
        first_name ? sanitize(first_name) : null,
        last_name ? sanitize(last_name) : null,
        phone ? sanitize(phone) : null,
        quotaValue !== undefined ? 1 : 0,
        quotaValue !== undefined ? quotaValue : null,
        req.params.id
    );

    const updated = db.prepare('SELECT id, email, role, first_name, last_name, phone, forfait_indiv_quota FROM users WHERE id = ?')
        .get(req.params.id);
    res.json(updated);
});

router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
    const member = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.params.id);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });
    if (member.id === req.user.id) {
        return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    db.prepare('DELETE FROM bookings WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ message: `Membre ${member.email} supprimé` });
});

router.post('/bulk-invite', authenticate, authorize('admin'), async (req, res) => {
    const { emails } = req.body;
    if (!Array.isArray(emails) || !emails.length) {
        return res.status(400).json({ error: 'Liste d\'emails requise' });
    }

    const results = { invited: [], already_member: [], already_invited: [] };

    for (const raw of emails) {
        const email = raw.trim().toLowerCase();
        if (!email || !isEmail(email)) continue;

        const existing = db.prepare('SELECT id, email, password_hash, invite_token FROM users WHERE email = ?').get(email);
        if (existing && existing.password_hash) {
            results.already_member.push(email);
        } else if (existing && existing.invite_token) {
            results.already_invited.push(email);
        } else {
            const token = uuidv4();
            const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            if (existing) {
                db.prepare('UPDATE users SET invite_token = ?, invite_expires = ?, updated_at = datetime(\'now\') WHERE id = ?')
                    .run(token, expires, existing.id);
            } else {
                db.prepare('INSERT INTO users (email, invite_token, invite_expires) VALUES (?, ?, ?)')
                    .run(email, token, expires);
            }
            try {
                await sendMagicLink(email, token);
                results.invited.push(email);
            } catch (err) {
                console.error('Erreur envoi email:', email, err);
            }
        }
    }

    res.json(results);
});

router.post('/bulk-reinvite', authenticate, authorize('admin'), async (req, res) => {
    const { emails } = req.body;
    if (!Array.isArray(emails) || !emails.length) {
        return res.status(400).json({ error: 'Liste d\'emails requise' });
    }

    const reinvited = [];
    for (const email of emails) {
        const member = db.prepare('SELECT id, email FROM users WHERE email = ? AND password_hash IS NULL').get(email.trim().toLowerCase());
        if (!member) continue;

        const token = uuidv4();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        db.prepare('UPDATE users SET invite_token = ?, invite_expires = ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(token, expires, member.id);
        try {
            await sendMagicLink(member.email, token);
            reinvited.push(member.email);
        } catch (err) {
            console.error('Erreur envoi email:', member.email, err);
        }
    }

    res.json({ reinvited });
});

router.post('/:id/reinvite', authenticate, authorize('admin'), async (req, res) => {
    const member = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.params.id);
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });

    const token = uuidv4();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare('UPDATE users SET invite_token = ?, invite_expires = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(token, expires, member.id);

    try {
        await sendMagicLink(member.email, token);
        res.json({ message: `Invitation renvoyée à ${member.email}` });
    } catch (err) {
        console.error('Erreur envoi email:', err);
        res.status(500).json({ error: 'Erreur lors de l\'envoi' });
    }
});

module.exports = router;
