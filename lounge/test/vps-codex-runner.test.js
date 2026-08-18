'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createVpsCodexRunner } = require('../adapters/vps-codex-runner');
const { classifyCodexJsonl } = require('../adapters/codex-jsonl');

async function waitFor(check, timeout = 2000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('timeout');
}

test('VPS runner 用 stdin 送自然正文并只产出可见回复事件', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vps-codex-runner-'));
  const fakeSsh = path.join(root, 'ssh');
  const received = path.join(root, 'received');
  fs.writeFileSync(fakeSsh, `#!/bin/sh\ncat > "${received}"\nprintf '会客正窗收到啦\\n'\n`, { mode: 0o700 });
  const spool = path.join(root, 'dispatch-1.jsonl');
  const runner = createVpsCodexRunner({ sshPath: fakeSsh, sshAlias: 'fake', remoteSubmit: '/fake', threadLabel: 'vps-lounge' });
  await runner.start({ threadId: 'vps-lounge', prompt: 'Lisa：宝宝在吗', spoolPath: spool });
  const text = await waitFor(() => {
    const value = fs.readFileSync(spool, 'utf8');
    return value.includes('turn.completed') && value;
  });
  assert.equal(fs.readFileSync(received, 'utf8'), 'Lisa：宝宝在吗');
  const result = classifyCodexJsonl(text, 'vps-lounge');
  assert.equal(result.state, 'replied');
  assert.equal(result.reply.content, '会客正窗收到啦');
  assert.equal(text.includes('Lisa：宝宝在吗'), false);
});
