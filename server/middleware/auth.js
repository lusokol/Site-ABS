const { verifyToken } = require('../lib/token');
const db = require('../db/connection');

function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    try {
        const payload = verifyToken(header.slice(7));
        const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(payload.sub);
        if (!user) {
            return res.status(401).json({ error: 'Compte introuvable' });
        }
        req.user = user;
        next();
    } catch {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
}

function authorize(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Accès interdit' });
        }
        next();
    };
}

module.exports = { authenticate, authorize };
