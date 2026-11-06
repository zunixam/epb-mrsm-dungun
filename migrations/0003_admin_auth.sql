-- Additive only. Does not modify schedules, announcements, seed or existing audit data.
CREATE TABLE IF NOT EXISTS admin_users (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL,
 last_seen_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_rate_limits (
 bucket_key TEXT PRIMARY KEY,
 window_start INTEGER NOT NULL,
 attempts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_window ON login_rate_limits(window_start);
-- Audit provisioning atomically with account creation; never include the password verifier.
CREATE TRIGGER IF NOT EXISTS audit_admin_bootstrap AFTER INSERT ON admin_users
BEGIN
 INSERT INTO audit_logs (id,actor,action,entity_type,entity_id)
 VALUES (lower(hex(randomblob(16))), 'operator-cli', 'bootstrap', 'admin_users', NEW.id);
END;
