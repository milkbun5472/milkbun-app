'use strict';
// 三方会客厅 · 本地数据层（Step 1，初审修补版）
// node:sqlite 零依赖。含外键 + CHECK 约束 + 幂等唯一键 + 防重复扣费标记 + 日预算列。
// 施工图: docs/three-party-lounge-plan.md §10 / §4.2；初审⑥外键·CHECK·跨房间拒绝
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS rooms (
  room_id          TEXT PRIMARY KEY,
  title            TEXT,
  cc_session_id    TEXT,
  codex_thread_id  TEXT,
  mode             TEXT NOT NULL DEFAULT 'hosted'  CHECK (mode IN ('hosted','one_each')),
  status           TEXT NOT NULL DEFAULT 'paused'
                     CHECK (status IN ('paused','dispatching','waiting_reply','needs_attention','stopped')),
  next_speaker     TEXT CHECK (next_speaker IS NULL OR next_speaker IN ('yanqiu','codex')),
  max_auto_turns   INTEGER NOT NULL DEFAULT 2,     -- 上限：明确启动的自动 run 次数
  auto_turns_used  INTEGER NOT NULL DEFAULT 0,     -- 已用自动 run（一次 runOneEach=1）
  budget_day       TEXT,                            -- 当前预算所属日 YYYY-MM-DD
  calls_today      INTEGER NOT NULL DEFAULT 0,      -- 当日外呼调用累计
  usage_today      INTEGER NOT NULL DEFAULT 0,      -- 当日字符/用量累计
  daily_char_cap   INTEGER NOT NULL DEFAULT 0,      -- 0 = 无软上限
  daily_call_cap   INTEGER NOT NULL DEFAULT 0,      -- 0 = 无软上限
  pause_requested  INTEGER NOT NULL DEFAULT 0  CHECK (pause_requested IN (0,1)),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  message_id        TEXT PRIMARY KEY,
  room_id           TEXT NOT NULL REFERENCES rooms(room_id),
  speaker           TEXT NOT NULL CHECK (speaker IN ('lisa','yanqiu','codex')),
  content           TEXT NOT NULL,
  reply_to          TEXT,
  origin            TEXT NOT NULL CHECK (origin IN ('lounge','cc','codex')),
  origin_message_id TEXT,
  round_id          TEXT,
  automatic         INTEGER NOT NULL DEFAULT 0 CHECK (automatic IN (0,1)),
  character_count   INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  UNIQUE (room_id, origin, origin_message_id)      -- 幂等键①
);

CREATE TABLE IF NOT EXISTS dispatches (
  dispatch_id      TEXT PRIMARY KEY,
  room_id          TEXT NOT NULL REFERENCES rooms(room_id),
  round_id         TEXT,
  target           TEXT NOT NULL CHECK (target IN ('yanqiu','codex')),
  speaker          TEXT,
  message_id       TEXT NOT NULL REFERENCES messages(message_id),
  status           TEXT NOT NULL
                     CHECK (status IN ('dispatching','delivered','replied','failed','timeout','needs_attention','skipped')),
  after_cursor     TEXT,
  expects_reply    INTEGER NOT NULL DEFAULT 1,
  reply_limit      INTEGER NOT NULL DEFAULT 1,
  automatic        INTEGER NOT NULL DEFAULT 0 CHECK (automatic IN (0,1)),
  reply_message_id TEXT,
  usage_charged    INTEGER NOT NULL DEFAULT 0 CHECK (usage_charged IN (0,1)),  -- 防重复扣费
  created_at       TEXT NOT NULL,
  delivered_at     TEXT,
  resolved_at      TEXT,
  UNIQUE (message_id, target)                      -- 幂等键②
);

CREATE TABLE IF NOT EXISTS delivery_attempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  dispatch_id   TEXT NOT NULL REFERENCES dispatches(dispatch_id),
  target        TEXT NOT NULL,
  outcome       TEXT NOT NULL,
  detail        TEXT,
  at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS adapter_cursors (
  room_id    TEXT NOT NULL REFERENCES rooms(room_id),
  target     TEXT NOT NULL,
  cursor     TEXT,
  updated_at TEXT,
  PRIMARY KEY (room_id, target)
);

-- CC Adapter 的可恢复投递态（§10 恢复；重启后据此重建 adapter 内存态、只读 transcript，绝不重投）
CREATE TABLE IF NOT EXISTS cc_dispatch_state (
  dispatch_id     TEXT PRIMARY KEY REFERENCES dispatches(dispatch_id),
  session_id      TEXT NOT NULL,
  transcript_path TEXT NOT NULL,
  after_byte      INTEGER NOT NULL,   -- 投前字节游标(真·transcript 偏移)
  our_text        TEXT NOT NULL,      -- 本次自然正文(用于精确匹配我们的跨会话消息)
  outbox_path     TEXT,
  outbox_after_byte INTEGER,
  created_at      TEXT
);

-- Codex Adapter 的单次 CLI 调用状态。stdout JSONL 落本地 spool，重启后只读恢复、绝不重跑。
CREATE TABLE IF NOT EXISTS codex_dispatch_state (
  dispatch_id   TEXT PRIMARY KEY REFERENCES dispatches(dispatch_id),
  thread_id     TEXT NOT NULL,
  spool_path    TEXT NOT NULL,
  pid           INTEGER,
  state         TEXT NOT NULL DEFAULT 'prepared'
                  CHECK (state IN ('prepared','running','completed','failed')),
  started_at    TEXT,
  updated_at    TEXT
);

-- Adapter 原始用量诊断只留本机；不混入会客厅正文。
CREATE TABLE IF NOT EXISTS adapter_usage (
  dispatch_id TEXT PRIMARY KEY REFERENCES dispatches(dispatch_id),
  target      TEXT NOT NULL,
  usage_json  TEXT NOT NULL,
  recorded_at TEXT NOT NULL
);

-- 外部自然发言流的全局消费游标。既供“主动上桌”收件人使用，也由
-- 正式 dispatch 回复链推进，保证同一行不会同时变成回复和主动消息。
CREATE TABLE IF NOT EXISTS external_stream_cursors (
  stream_key TEXT PRIMARY KEY,
  stream_path TEXT NOT NULL,
  byte_cursor INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
`;

function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');   // 外键强制
  db.exec('PRAGMA synchronous = FULL;');
  db.exec(SCHEMA);
  const ccColumns = new Set(db.prepare('PRAGMA table_info(cc_dispatch_state)').all().map((c) => c.name));
  if (!ccColumns.has('outbox_path')) db.exec('ALTER TABLE cc_dispatch_state ADD COLUMN outbox_path TEXT');
  if (!ccColumns.has('outbox_after_byte')) db.exec('ALTER TABLE cc_dispatch_state ADD COLUMN outbox_after_byte INTEGER');
  return db;
}

module.exports = { openDb, SCHEMA };
