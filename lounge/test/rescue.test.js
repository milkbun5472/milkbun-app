'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { RescueController } = require('../rescue');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lounge-rescue-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const support = path.join(root, 'sessions'), project = path.join(root, 'project');
  fs.mkdirSync(path.join(support, 'nested'), { recursive: true }); fs.mkdirSync(project);
  const cli = 'cli-1', session = 'local-1';
  fs.writeFileSync(path.join(support, 'nested', `${session}.json`), JSON.stringify({ cliSessionId: cli }));
  fs.writeFileSync(path.join(project, `${cli}.jsonl`), '{"type":"user"}\n');
  const dbPath = path.join(root, 'lounge.db'); fs.writeFileSync(dbPath, 'db'); fs.writeFileSync(dbPath + '-wal', 'wal');
  const rescue = new RescueController({
    root: path.join(root, 'rescue'), dbPath, uid: null, services: { lounge: 'test.lounge' },
    config: { cc_session_id: session, cc_app_support_dir: support, cc_project_dir: project },
  });
  return { root, rescue };
}

test('检查点同时保存 CC transcript 与 SQLite WAL 组', (t) => {
  const { root, rescue } = fixture(t), row = rescue.checkpoint('before rescue');
  assert.equal(row.hasCc, true); assert.equal(row.hasLoungeDb, true);
  const dir = path.join(root, 'rescue', 'checkpoints', row.checkpointId);
  assert.equal(fs.readFileSync(path.join(dir, 'yanqiu-transcript.jsonl'), 'utf8'), '{"type":"user"}\n');
  assert.equal(fs.readFileSync(path.join(dir, 'lounge.db-wal'), 'utf8'), 'wal');
  assert.equal(rescue.list()[0].reason, 'before rescue');
});

test('rewind 只做候选预演，执行保持锁定', (t) => {
  const { rescue } = fixture(t); rescue.checkpoint('safe point');
  const preview = rescue.rewindPreview({ before: new Date(Date.now() + 1000).toISOString() });
  assert.equal(preview.executable, false); assert.equal(preview.authorizationRequired, true); assert.ok(preview.candidate);
});

test('重启只允许白名单且必须显式确认', (t) => {
  const { rescue } = fixture(t);
  assert.throws(() => rescue.restart('lounge', false), /明确确认/);
  assert.throws(() => rescue.restart('anything', true), /白名单/);
});

test('互救工单只有脱敏体征和授权边界', (t) => {
  const { rescue } = fixture(t), text = rescue.rescueSummary('突然离线');
  assert.match(text, /突然离线/); assert.match(text, /未经 Lisa/); assert.match(text, /检查点/);
  assert.doesNotMatch(text, /cli-1|local-1|transcriptPath/);
});
