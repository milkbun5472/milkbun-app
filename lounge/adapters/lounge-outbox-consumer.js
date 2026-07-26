'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const { readNewEvents } = require('./cc-transcript');

class LoungeOutboxConsumer {
  constructor({ db, orch, outboxPath, streamKey = 'yanqiu:lounge_outbox', onMessage = null } = {}) {
    if (!db || !orch || !outboxPath) throw new Error('LoungeOutboxConsumer 缺 db/orch/outboxPath');
    this.db = db;
    this.orch = orch;
    this.outboxPath = outboxPath;
    this.streamKey = streamKey;
    this.onMessage = onMessage;
    this.timer = null;
  }

  _row() {
    return this.db.prepare('SELECT * FROM external_stream_cursors WHERE stream_key=?').get(this.streamKey);
  }

  _setCursor(cursor) {
    this.db.prepare(`INSERT INTO external_stream_cursors(stream_key,stream_path,byte_cursor,updated_at)
      VALUES(?,?,?,?) ON CONFLICT(stream_key) DO UPDATE SET
      stream_path=excluded.stream_path,byte_cursor=MAX(byte_cursor,excluded.byte_cursor),updated_at=excluded.updated_at`)
      .run(this.streamKey, this.outboxPath, Number(cursor) || 0, new Date().toISOString());
  }

  _room() {
    return this.db.prepare(`SELECT * FROM rooms WHERE status != 'stopped'
      ORDER BY updated_at DESC, created_at DESC, rowid DESC LIMIT 1`).get();
  }

  _dispatchOpen(roomId) {
    return this.db.prepare(`SELECT 1 FROM dispatches
      WHERE room_id=? AND target='yanqiu' AND status NOT IN ('replied','skipped') LIMIT 1`).get(roomId);
  }

  _valid(row) {
    return row && row.from === 'yanqiu'
      && (row.kind === 'lounge' || row.kind === 'lounge_reply')
      && typeof row.text === 'string' && row.text.trim();
  }

  _originId(row, ordinal) {
    if (row.at != null) return `cc-outbox@${row.at}`;
    return `cc-outbox-row@${crypto.createHash('sha256')
      .update(`${ordinal}\0${row.text}`).digest('hex').slice(0, 24)}`;
  }

  ingestOnce() {
    const room = this._room();
    if (!room || !fs.existsSync(this.outboxPath) || this._dispatchOpen(room.room_id)) {
      return { imported: 0, reason: !room ? 'no_room' : 'dispatch_open' };
    }

    const saved = this._row();
    const cursor = saved ? Number(saved.byte_cursor) || 0 : 0;
    const chunk = readNewEvents(this.outboxPath, cursor);
    const valid = chunk.events.filter((row) => this._valid(row));

    // 升级首次接线：旧文件里可能混着历次正式回复。只补收最新一条，
    // 然后从 EOF 正常增量消费，既让当前漏件上桌，也不把旧历史重放一遍。
    const rows = saved ? valid : valid.slice(-1);
    const imported = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const message = this.orch.ingestExternalMessage(room.room_id, {
        speaker: 'yanqiu',
        content: row.text.trim(),
        origin: 'cc',
        origin_message_id: this._originId(row, cursor + i),
      });
      imported.push(message);
    }
    this._setCursor(chunk.newCursor);
    if (imported.length && typeof this.onMessage === 'function') this.onMessage(room.room_id, imported);
    return { imported: imported.length, messages: imported, cursor: chunk.newCursor };
  }

  start(intervalMs = 1000) {
    if (this.timer) return;
    this.ingestOnce();
    this.timer = setInterval(() => {
      try { this.ingestOnce(); } catch (error) {
        process.stderr.write(`[lounge-outbox] ${error.message}\n`);
      }
    }, intervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = { LoungeOutboxConsumer };
