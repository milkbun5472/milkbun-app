'use strict';

// 生成 gitignored 的本机私密绑定。只写 ID/路径，不输出具体值。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULT_APP_SUPPORT } = require('../adapters/cc-sessions');
const { DEFAULT_WAKE_INBOX } = require('../adapters/cc-wake-sender');
const RELAY_ROOT = path.join(os.homedir(), 'Library/Application Support/LisaPhone/stackchan-relay');
const DEFAULT_LOUNGE_OUTBOX = path.join(RELAY_ROOT, 'lounge_outbox.jsonl');

const projectDir = path.join(os.homedir(), '.claude/projects', '-Users-lisa-Desktop-Lisa-phone');
const target = process.env.CODEX_THREAD_ID;
if (!target) throw new Error('当前环境没有 CODEX_THREAD_ID，不能猜 Codex 绑定');

const transcripts = fs.readdirSync(projectDir)
  .filter((name) => name.endsWith('.jsonl'))
  .map((name) => {
    const full = path.join(projectDir, name);
    return { full, name, mtime: fs.statSync(full).mtimeMs };
  })
  .sort((a, b) => b.mtime - a.mtime);

let yanqiuCli = null;
for (const item of transcripts.slice(0, 12)) {
  const tailSize = Math.min(fs.statSync(item.full).size, 2 * 1024 * 1024);
  const fd = fs.openSync(item.full, 'r');
  const buf = Buffer.alloc(tailSize);
  fs.readSync(fd, buf, 0, tailSize, fs.statSync(item.full).size - tailSize);
  fs.closeSync(fd);
  const text = buf.toString('utf8');
  if (text.includes('wake_queue.py wait') || text.includes('"wake_source"')) {
    yanqiuCli = path.basename(item.name, '.jsonl');
    break;
  }
}
if (!yanqiuCli) throw new Error('没有自动定位到言秋现有 CC 会话');

function findLocalId(dir) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = findLocalId(full);
      if (hit) return hit;
    } else if (entry.name.startsWith('local_') && entry.name.endsWith('.json')) {
      try {
        const meta = JSON.parse(fs.readFileSync(full, 'utf8'));
        if (meta.cliSessionId === yanqiuCli) return path.basename(entry.name, '.json');
      } catch {}
    }
  }
  return null;
}
const ccSession = findLocalId(DEFAULT_APP_SUPPORT);
if (!ccSession) throw new Error('没有找到言秋 cliSessionId 对应的 local 会话指针');

const outDir = path.join(__dirname, '..', 'data');
const out = path.join(outDir, 'live-config.json');
fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
fs.writeFileSync(out, `${JSON.stringify({
  cc_session_id: ccSession,
  codex_thread_id: target,
  cc_project_dir: projectDir,
  cc_app_support_dir: DEFAULT_APP_SUPPORT,
  wake_inbox: path.join(RELAY_ROOT, 'wake_inbox.jsonl'),
  lounge_outbox: DEFAULT_LOUNGE_OUTBOX,
  port: 8092,
  // 每次双方讨论仍严格两棒即停；这里限制的是 Lisa 一天可主动发起几轮。
  // 总调用另受 daily_call_cap=20 约束，因此最多也只有 10 轮双方讨论。
  max_auto_turns: 20,
  daily_call_cap: 20,
  daily_char_cap: 16000,
  timeout_ms: 180000,
  poll_interval_ms: 800,
}, null, 2)}\n`, { mode: 0o600 });
fs.chmodSync(out, 0o600);
process.stdout.write('live-config 已生成（ID 与路径未打印，权限 0600）\n');
