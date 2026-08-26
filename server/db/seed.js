const bcrypt = require('bcrypt');
const db = require('./connection');

const ADMIN_EMAIL = 'abs91360@gmail.com';
const ADMIN_PASSWORD = 'admin123';

async function seed() {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
    if (existing) {
        console.log(`Admin "${ADMIN_EMAIL}" existe déjà (id: ${existing.id})`);
        return;
    }

    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const result = db.prepare(
        'INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES (?, ?, ?, ?, ?)'
    ).run(ADMIN_EMAIL, hash, 'admin', 'Admin', 'ABS91');

    console.log(`Admin créé : ${ADMIN_EMAIL} (id: ${result.lastInsertRowid})`);
    console.log(`Mot de passe temporaire : ${ADMIN_PASSWORD}`);
    console.log('⚠ Changez ce mot de passe après la première connexion !');
}

seed().catch(console.error);
