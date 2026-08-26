const express = require('express');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { sendPaymentConfirmation } = require('../lib/email');

const router = express.Router();

function handleBookingPayment(bookingId, paymentId) {
    const result = db.prepare(`
        UPDATE bookings SET
            payment_status = 'paid',
            helloasso_payment_id = ?,
            updated_at = datetime('now')
        WHERE id = ? AND payment_method = 'card' AND status = 'confirmed'
    `).run(paymentId, bookingId);

    if (!result.changes) return;

    console.log(`HelloAsso webhook: booking ${bookingId} marqué payé`);

    const info = db.prepare(`
        SELECT u.email, s.date, s.start_time, s.location, s.price_cents,
            b.applied_credit_cents
        FROM bookings b
        JOIN users u ON u.id = b.user_id
        JOIN slots s ON s.id = b.slot_id
        WHERE b.id = ?
    `).get(bookingId);

    if (info) {
        // Ne facturer par email QUE le montant réellement passé par CB (prix - solde appliqué)
        const chargedAmount = info.price_cents - (info.applied_credit_cents || 0);
        sendPaymentConfirmation(info.email, {
            slotDate: info.date,
            slotTime: info.start_time,
            location: info.location,
            amount: chargedAmount,
        }).catch(err => console.error('Erreur envoi email confirmation paiement:', err));
    }
}

const applyTopup = db.transaction((userId, amountCents, checkoutId, paymentId) => {
    // Idempotence : ne recréditer que si la ligne 'topup' pending (amount=0) existe encore
    const pending = db.prepare(`
        SELECT id FROM wallet_transactions
        WHERE helloasso_checkout_id = ? AND reason = 'topup' AND amount_cents = 0
    `).get(checkoutId);
    if (!pending) return false;

    db.prepare('UPDATE users SET balance_cents = balance_cents + ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(amountCents, userId);
    db.prepare(`
        UPDATE wallet_transactions SET
            amount_cents = ?,
            helloasso_payment_id = ?,
            note = ?
        WHERE id = ?
    `).run(amountCents, paymentId, `Rechargement de ${(amountCents / 100).toFixed(2).replace('.', ',')} €`, pending.id);
    return true;
});

function handleTopupPayment(userId, amountCents, checkoutId, paymentId) {
    try {
        const applied = applyTopup(userId, amountCents, checkoutId, paymentId);
        if (applied) console.log(`HelloAsso webhook: top-up de ${amountCents}c crédité à user ${userId}`);
    } catch (err) {
        console.error('Erreur application top-up:', err);
    }
}

router.post('/webhook', async (req, res) => {
    const { eventType, data } = req.body;

    if (eventType === 'Payment' || eventType === 'Order') {
        const meta = data && data.metadata;
        const paymentId = data && String(data.id || '');
        const checkoutId = data && data.checkoutIntentId ? String(data.checkoutIntentId) : null;
        const amountCents = data && Number(data.amount || 0);

        if (meta && meta.type === 'topup' && meta.user_id) {
            handleTopupPayment(Number(meta.user_id), amountCents, checkoutId, paymentId);
        } else if (meta && (meta.type === 'booking' || meta.booking_id)) {
            const bookingId = meta.booking_id;
            if (bookingId) handleBookingPayment(bookingId, paymentId);
        }
    }

    res.json({ received: true });
});

router.patch('/:booking_id/mark-paid', authenticate, authorize('admin'), (req, res) => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.booking_id);
    if (!booking) return res.status(404).json({ error: 'Réservation introuvable' });
    if (booking.payment_method !== 'cash') {
        return res.status(400).json({ error: 'Ce paiement n\'est pas en espèces' });
    }
    if (booking.status !== 'confirmed') {
        return res.status(400).json({ error: 'Impossible de marquer un paiement sur une réservation annulée' });
    }
    if (booking.payment_status === 'paid') {
        return res.status(400).json({ error: 'Ce paiement est déjà marqué comme reçu' });
    }

    db.prepare('UPDATE bookings SET payment_status = \'paid\', updated_at = datetime(\'now\') WHERE id = ?')
        .run(req.params.booking_id);

    res.json({ message: 'Paiement marqué comme reçu' });
});

module.exports = router;
