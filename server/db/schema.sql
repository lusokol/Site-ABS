PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash   TEXT,
    role            TEXT    NOT NULL DEFAULT 'member'
                           CHECK (role IN ('admin', 'prof', 'member')),
    first_name      TEXT,
    last_name       TEXT,
    phone           TEXT,
    balance_cents   INTEGER NOT NULL DEFAULT 0,
    forfait_indiv_quota INTEGER,
    invite_token    TEXT,
    invite_expires  TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_invite_token ON users(invite_token);

CREATE TABLE IF NOT EXISTS slots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    prof_id         INTEGER NOT NULL REFERENCES users(id),
    date            TEXT    NOT NULL,
    start_time      TEXT    NOT NULL,
    duration_min    INTEGER NOT NULL DEFAULT 60,
    location        TEXT    NOT NULL,
    max_capacity    INTEGER NOT NULL DEFAULT 1,
    price_cents     INTEGER NOT NULL,
    audience        TEXT    NOT NULL DEFAULT 'adherent'
                           CHECK (audience IN ('adherent', 'forfait_indiv')),
    is_cancelled    INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_slots_date ON slots(date);
CREATE INDEX IF NOT EXISTS idx_slots_prof ON slots(prof_id);

CREATE TABLE IF NOT EXISTS bookings (
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

CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_helloasso ON bookings(helloasso_checkout_id);

CREATE TABLE IF NOT EXISTS articles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,
    content         TEXT    NOT NULL,
    category        TEXT    NOT NULL DEFAULT 'actualites'
                           CHECK (category IN ('actualites', 'interclubs', 'evenements')),
    badge_date      TEXT    NOT NULL,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_articles_sort ON articles(sort_order ASC);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id               INTEGER NOT NULL REFERENCES users(id),
    amount_cents          INTEGER NOT NULL,
    reason                TEXT    NOT NULL
                                 CHECK (reason IN ('topup', 'booking_paid', 'booking_cancelled', 'admin_adjustment', 'migration')),
    booking_id            INTEGER REFERENCES bookings(id),
    admin_user_id         INTEGER REFERENCES users(id),
    helloasso_checkout_id TEXT,
    helloasso_payment_id  TEXT,
    note                  TEXT,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_booking ON wallet_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_checkout ON wallet_transactions(helloasso_checkout_id);
