'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { openDb } = require('../db');
const { Orchestrator } = require('../orchestrator');
const { FakeAdapter } = require('../adapters/fake');
const { LoungeOutboxConsumer } = require('../adapters/lounge-outbox-consumer');

function fixture() {
  const file = path.join(os.tmpdir(), `lounge_outbox_consumer_${crypto.randomUUID()}.jsonl`);
  fs.writeFileSync(file, '');
  const db = openDb(':memory:');
  const orch = new Orchestrator({ db, cc: new FakeAdapter('cc'), codex: new FakeAdapter('codex') });
  const room = orch.createRoom();
  return { file, db, orch, room, close() { db.close(); fs.unlinkSync(file); } };
}
function append(file, rows) {
  fs.appendFileSync(file, rows.map((row) => `${JSON.stringify(row)}\n`).join(''));
}

test('主动上桌：首次只补最新漏件，之后增量全收且重启不重复', () => {
  const f = fixture();
  try {
    append(f.file, [
      { at: 1, from: 'yanqiu', kind: 'lounge', text: '旧施工回执' },
      { at: 2, from: 'yanqiu', kind: 'lounge', text: '当前主动发言' },
    ]);
    let c = new LoungeOutboxConsumer({ db: f.db, orch: f.orch, outboxPath: f.file });
    assert.equal(c.ingestOnce().imported, 1);
    assert.deepEqual(f.orch.listMessages(f.room.room_id).map((m) => m.content), ['当前主动发言']);

    append(f.file, [
      { at: 3, from: 'yanqiu', kind: 'lounge', text: '后来第一句' },
      { at: 4, from: 'yanqiu', kind: 'lounge_reply', text: '后来第二句' },
    ]);
    assert.equal(c.ingestOnce().imported, 2);
    c = new LoungeOutboxConsumer({ db: f.db, orch: f.orch, outboxPath: f.file });
    assert.equal(c.ingestOnce().imported, 0);
    assert.equal(f.orch.listMessages(f.room.room_id).length, 3);
  } finally { f.close(); }
});

test('正式回复未闭合时主动收件人让路；回复链推进全局游标后不会重复上桌', () => {
  const f = fixture();
  try {
    f.db.prepare(`INSERT INTO messages(message_id,room_id,speaker,content,origin,automatic,character_count,created_at)
      VALUES('m1',?,'lisa','问一句','lounge',0,3,?)`).run(f.room.room_id, new Date().toISOString());
    f.db.prepare(`INSERT INTO dispatches(dispatch_id,room_id,target,message_id,status,automatic,created_at)
      VALUES('d1',?,'yanqiu','m1','delivered',0,?)`).run(f.room.room_id, new Date().toISOString());
    append(f.file, [{ at: 10, from: 'yanqiu', kind: 'lounge', text: '这句属于正式回复' }]);
    const c = new LoungeOutboxConsumer({ db: f.db, orch: f.orch, outboxPath: f.file });
    assert.equal(c.ingestOnce().reason, 'dispatch_open');

    f.db.prepare("UPDATE dispatches SET status='replied' WHERE dispatch_id='d1'").run();
    f.db.prepare(`INSERT INTO external_stream_cursors(stream_key,stream_path,byte_cursor,updated_at)
      VALUES('yanqiu:lounge_outbox',?,?,?)`).run(f.file, fs.statSync(f.file).size, new Date().toISOString());
    assert.equal(c.ingestOnce().imported, 0);
    assert.equal(f.orch.listMessages(f.room.room_id).filter((m) => m.speaker === 'yanqiu').length, 0);
  } finally { f.close(); }
});
