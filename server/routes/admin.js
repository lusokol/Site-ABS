const express = require('express');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', authenticate, authorize('admin'), (req, res) => {
    const totalMembers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    const totalBookings = db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE status = \'confirmed\'').get().n;
    const upcomingBookings = db.prepare(`
        SELECT COUNT(*) AS n FROM bookings b
        JOIN slots s ON s.id = b.slot_id
        WHERE b.status = 'confirmed' AND s.date >= date('now')
    `).get().n;

    const cardRevenue = db.prepare(`
        SELECT COALESCE(SUM(s.price_cents), 0) AS total FROM bookings b
        JOIN slots s ON s.id = b.slot_id
        WHERE b.status = 'confirmed' AND b.payment_method = 'card' AND b.payment_status = 'paid'
    `).get().total;

    const cashPending = db.prepare(`
        SELECT COALESCE(SUM(s.price_cents), 0) AS total FROM bookings b
        JOIN slots s ON s.id = b.slot_id
        WHERE b.status = 'confirmed' AND b.payment_method = 'cash' AND b.payment_status = 'pending'
    `).get().total;

    const cashCollected = db.prepare(`
        SELECT COALESCE(SUM(s.price_cents), 0) AS total FROM bookings b
        JOIN slots s ON s.id = b.slot_id
        WHERE b.status = 'confirmed' AND b.payment_method = 'cash' AND b.payment_status = 'paid'
    `).get().total;

    const perMemberCash = db.prepare(`
        SELECT u.id, u.email, u.first_name, u.last_name,
            COALESCE(SUM(CASE WHEN b.payment_status = 'pending' THEN s.price_cents ELSE 0 END), 0) AS pending_cents,
            COALESCE(SUM(CASE WHEN b.payment_status = 'paid' THEN s.price_cents ELSE 0 END), 0) AS paid_cents
        FROM bookings b
        JOIN slots s ON s.id = b.slot_id
        JOIN users u ON u.id = b.user_id
        WHERE b.status = 'confirmed' AND b.payment_method = 'cash'
        GROUP BY u.id
        HAVING pending_cents > 0
        ORDER BY pending_cents DESC
    `).all();

    res.json({
        members: totalMembers,
        bookings: { total: totalBookings, upcoming: upcomingBookings },
        revenue: {
            card_paid_cents: cardRevenue,
            cash_pending_cents: cashPending,
            cash_collected_cents: cashCollected,
        },
        cash_per_member: perMemberCash,
    });
});

module.exports = router;
