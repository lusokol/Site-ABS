const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const { signToken } = require('../lib/token');
const { sendMagicLink } = require('../lib/email');
const { authenticate, authorize } = require('../middleware/auth');
const { isEmail } = require('../middleware/validate');
const rateLimit = require('../middleware/rate-limit');

const router = express.Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !user.password_hash) {
        return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
        return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const token = signToken(user);
    res.json({
        token,
        user: { id: user.id, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name },
    });
});

router.post('/invite', authenticate, authorize('admin'), async (req, res) => {
    const { email } = req.body;
    if (!email || !isEmail(email)) {
        return res.status(400).json({ error: 'Email invalide' });
    }

    const existing = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
    if (existing && existing.password_hash) {
        return res.status(409).json({ error: 'Ce membre a déjà un compte actif' });
    }

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
        res.json({ message: `Invitation envoyée à ${email}` });
    } catch (err) {
        console.error('Erreur envoi email:', err);
        res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });
    }
});

router.post('/set-password', async (req, res) => {
    const { token, password, first_name, last_name } = req.body;
    if (!token || !password) {
        return res.status(400).json({ error: 'Token et mot de passe requis' });
    }
    if (!first_name || !first_name.trim() || !last_name || !last_name.trim()) {
        return res.status(400).json({ error: 'Nom et prénom requis' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    const user = db.prepare('SELECT * FROM users WHERE invite_token = ?').get(token);
    if (!user) {
        return res.status(400).json({ error: 'Lien invalide ou expiré' });
    }
    if (new Date(user.invite_expires) < new Date()) {
        return res.status(400).json({ error: 'Ce lien a expiré, contactez l\'administrateur' });
    }

    const hash = await bcrypt.hash(password, 12);
    db.prepare('UPDATE users SET password_hash = ?, first_name = ?, last_name = ?, invite_token = NULL, invite_expires = NULL, updated_at = datetime(\'now\') WHERE id = ?')
        .run(hash, first_name.trim(), last_name.trim(), user.id);

    const jwt = signToken(user);
    res.json({
        message: 'Mot de passe défini avec succès',
        token: jwt,
        user: { id: user.id, email: user.email, role: user.role, first_name: first_name.trim(), last_name: last_name.trim() },
    });
});

router.get('/me', authenticate, (req, res) => {
    const user = db.prepare('SELECT id, email, role, first_name, last_name, phone, created_at, balance_cents, forfait_indiv_quota FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
});

router.post('/refresh', authenticate, (req, res) => {
    const token = signToken(req.user);
    res.json({ token });
});

module.exports = router;
