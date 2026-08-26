function rateLimit({ windowMs = 15 * 60 * 1000, max = 5 } = {}) {
    const hits = new Map();

    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (now - entry.start > windowMs) hits.delete(key);
        }
    }, windowMs);

    return (req, res, next) => {
        const key = req.ip;
        const now = Date.now();
        const entry = hits.get(key);

        if (!entry || now - entry.start > windowMs) {
            hits.set(key, { start: now, count: 1 });
            return next();
        }

        entry.count++;
        if (entry.count > max) {
            return res.status(429).json({ error: 'Trop de tentatives, réessayez plus tard' });
        }
        next();
    };
}

module.exports = rateLimit;
