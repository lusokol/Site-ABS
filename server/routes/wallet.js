const express = require('express');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { createTopupIntent } = require('../lib/helloasso');

const router = express.Router();

const TOPUP_MIN_CENTS = 100;   // 1 €
const TOPUP_MAX_CENTS = 50000; // 500 €

function fetchHistory(userId) {
    return db.prepare(`
        SELECT wt.*,
            s.date AS slot_date, s.start_time AS slot_time, s.location AS slot_location,
            au.email AS admin_email
        FROM wallet_transactions wt
        LEFT JOIN bookings b ON b.id = wt.booking_id
        LEFT JOIN slots s ON s.id = b.slot_id
        LEFT JOIN users au ON au.id = wt.admin_user_id
        WHERE wt.user_id = ?
        ORDER BY wt.created_at DESC, wt.id DESC
    `).all(userId);
}

function fetchBalance(userId) {
    const row = db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId);
    return row ? row.balance_cents : 0;
}

// GET /api/wallet/me — solde + historique du membre connecté
router.get('/me', authenticate, (req, res) => {
    res.json({
        balance_cents: fetchBalance(req.user.id),
        transactions: fetchHistory(req.user.id),
    });
});

// GET /api/wallet/:userId — admin : n'importe quel membre
router.get('/:userId', authenticate, authorize('admin'), (req, res) => {
    const userId = Number(req.params.userId);
    const user = db.prepare('SELECT id, email, first_name, last_name FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'Membre introuvable' });

    res.json({
        user,
        balance_cents: fetchBalance(userId),
        transactions: fetchHistory(userId),
    });
});

// POST /api/wallet/topup — créer un checkout HelloAsso pour recharger son solde
router.post('/topup', authenticate, async (req, res) => {
    const amount = Number(req.body.amount_cents);
    if (!Number.isInteger(amount) || amount < TOPUP_MIN_CENTS || amount > TOPUP_MAX_CENTS) {
        return res.status(400).json({
            error: `Montant invalide (entre ${TOPUP_MIN_CENTS / 100} € et ${TOPUP_MAX_CENTS / 100} €)`,
        });
    }

    try {
        const checkout = await createTopupIntent(req.user.id, req.user.email, amount);
        // On enregistre une transaction "en attente" (amount_cents = 0 pour ne pas fausser le solde)
        // qui sera finalisée par le webhook. Le checkout_id permet le lien.
        db.prepare(`
            INSERT INTO wallet_transactions (user_id, amount_cents, reason, helloasso_checkout_id, note)
            VALUES (?, 0, 'topup', ?, ?)
        `).run(req.user.id, checkout.id, `Rechargement en attente (${(amount / 100).toFixed(2).replace('.', ',')} €)`);

        res.json({ checkout_url: checkout.redirectUrl });
    } catch (err) {
        console.error('Erreur topup HelloAsso:', err);
        res.status(500).json({ error: 'Erreur lors de la création du paiement' });
    }
});

// POST /api/wallet/:userId/adjust — admin : ajustement manuel (+ ou -)
router.post('/:userId/adjust', authenticate, authorize('admin'), (req, res) => {
    const userId = Number(req.params.userId);
    const amount = Number(req.body.amount_cents);
    const note = (req.body.note || '').trim();

    if (!Number.isInteger(amount) || amount === 0) {
        return res.status(400).json({ error: 'Montant invalide (doit être un entier non nul en centimes)' });
    }
    if (!note) {
        return res.status(400).json({ error: 'Une note explicative est requise' });
    }

    const user = db.prepare('SELECT id, balance_cents FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'Membre introuvable' });

    if (user.balance_cents + amount < 0) {
        return res.status(400).json({ error: 'Solde insuffisant pour ce débit' });
    }

    const applyAdjustment = db.transaction(() => {
        db.prepare('UPDATE users SET balance_cents = balance_cents + ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(amount, userId);
        db.prepare(`
            INSERT INTO wallet_transactions (user_id, amount_cents, reason, admin_user_id, note)
            VALUES (?, ?, 'admin_adjustment', ?, ?)
        `).run(userId, amount, req.user.id, note);
    });
    applyAdjustment();

    res.json({
        balance_cents: fetchBalance(userId),
        message: 'Ajustement enregistré',
    });
});

module.exports = router;
