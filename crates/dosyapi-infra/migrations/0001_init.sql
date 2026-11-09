-- dosyapı veritabanı şeması. Kişisel veri içeren kolonlar `_enc` son ekiyle
-- uygulama katmanında AES-256-GCM ile şifreli tutulur.

CREATE TABLE settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE roles (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL,
    level INTEGER NOT NULL CHECK (level >= 1),
    perms TEXT NOT NULL
);
CREATE UNIQUE INDEX roles_single_top ON roles (level) WHERE level = 1;

CREATE TABLE users (
    id                   TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    email                TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone_enc            BLOB,
    password_hash        TEXT NOT NULL,
    role_id              TEXT REFERENCES roles (id) ON DELETE RESTRICT,
    status               TEXT NOT NULL CHECK (status IN ('pending', 'active')),
    must_change_password INTEGER NOT NULL DEFAULT 0,
    totp_secret_enc      BLOB,
    totp_enabled         INTEGER NOT NULL DEFAULT 0,
    -- Son kabul edilen TOTP zaman adımı; aynı kod (ve daha eskisi) ikinci kez geçmez.
    totp_last_step       INTEGER NOT NULL DEFAULT 0,
    failed_logins        INTEGER NOT NULL DEFAULT 0,
    locked_until         INTEGER,
    notice_accepted_at   INTEGER,
    created_at           INTEGER NOT NULL
);

CREATE TABLE sessions (
    token_hash   BLOB PRIMARY KEY,
    kind         TEXT NOT NULL CHECK (kind IN ('user', 'master')),
    user_id      TEXT REFERENCES users (id) ON DELETE CASCADE,
    created_at   INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    idle_seconds INTEGER NOT NULL,
    persistent   INTEGER NOT NULL DEFAULT 0,
    ip           TEXT NOT NULL DEFAULT '',
    user_agent   TEXT NOT NULL DEFAULT ''
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE auth_tokens (
    token_hash BLOB PRIMARY KEY,
    purpose    TEXT NOT NULL,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at    INTEGER
);
CREATE INDEX auth_tokens_user ON auth_tokens (user_id, purpose);

CREATE TABLE doc_types (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    required INTEGER NOT NULL DEFAULT 0,
    accept   TEXT NOT NULL,
    multi    INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE professions (
    name     TEXT PRIMARY KEY,
    required INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE authors (
    id          TEXT PRIMARY KEY,
    tc_enc      BLOB,
    first       TEXT NOT NULL,
    last        TEXT NOT NULL,
    phone_enc   BLOB,
    company     TEXT NOT NULL DEFAULT '',
    job         TEXT NOT NULL,
    sicil       TEXT NOT NULL DEFAULT '',
    address_enc BLOB
);

CREATE TABLE contractors (
    id      TEXT PRIMARY KEY,
    title   TEXT NOT NULL,
    owner   TEXT NOT NULL DEFAULT '',
    licence TEXT NOT NULL DEFAULT '',
    rank    TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT ''
);

CREATE TABLE projects (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    contractor_id TEXT NOT NULL REFERENCES contractors (id) ON DELETE RESTRICT,
    ada        TEXT NOT NULL,
    parsel     TEXT NOT NULL,
    pafta      TEXT NOT NULL DEFAULT '',
    mahalle    TEXT NOT NULL,
    street     TEXT NOT NULL,
    status     TEXT NOT NULL,
    done       INTEGER NOT NULL DEFAULT 0,
    note       TEXT NOT NULL DEFAULT '',
    -- Fotoğraf şifreli depoda `photo-<id>` adıyla durur; tür boşsa fotoğraf yoktur.
    photo_mime TEXT NOT NULL DEFAULT '',
    photo_at   INTEGER NOT NULL DEFAULT 0,
    people_enc BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE project_authors (
    project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    author_id  TEXT NOT NULL REFERENCES authors (id) ON DELETE CASCADE,
    position   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (project_id, author_id)
);

CREATE TABLE files (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    doc_type_id TEXT,
    name        TEXT NOT NULL,
    size        INTEGER NOT NULL,
    mime        TEXT NOT NULL,
    sha256      TEXT NOT NULL,
    by_name     TEXT NOT NULL,
    by_id       TEXT NOT NULL,
    at          INTEGER NOT NULL,
    state       TEXT NOT NULL CHECK (state IN ('active', 'pending'))
);
CREATE INDEX files_project ON files (project_id, doc_type_id);

CREATE TABLE tasks (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    assignee   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    by_id      TEXT NOT NULL,
    due        TEXT NOT NULL DEFAULT '',
    done       INTEGER NOT NULL DEFAULT 0,
    project_id TEXT REFERENCES projects (id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE todos (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    done       INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- İki adımlı doğrulama kurtarma kodları: yalnızca özetleri tutulur, her biri tek kullanımlık.
CREATE TABLE totp_recovery (
    user_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    PRIMARY KEY (user_id, code_hash)
) WITHOUT ROWID;

-- Kişisel proje notu: yalnızca yazan kullanıcı görür; gövde alan düzeyinde şifreli.
CREATE TABLE project_notes (
    user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    body_enc   BLOB NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, project_id)
) WITHOUT ROWID;

CREATE TABLE pendings (
    id           TEXT PRIMARY KEY,
    kind         TEXT NOT NULL,
    entity       TEXT NOT NULL,
    payload_enc  BLOB NOT NULL,
    title        TEXT NOT NULL,
    detail       TEXT NOT NULL,
    by_name      TEXT NOT NULL,
    by_id        TEXT NOT NULL,
    at           INTEGER NOT NULL,
    min_level    INTEGER NOT NULL,
    target_level INTEGER,
    doc_key      TEXT,
    file_name    TEXT
);

CREATE TABLE history (
    id   TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    at   INTEGER NOT NULL,
    ok   INTEGER NOT NULL
);

CREATE TABLE templates (
    id      TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    data    TEXT NOT NULL,
    updated INTEGER NOT NULL
);

-- Değiştirilemez denetim günlüğü: her kayıt bir öncekinin özetini içerir.
CREATE TABLE audit_log (
    seq        INTEGER PRIMARY KEY AUTOINCREMENT,
    at         INTEGER NOT NULL,
    actor_kind TEXT NOT NULL,
    actor_id   TEXT NOT NULL,
    action     TEXT NOT NULL,
    target     TEXT NOT NULL,
    ip         TEXT NOT NULL,
    detail     TEXT NOT NULL,
    prev_hash  BLOB NOT NULL,
    hash       BLOB NOT NULL
);

CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log değiştirilemez'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log silinemez'); END;
