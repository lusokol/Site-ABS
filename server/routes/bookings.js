const express = require('express');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { isIn } = require('../middleware/validate');
const { createCheckoutIntent } = require('../lib/helloasso');
const { sendBookingConfirmation, sendBookingCancellation } = require('../lib/email');

const router = express.Router();

// Réserve un créneau et applique le solde du membre en priorité.
// Renvoie : { bookingId, slot, appliedCredit, amountDue, effectiveMethod }
const bookSlot = db.transaction((slotId, userId, requestedMethod) => {
    const slot = db.prepare('SELECT * FROM slots WHERE id = ? AND is_cancelled = 0').get(slotId);
    if (!slot) throw Object.assign(new Error('Créneau introuvable ou annulé'), { status: 404 });

    const slotDateTime = new Date(`${slot.date}T${slot.start_time}:00`);
    if (slotDateTime < new Date()) {
        throw Object.assign(new Error('Ce créneau est déjà passé'), { status: 400 });
    }

    const count = db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE slot_id = ? AND status = \'confirmed\'').get(slotId).n;
    if (count >= slot.max_capacity) {
        throw Object.assign(new Error('Ce créneau est complet'), { status: 409 });
    }

    const existing = db.prepare('SELECT id, status FROM bookings WHERE slot_id = ? AND user_id = ?').get(slotId, userId);
    if (existing && existing.status === 'confirmed') {
        throw Object.assign(new Error('Vous avez déjà réservé ce créneau'), { status: 409 });
    }

    const user = db.prepare('SELECT balance_cents, forfait_indiv_quota, role FROM users WHERE id = ?').get(userId);
    const balance = user ? user.balance_cents : 0;
    const price = slot.price_cents;
    const isStaff = user && (user.role === 'admin' || user.role === 'prof');
    const isForfaitFlow = slot.audience === 'forfait_indiv' && !isStaff;

    // Vérification quota forfait indiv (staff bypass)
    if (isForfaitFlow) {
        if (!user || user.forfait_indiv_quota === null) {
            throw Object.assign(new Error('Ce créneau est réservé aux membres forfait individuel'), { status: 403 });
        }
        if (user.forfait_indiv_quota <= 0) {
            throw Object.assign(new Error('Quota forfait individuel épuisé'), { status: 403 });
        }
    }

    // Forfait indiv : gratuit et couvert par le quota — pas de solde ni de paiement
    const appliedCredit = isForfaitFlow ? 0 : Math.min(balance, price);
    const amountDue = isForfaitFlow ? 0 : price - appliedCredit;

    let effectiveMethod, paymentStatus;
    if (isForfaitFlow) {
        effectiveMethod = 'forfait';
        paymentStatus = 'paid';
    } else if (amountDue === 0) {
        effectiveMethod = 'balance';
        paymentStatus = 'paid';
    } else {
        effectiveMethod = requestedMethod;
        paymentStatus = 'pending';
    }

    let bookingId;
    if (existing && existing.status === 'cancelled') {
        db.prepare(`UPDATE bookings SET
            status = 'confirmed', payment_method = ?, payment_status = ?,
            applied_credit_cents = ?, cancelled_at = NULL,
            helloasso_checkout_id = NULL, helloasso_payment_id = NULL,
            updated_at = datetime('now') WHERE id = ?`
        ).run(effectiveMethod, paymentStatus, appliedCredit, existing.id);
        bookingId = existing.id;
    } else {
        const result = db.prepare(
            'INSERT INTO bookings (slot_id, user_id, payment_method, payment_status, applied_credit_cents) VALUES (?, ?, ?, ?, ?)'
        ).run(slotId, userId, effectiveMethod, paymentStatus, appliedCredit);
        bookingId = result.lastInsertRowid;
    }

    if (appliedCredit > 0) {
        db.prepare('UPDATE users SET balance_cents = balance_cents - ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(appliedCredit, userId);
        db.prepare(`
            INSERT INTO wallet_transactions (user_id, amount_cents, reason, booking_id, note)
            VALUES (?, ?, 'booking_paid', ?, ?)
        `).run(userId, -appliedCredit, bookingId, `Réservation du ${slot.date} (${slot.start_time}) — ${slot.location}`);
    }

    // Décrément quota forfait indiv (staff exempté)
    if (isForfaitFlow) {
        db.prepare('UPDATE users SET forfait_indiv_quota = forfait_indiv_quota - 1, updated_at = datetime(\'now\') WHERE id = ?')
            .run(userId);
    }

    return { bookingId, slot, appliedCredit, amountDue, effectiveMethod };
});

