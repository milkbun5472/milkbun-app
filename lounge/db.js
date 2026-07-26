'use strict';
// 三方会客厅 · 本地数据层（Step 1）
// node:sqlite 零依赖。仅本地持久化 + 重启恢复所需的最小表；不含前端、不含真实 adapter。
// 施工图: docs/three-party-lounge-plan.md §10 本地存储与恢复
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rooms (
  room_id          TEXT PRIMARY KEY,
  title            TEXT,
  cc_session_id    TEXT,
  codex_thread_id  TEXT,
  mode             TEXT NOT NULL DEFAULT 'hosted',      -- hosted | one_each
  status           TEXT NOT NULL DEFAULT 'paused',      -- paused|dispatching|waiting_reply|needs_attention|stopped
  next_speaker     TEXT,                                -- yanqiu | codex | null
  max_auto_turns   INTEGER NOT NULL DEFAULT 2,
  auto_turns_used  INTEGER NOT NULL DEFAULT 0,
  daily_char_cap   INTEGER NOT NULL DEFAULT 0,          -- 0 = 无软上限
  chars_used_today INTEGER NOT NULL DEFAULT 0,
  pause_requested  INTEGER NOT NULL DEFAULT 0,          -- 立即暂停闸
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  message_id       TEXT PRIMARY KEY,
  room_id          TEXT NOT NULL,
  speaker          TEXT NOT NULL,                       -- lisa | yanqiu | codex
  content          TEXT NOT NULL,                       -- 只含可见正文
  reply_to         TEXT,
  origin           TEXT NOT NULL,                       -- lounge | cc | codex
  origin_message_id TEXT,
  round_id         TEXT,
  automatic        INTEGER NOT NULL DEFAULT 0,
  character_count  INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  -- 幂等键①: 同一来源消息在同一房间最多落一次
  UNIQUE (room_id, origin, origin_message_id)
);

CREATE TABLE IF NOT EXISTS dispatches (
  dispatch_id      TEXT PRIMARY KEY,
  room_id          TEXT NOT NULL,
  round_id         TEXT,
  target           TEXT NOT NULL,                       -- yanqiu | codex
  speaker          TEXT,
  message_id       TEXT NOT NULL,                       -- 被投递的源消息
  status           TEXT NOT NULL,                       -- queued|delivered|replied|failed|timeout|needs_attention|skipped
  after_cursor     TEXT,                                -- 投前游标(§2bis 时序绑定)
  expects_reply    INTEGER NOT NULL DEFAULT 1,
  reply_limit      INTEGER NOT NULL DEFAULT 1,
  automatic        INTEGER NOT NULL DEFAULT 0,
  reply_message_id TEXT,
  created_at       TEXT NOT NULL,
  delivered_at     TEXT,
  resolved_at      TEXT,
  -- 幂等键②: 同一源消息对同一目标最多一个投递
  UNIQUE (message_id, target)
);

CREATE TABLE IF NOT EXISTS delivery_attempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  dispatch_id   TEXT NOT NULL,
  target        TEXT NOT NULL,
  outcome       TEXT NOT NULL,                          -- delivered|refused|error|recovered
  detail        TEXT,
  at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS adapter_cursors (
  room_id   TEXT NOT NULL,
  target    TEXT NOT NULL,
  cursor    TEXT,
  updated_at TEXT,
  PRIMARY KEY (room_id, target)
);
`;

function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  // 单写者 + 原子落盘: WAL + 外键 + 同步全量
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA synchronous = FULL;');
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb, SCHEMA };
