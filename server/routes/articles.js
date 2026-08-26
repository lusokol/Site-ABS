const express = require('express');
const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const { sanitize } = require('../middleware/validate');

const router = express.Router();

router.get('/', (req, res) => {
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit, 10), 100) : 100;
    const articles = db.prepare(
        'SELECT * FROM articles ORDER BY sort_order ASC LIMIT ?'
    ).all(limit);
    res.json(articles);
});

router.post('/', authenticate, authorize('admin'), (req, res) => {
    const { title, content, category, badge_date } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: 'Titre et contenu requis' });
    }

    const cat = ['actualites', 'interclubs', 'evenements'].includes(category) ? category : 'actualites';

    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM articles').get().next;

    const result = db.prepare(
        'INSERT INTO articles (title, content, category, badge_date, sort_order) VALUES (?, ?, ?, ?, ?)'
    ).run(sanitize(title), sanitize(content), cat, sanitize(badge_date || ''), maxOrder);

    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(article);
});

router.put('/:id', authenticate, authorize('admin'), (req, res) => {
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article introuvable' });

    const { title, content, category, badge_date } = req.body;
    if (!title || !content) {
        return res.status(400).json({ error: 'Titre et contenu requis' });
    }

    const cat = ['actualites', 'interclubs', 'evenements'].includes(category) ? category : article.category;

    db.prepare(
        'UPDATE articles SET title = ?, content = ?, category = ?, badge_date = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(sanitize(title), sanitize(content), cat, sanitize(badge_date || ''), req.params.id);

    const updated = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    res.json(updated);
});

router.post('/reorder', authenticate, authorize('admin'), (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids requis (tableau)' });

    const update = db.prepare('UPDATE articles SET sort_order = ? WHERE id = ?');
    const reorder = db.transaction((orderedIds) => {
        orderedIds.forEach((id, i) => update.run(i, id));
    });
    reorder(ids);

    res.json({ message: 'Ordre mis à jour' });
});

router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
    const article = db.prepare('SELECT id FROM articles WHERE id = ?').get(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article introuvable' });

    db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
    res.json({ message: 'Article supprimé' });
});

module.exports = router;