// Rollback si HelloAsso échoue après le débit du solde
const rollbackBookingAndRefund = db.transaction((bookingId) => {
    const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
    if (!b) return;

    if (b.applied_credit_cents > 0) {
        db.prepare('UPDATE users SET balance_cents = balance_cents + ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(b.applied_credit_cents, b.user_id);
        db.prepare(`
            INSERT INTO wallet_transactions (user_id, amount_cents, reason, booking_id, note)
            VALUES (?, ?, 'booking_cancelled', ?, 'Rollback : paiement CB non finalisé')
        `).run(b.user_id, b.applied_credit_cents, bookingId);
    }

    db.prepare('UPDATE bookings SET status = \'cancelled\', cancelled_at = datetime(\'now\'), applied_credit_cents = 0 WHERE id = ?')
        .run(bookingId);
});

router.get('/', authenticate, (req, res) => {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'prof';
    const { status, upcoming } = req.query;

    let query = `
        SELECT b.*, s.date, s.start_time, s.duration_min, s.location, s.price_cents,
            u.first_name, u.last_name, u.email
        FROM bookings b
        JOIN slots s ON s.id = b.slot_id
        JOIN users u ON u.id = b.user_id
        WHERE 1=1
    `;
    const params = [];

    if (!isAdmin) {
        query += ' AND b.user_id = ?';
        params.push(req.user.id);
    }
    if (status && isIn(status, ['confirmed', 'cancelled'])) {
        query += ' AND b.status = ?';
        params.push(status);
    }
    if (upcoming === 'true') {
        query += ' AND s.date >= date(\'now\')';
    }

    query += ' ORDER BY s.date DESC, s.start_time DESC';
    const bookings = db.prepare(query).all(...params);
    res.json(bookings);
});

// Preview : renvoie le prix + solde + à payer sans réserver
router.get('/preview/:slotId', authenticate, (req, res) => {
    const slot = db.prepare('SELECT id, price_cents, audience FROM slots WHERE id = ? AND is_cancelled = 0').get(req.params.slotId);
    if (!slot) return res.status(404).json({ error: 'Créneau introuvable' });

    const user = db.prepare('SELECT balance_cents, forfait_indiv_quota, role FROM users WHERE id = ?').get(req.user.id);
    const balance = user ? user.balance_cents : 0;
    const isStaff = user && (user.role === 'admin' || user.role === 'prof');
    const isForfaitFlow = slot.audience === 'forfait_indiv' && !isStaff;

    if (isForfaitFlow) {
        return res.json({
            price_cents: slot.price_cents,
            balance_cents: balance,
            applied_credit_cents: 0,
            amount_due_cents: 0,
            is_forfait: true,
            forfait_indiv_quota: user ? user.forfait_indiv_quota : null,
        });
    }

    const appliedCredit = Math.min(balance, slot.price_cents);
    const amountDue = slot.price_cents - appliedCredit;

    res.json({
        price_cents: slot.price_cents,
        balance_cents: balance,
        applied_credit_cents: appliedCredit,
        amount_due_cents: amountDue,
        is_forfait: false,
    });
});

router.post('/', authenticate, async (req, res) => {
    const { slot_id, payment_method } = req.body;
    if (!slot_id) return res.status(400).json({ error: 'slot_id requis' });
    // payment_method optionnel pour les créneaux forfait indiv, requis sinon
    if (payment_method && !isIn(payment_method, ['card', 'cash'])) {
        return res.status(400).json({ error: 'payment_method doit être "card" ou "cash"' });
    }

    let result;
    try {
        result = bookSlot(Number(slot_id), req.user.id, payment_method || 'card');
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message });
    }

    const { bookingId, slot, appliedCredit, amountDue, effectiveMethod } = result;

    // Cas 1 : forfait indiv → juste "Réservation confirmée"
    if (effectiveMethod === 'forfait') {
        try {
            const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id);
            await sendBookingConfirmation(user.email, {
                slotDate: slot.date,
                slotTime: slot.start_time,
                location: slot.location,
                paymentMethod: 'forfait',
            });
        } catch (err) {
            console.error('Erreur envoi email confirmation:', err);
        }
        return res.status(201).json({
            booking_id: bookingId,
            applied_credit_cents: 0,
            amount_due_cents: 0,
            message: 'Réservation confirmée',
        });
    }

    // Cas 2 : solde a tout couvert → paiement direct, pas de HelloAsso
    if (amountDue === 0) {
        try {
            const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id);
            await sendBookingConfirmation(user.email, {
                slotDate: slot.date,
                slotTime: slot.start_time,
                location: slot.location,
                paymentMethod: 'balance',
            });
        } catch (err) {
            console.error('Erreur envoi email confirmation:', err);
        }
        return res.status(201).json({
            booking_id: bookingId,
            applied_credit_cents: appliedCredit,
            amount_due_cents: 0,
            message: `Réservation confirmée — ${(appliedCredit / 100).toFixed(2).replace('.', ',')} € déduits de votre solde`,
        });
    }

    // Cas 2 : reste à payer par CB → HelloAsso pour la différence
    if (effectiveMethod === 'card') {
        try {
            const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
            const checkout = await createCheckoutIntent(booking, slot, req.user.email, amountDue);
            db.prepare('UPDATE bookings SET helloasso_checkout_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
                .run(checkout.id, bookingId);
            return res.status(201).json({
                booking_id: bookingId,
                applied_credit_cents: appliedCredit,
                amount_due_cents: amountDue,
                checkout_url: checkout.redirectUrl,
            });
        } catch (err) {
            rollbackBookingAndRefund(bookingId);
            console.error('Erreur HelloAsso:', err);
            return res.status(500).json({ error: 'Erreur lors de la création du paiement' });
        }
    }

    // Cas 3 : reste à payer en espèces → admin marquera payé
    try {
        const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id);
        await sendBookingConfirmation(user.email, {
            slotDate: slot.date,
            slotTime: slot.start_time,
            location: slot.location,
            paymentMethod: 'cash',
        });
    } catch (err) {
        console.error('Erreur envoi email confirmation:', err);
    }

    res.status(201).json({
        booking_id: bookingId,
        applied_credit_cents: appliedCredit,
        amount_due_cents: amountDue,
        message: appliedCredit > 0
            ? `Réservation confirmée. ${(appliedCredit / 100).toFixed(2).replace('.', ',')} € déduits du solde, reste ${(amountDue / 100).toFixed(2).replace('.', ',')} € à régler en espèces.`
            : 'Réservation confirmée — paiement en espèces',
    });
});

