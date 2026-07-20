export const SCHEMA = `
CREATE TABLE IF NOT EXISTS market (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entry (
  id          TEXT PRIMARY KEY,
  market_id   TEXT NOT NULL REFERENCES market(id) ON DELETE CASCADE,
  trade_date  TEXT NOT NULL,
  actual_w    INTEGER,
  actual_l    INTEGER,
  actual_t    INTEGER,
  ideal_w     INTEGER,
  ideal_l     INTEGER,
  ideal_t     INTEGER,
  would_w     INTEGER,
  would_l     INTEGER,
  would_t     INTEGER,
  no_trade    INTEGER NOT NULL DEFAULT 0,
  note_json   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (market_id, trade_date)
);

CREATE TABLE IF NOT EXISTS image (
  id          TEXT PRIMARY KEY,
  entry_id    TEXT NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('trade','raw','review')),
  file_path   TEXT NOT NULL,
  width       INTEGER,
  height      INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (entry_id, kind)
);

CREATE TABLE IF NOT EXISTS tag (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entry_tag (
  entry_id    TEXT NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

CREATE TABLE IF NOT EXISTS rule_group (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rule (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES rule_group(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  body_json   TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rule_image (
  id          TEXT PRIMARY KEY,
  rule_id     TEXT NOT NULL REFERENCES rule(id) ON DELETE CASCADE,
  file_path   TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS entry_rule_ref (
  entry_id    TEXT NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
  rule_id     TEXT NOT NULL REFERENCES rule(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, rule_id)
);
`
