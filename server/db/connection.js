const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'abs91.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Migrations (before schema, which may reference new column names) ---
function tableExists(name) {
    return db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}
function columnExists(table, col) {
    return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);
}

if (tableExists('bookings')) {
    const cols = db.prepare("PRAGMA table_info(bookings)").all().map(c => c.name);
    if (cols.includes('stripe_session_id') && !cols.includes('helloasso_checkout_id')) {
        db.exec(`
            ALTER TABLE bookings RENAME COLUMN stripe_session_id TO helloasso_checkout_id;
            ALTER TABLE bookings RENAME COLUMN stripe_payment_intent TO helloasso_payment_id;
        `);
        db.exec('DROP INDEX IF EXISTS idx_bookings_stripe');
    }
    if (!cols.includes('applied_credit_cents')) {
        db.exec("ALTER TABLE bookings ADD COLUMN applied_credit_cents INTEGER NOT NULL DEFAULT 0");
    }
}

if (tableExists('users') && !columnExists('users', 'balance_cents')) {
    db.exec("ALTER TABLE users ADD COLUMN balance_cents INTEGER NOT NULL DEFAULT 0");
}
if (tableExists('users') && !columnExists('users', 'forfait_indiv_quota')) {
    db.exec("ALTER TABLE users ADD COLUMN forfait_indiv_quota INTEGER");
}
if (tableExists('users') && columnExists('users', 'is_active')) {
    db.exec("ALTER TABLE users DROP COLUMN is_active");
    console.log('Migration : colonne users.is_active supprimée');
}
if (tableExists('slots') && !columnExists('slots', 'audience')) {
    db.exec("ALTER TABLE slots ADD COLUMN audience TEXT NOT NULL DEFAULT 'adherent'");
}

// Migration : élargir le CHECK sur bookings.payment_method pour inclure 'balance' et 'forfait'
if (tableExists('bookings')) {
    const bookingsSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'").get().sql;
    if (!bookingsSql.includes("'forfait'") || !bookingsSql.includes("'balance'")) {
        db.exec(`
            CREATE TABLE bookings_new (
                id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                slot_id               INTEGER NOT NULL REFERENCES slots(id),
                user_id               INTEGER NOT NULL REFERENCES users(id),
                status                TEXT    NOT NULL DEFAULT 'confirmed'
                                             CHECK (status IN ('confirmed', 'cancelled')),
                payment_method        TEXT    NOT NULL CHECK (payment_method IN ('card', 'cash', 'balance', 'forfait')),
                payment_status        TEXT    NOT NULL DEFAULT 'pending'
                                             CHECK (payment_status IN ('pending', 'paid', 'refunded')),
                applied_credit_cents  INTEGER NOT NULL DEFAULT 0,
                helloasso_checkout_id TEXT,
                helloasso_payment_id  TEXT,
                cancelled_at          TEXT,
                created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
                updated_at            TEXT    NOT NULL DEFAULT (datetime('now')),
                UNIQUE(slot_id, user_id)
            );
            INSERT INTO bookings_new (id, slot_id, user_id, status, payment_method, payment_status,
                applied_credit_cents, helloasso_checkout_id, helloasso_payment_id, cancelled_at, created_at, updated_at)
            SELECT id, slot_id, user_id, status, payment_method, payment_status,
                applied_credit_cents, helloasso_checkout_id, helloasso_payment_id, cancelled_at, created_at, updated_at
            FROM bookings;
            DROP TABLE bookings;
            ALTER TABLE bookings_new RENAME TO bookings;
            CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id);
            CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
            CREATE INDEX IF NOT EXISTS idx_bookings_helloasso ON bookings(helloasso_checkout_id);
        `);
        console.log('Migration : bookings.payment_method élargi à (card, cash, balance, forfait)');
    }
}

const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
db.exec(schema);

// --- One-shot migration : credits table → wallet_transactions + balance ---
if (tableExists('credits')) {
    const legacyCredits = db.prepare("SELECT * FROM credits WHERE status = 'active'").all();
    if (legacyCredits.length) {
        const migrate = db.transaction(() => {
            const insertTx = db.prepare(`
                INSERT INTO wallet_transactions (user_id, amount_cents, reason, booking_id, note, created_at)
                VALUES (?, ?, 'migration', ?, ?, ?)
            `);
            const bumpBalance = db.prepare("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?");
            for (const c of legacyCredits) {
                insertTx.run(c.user_id, c.amount_cents, c.booking_id, `Migration avoir #${c.id} — ${c.reason}`, c.created_at);
                bumpBalance.run(c.amount_cents, c.user_id);
            }
        });
        migrate();
        console.log(`Migration : ${legacyCredits.length} avoir(s) actif(s) convertis en wallet_transactions.`);
    }
    db.exec("DROP TABLE credits");
    console.log('Table `credits` supprimée (remplacée par wallet_transactions).');
}

module.exports = db;
