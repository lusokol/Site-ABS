const express = require('express');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { isDate, isTime, isInt, isIn, sanitize } = require('../middleware/validate');
const { sendBookingCancellation } = require('../lib/email');
const { cancelBookingAndRefund } = require('./bookings');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
    const { from, to } = req.query;
    const isStaff = req.user.role === 'admin' || req.user.role === 'prof';
    const me = db.prepare('SELECT forfait_indiv_quota FROM users WHERE id = ?').get(req.user.id);
    const hasForfait = me && me.forfait_indiv_quota !== null;

    let query = `
        SELECT s.*, u.first_name AS prof_first_name, u.last_name AS prof_last_name,
            (SELECT COUNT(*) FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed') AS booking_count
        FROM slots s
        JOIN users u ON u.id = s.prof_id
        WHERE s.is_cancelled = 0
    `;
    const params = [];

    // Filtrage par audience : staff voit tout, tagué voit tout, sinon uniquement 'adherent'
    if (!isStaff && !hasForfait) {
        query += " AND s.audience = 'adherent'";
    }

    if (from && isDate(from)) {
        query += ' AND s.date >= ?';
        params.push(from);
    } else {
        query += ' AND s.date >= date(\'now\')';
    }
    if (to && isDate(to)) {
        query += ' AND s.date <= ?';
        params.push(to);
    }

    query += ' ORDER BY s.date, s.start_time';
    const slots = db.prepare(query).all(...params);
    res.json(slots);
});

router.get('/:id', authenticate, (req, res) => {
    const slot = db.prepare(`
        SELECT s.*, u.first_name AS prof_first_name, u.last_name AS prof_last_name
        FROM slots s
        JOIN users u ON u.id = s.prof_id
        WHERE s.id = ?
    `).get(req.params.id);

    if (!slot) return res.status(404).json({ error: 'Créneau introuvable' });

    // Bloquer l'accès aux créneaux forfait indiv pour les non-tagués
    const isStaff = req.user.role === 'admin' || req.user.role === 'prof';
    if (!isStaff && slot.audience === 'forfait_indiv') {
        const me = db.prepare('SELECT forfait_indiv_quota FROM users WHERE id = ?').get(req.user.id);
        if (!me || me.forfait_indiv_quota === null) {
            return res.status(404).json({ error: 'Créneau introuvable' });
        }
    }

    const bookings = db.prepare(`
        SELECT b.id, b.user_id, b.payment_method, b.payment_status, u.first_name, u.last_name, u.email
        FROM bookings b JOIN users u ON u.id = b.user_id
        WHERE b.slot_id = ? AND b.status = 'confirmed'
    `).all(slot.id);

    const isAdmin = req.user.role === 'admin' || req.user.role === 'prof';
    const participants = bookings.map(b => ({
        first_name: b.first_name,
        last_name: b.last_name,
        ...(isAdmin ? { email: b.email, payment_method: b.payment_method, payment_status: b.payment_status } : {}),
    }));

    res.json({ ...slot, participants, booking_count: bookings.length });
});

router.post('/', authenticate, authorize('admin', 'prof'), (req, res) => {
    const { date, start_time, duration_min, location, max_capacity, price_cents, audience } = req.body;

    if (!isDate(date)) return res.status(400).json({ error: 'Date invalide (YYYY-MM-DD)' });
    if (!isTime(start_time)) return res.status(400).json({ error: 'Heure invalide (HH:MM)' });
    if (!isInt(duration_min, 15, 240)) return res.status(400).json({ error: 'Durée invalide (15-240 min)' });
    if (!location) return res.status(400).json({ error: 'Lieu requis' });
    if (!isInt(max_capacity, 1, 20)) return res.status(400).json({ error: 'Capacité invalide (1-20)' });
    if (!isInt(price_cents, 0, 100000)) return res.status(400).json({ error: 'Prix invalide' });
    const aud = audience || 'adherent';
    if (!isIn(aud, ['adherent', 'forfait_indiv'])) return res.status(400).json({ error: 'Public invalide' });

    const result = db.prepare(`
        INSERT INTO slots (prof_id, date, start_time, duration_min, location, max_capacity, price_cents, audience)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, date, start_time, Number(duration_min), sanitize(location), Number(max_capacity), Number(price_cents), aud);

    const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(slot);
});

router.put('/:id', authenticate, authorize('admin', 'prof'), (req, res) => {
    const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(req.params.id);
    if (!slot) return res.status(404).json({ error: 'Créneau introuvable' });

    if (req.user.role === 'prof' && slot.prof_id !== req.user.id) {
        return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres créneaux' });
    }

    const { date, start_time, duration_min, location, max_capacity, price_cents, audience } = req.body;

    if (date && !isDate(date)) return res.status(400).json({ error: 'Date invalide' });
    if (start_time && !isTime(start_time)) return res.status(400).json({ error: 'Heure invalide' });
    if (duration_min && !isInt(duration_min, 15, 240)) return res.status(400).json({ error: 'Durée invalide' });
    if (max_capacity && !isInt(max_capacity, 1, 20)) return res.status(400).json({ error: 'Capacité invalide' });
    if (price_cents !== undefined && !isInt(price_cents, 0, 100000)) return res.status(400).json({ error: 'Prix invalide' });
    if (audience && !isIn(audience, ['adherent', 'forfait_indiv'])) return res.status(400).json({ error: 'Public invalide' });

    if (max_capacity) {
        const currentCount = db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE slot_id = ? AND status = \'confirmed\'').get(req.params.id).n;
        if (Number(max_capacity) < currentCount) {
            return res.status(400).json({ error: `Impossible de réduire la capacité en dessous du nombre de réservations actuelles (${currentCount})` });
        }
    }

    db.prepare(`
        UPDATE slots SET
            date = COALESCE(?, date),
            start_time = COALESCE(?, start_time),
            duration_min = COALESCE(?, duration_min),
            location = COALESCE(?, location),
            max_capacity = COALESCE(?, max_capacity),
            price_cents = COALESCE(?, price_cents),
            audience = COALESCE(?, audience),
            updated_at = datetime('now')
        WHERE id = ?
    `).run(
        date || null, start_time || null,
        duration_min ? Number(duration_min) : null,
        location ? sanitize(location) : null,
        max_capacity ? Number(max_capacity) : null,
        price_cents !== undefined ? Number(price_cents) : null,
        audience || null,
        req.params.id
    );

    const updated = db.prepare('SELECT * FROM slots WHERE id = ?').get(req.params.id);
    res.json(updated);
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
    const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(req.params.id);
    if (!slot) return res.status(404).json({ error: 'Créneau introuvable' });

    const affectedBookings = db.prepare(`
        SELECT b.*, u.email FROM bookings b
        JOIN users u ON u.id = b.user_id
        WHERE b.slot_id = ? AND b.status = 'confirmed'
    `).all(req.params.id);

    db.prepare('UPDATE slots SET is_cancelled = 1, updated_at = datetime(\'now\') WHERE id = ?').run(req.params.id);

    for (const b of affectedBookings) {
        const refund = cancelBookingAndRefund(b, slot, 'Créneau annulé par l\'administrateur');

        try {
            await sendBookingCancellation(b.email, {
                slotDate: slot.date,
                slotTime: slot.start_time,
                location: slot.location,
                hasCredit: refund > 0,
                creditAmount: refund,
                cancelledByAdmin: true,
            });
        } catch (err) {
            console.error('Erreur email annulation pour', b.email, err);
        }
    }

    res.json({ message: `Créneau annulé, ${affectedBookings.length} réservation(s) annulée(s)` });
});

module.exports = router;
