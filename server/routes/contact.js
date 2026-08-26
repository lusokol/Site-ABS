const express = require('express');
const { sendContactMessage } = require('../lib/email');
const { isEmail, sanitize } = require('../middleware/validate');
const rateLimit = require('../middleware/rate-limit');

const router = express.Router();

const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

router.post('/', contactLimiter, async (req, res) => {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Nom requis' });
    if (!email || !isEmail(email)) return res.status(400).json({ error: 'Email invalide' });
    if (!subject || !subject.trim()) return res.status(400).json({ error: 'Sujet requis' });
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message requis' });

    try {
        await sendContactMessage({
            name: sanitize(name.trim()),
            email: email.trim(),
            phone: phone ? sanitize(phone.trim()) : '',
            subject: sanitize(subject.trim()),
            message: sanitize(message.trim()),
        });
        res.json({ message: 'Message envoyé avec succès' });
    } catch (err) {
        console.error('Erreur envoi message contact:', err);
        res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
    }
});

module.exports = router;