// Annule une réservation et crédite le solde du montant approprié.
// Retourne le montant remboursé en centimes (0 si aucun).
const cancelBookingAndRefund = db.transaction((booking, slot, note) => {
    db.prepare(`UPDATE bookings SET status = 'cancelled', cancelled_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
        .run(booking.id);

    let refund = 0;
    const price = slot ? slot.price_cents : 0;
    const applied = booking.applied_credit_cents || 0;
    const isForfaitBooking = booking.payment_method === 'forfait';

    if (isForfaitBooking) {
        // Forfait indiv : aucun argent débité → seul le quota est rendu (plus bas)
        refund = 0;
    } else if (booking.payment_status === 'paid' && price > 0) {
        // Tout a été payé (via solde + éventuellement HelloAsso/espèces) → on rembourse tout
        refund = price;
    } else if (booking.payment_status === 'pending' && applied > 0) {
        // Solde partiellement consommé mais reste à payer non honoré → on rembourse juste la part solde
        refund = applied;
    }

    if (refund > 0) {
        db.prepare('UPDATE users SET balance_cents = balance_cents + ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(refund, booking.user_id);
        db.prepare(`
            INSERT INTO wallet_transactions (user_id, amount_cents, reason, booking_id, note)
            VALUES (?, ?, 'booking_cancelled', ?, ?)
        `).run(booking.user_id, refund, booking.id, note || 'Annulation de réservation');
    }

    // Rendre le quota forfait indiv si applicable (uniquement pour les membres non-staff)
    if (slot && slot.audience === 'forfait_indiv') {
        const u = db.prepare('SELECT role, forfait_indiv_quota FROM users WHERE id = ?').get(booking.user_id);
        if (u && u.role !== 'admin' && u.role !== 'prof' && u.forfait_indiv_quota !== null) {
            db.prepare('UPDATE users SET forfait_indiv_quota = forfait_indiv_quota + 1, updated_at = datetime(\'now\') WHERE id = ?')
                .run(booking.user_id);
        }
    }

    return refund;
});

router.delete('/:id', authenticate, async (req, res) => {
    const booking = db.prepare(`
        SELECT b.*, s.date, s.start_time, s.location, s.price_cents, s.audience FROM bookings b
        JOIN slots s ON s.id = b.slot_id
        WHERE b.id = ?
    `).get(req.params.id);

    if (!booking) return res.status(404).json({ error: 'Réservation introuvable' });

    const isOwn = booking.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwn && !isAdmin) {
        return res.status(403).json({ error: 'Accès interdit' });
    }

    if (booking.status === 'cancelled') {
        return res.status(400).json({ error: 'Réservation déjà annulée' });
    }

    if (isOwn && !isAdmin) {
        const slotDateTime = new Date(`${booking.date}T${booking.start_time}:00`);
        const hoursUntil = (slotDateTime - new Date()) / (1000 * 60 * 60);
        if (hoursUntil < 24) {
            return res.status(400).json({ error: 'Annulation impossible moins de 24h avant le cours. Contactez l\'administrateur.' });
        }
    }

    const slotForRefund = { price_cents: booking.price_cents, audience: booking.audience };
    const refund = cancelBookingAndRefund(booking, slotForRefund, 'Annulation de réservation');
    const hasCredit = refund > 0;

    const message = hasCredit
        ? `Réservation annulée. ${(refund / 100).toFixed(2).replace('.', ',')} € crédités sur votre solde.`
        : 'Réservation annulée.';

    try {
        const memberEmail = db.prepare('SELECT email FROM users WHERE id = ?').get(booking.user_id);
        if (memberEmail) {
            await sendBookingCancellation(memberEmail.email, {
                slotDate: booking.date,
                slotTime: booking.start_time,
                location: booking.location,
                hasCredit,
                creditAmount: refund,
                cancelledByAdmin: isAdmin && !isOwn,
            });
        }
    } catch (err) {
        console.error('Erreur envoi email annulation:', err);
    }

    res.json({ message, has_credit: hasCredit, refund_cents: refund });
});

module.exports = router;
module.exports.cancelBookingAndRefund = cancelBookingAndRefund;
