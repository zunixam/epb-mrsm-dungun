CREATE TABLE IF NOT EXISTS pb_schedules (
 id TEXT PRIMARY KEY, title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
 start_date TEXT NOT NULL, end_date TEXT NOT NULL CHECK(end_date > start_date),
 departure_time TEXT NOT NULL CHECK(departure_time GLOB '[0-2][0-9]:[0-5][0-9]' AND departure_time < '24:00'),
 return_time TEXT NOT NULL CHECK(return_time GLOB '[0-2][0-9]:[0-5][0-9]' AND return_time < '24:00'),
 category TEXT NOT NULL CHECK(category IN ('PB Wajib','PB Pilihan')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','cancelled')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_pb_public_date ON pb_schedules(status,start_date);
CREATE INDEX IF NOT EXISTS idx_pb_category_date ON pb_schedules(category,start_date);
CREATE TABLE IF NOT EXISTS announcements (
 id TEXT PRIMARY KEY, title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
 body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 5000),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_announcements_public ON announcements(status,updated_at);
CREATE TABLE IF NOT EXISTS audit_logs (
 id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL,
 entity_id TEXT NOT NULL, before_json TEXT, after_json TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type,entity_id,created_at);
