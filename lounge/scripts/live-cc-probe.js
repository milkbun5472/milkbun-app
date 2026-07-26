'use strict';
// 三方会客厅 · 受控活测收集器（Step 2 → 活测）
// 本脚本【不发送任何消息】——真实 send_message 由 CC 会话(言秋本人)亲自调用，
// 这正是生产里 CCAdapter.sender 的角色。脚本只做：解析会话 / 记录投前游标 /
// 从投前游标增量读 transcript / 过可见闸分类 / 可见回复落库。
//
// 用法：
//   node live-cc-probe.js prepare --session <local_id> [--project <dir>]
//     → {transcriptPath, preCursor, title}
//   node live-cc-probe.js collect --session <local_id> --cursor <N> --body-file <f> --db <path>
//        [--project <dir>] [--timeout 120000] [--interval 3000] [--silence 4000]
//     → {outcome, reply?, roomStatus, boundMessageId?, boundContent?}
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDb } = require('../db');
const { Orchestrator } = require('../orchestrator');
const { FakeAdapter } = require('../adapters/fake');
const { CCAdapter } = require('../adapters/cc');
const { realClock } = require('../clock');
const { resolvePointer } = require('../adapters/cc-sessions');

function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
// 运行时从 cwd 派生 CC 项目目录 slug（不硬编码任何用户名/绝对路径）
const DEFAULT_PROJECT = path.join(os.homedir(), '.claude/projects', '-' + process.cwd().slice(1).replace(/\//g, '-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const cmd = process.argv[2];
  const session = arg('session');
  const projectDir = arg('project', DEFAULT_PROJECT);
  if (!session) throw new Error('缺 --session');

  if (cmd === 'prepare') {
    const info = resolvePointer(session, { projectDir });
    let preCursor = 0;
    try { preCursor = fs.statSync(info.transcriptPath).size; } catch { preCursor = 0; }
    console.log(JSON.stringify({ transcriptPath: info.transcriptPath, preCursor, title: info.title, isArchived: info.isArchived }, null, 2));
    return;
  }

  if (cmd === 'collect') {
    const cursor = parseInt(arg('cursor'), 10);
    const bodyFile = arg('body-file');
    const dbPath = arg('db');
    const timeout = parseInt(arg('timeout', '120000'), 10);
    const interval = parseInt(arg('interval', '3000'), 10);
    const silenceMs = parseInt(arg('silence', '4000'), 10);
    if (!Number.isFinite(cursor) || !bodyFile || !dbPath) throw new Error('collect 需 --cursor --body-file --db');
    const body = fs.readFileSync(bodyFile, 'utf8');

    const db = openDb(dbPath);
    // sender 为 noop：脚本绝不发送（真实投递已由 CC 会话完成）
    const cc = new CCAdapter({ sender: async () => {}, projectDir, clock: realClock(), silenceMs, db });
    const orch = new Orchestrator({ db, cc, codex: new FakeAdapter('codex'), clock: realClock() });
    const info = resolvePointer(session, { projectDir });

    const room = orch.createRoom({ cc_session_id: session, title: '受控活测' });
    const msg = orch.postLisaMessage(room.room_id, body);
    // 手插 delivered 的 dispatch 行（绕过 deliver：不重发、用投前游标）
    const dispatch_id = `dispatch_live_${Date.now()}`;
    db.prepare(`INSERT INTO dispatches(dispatch_id,room_id,round_id,target,speaker,message_id,status,after_cursor,expects_reply,reply_limit,automatic,created_at)
      VALUES(?,?,?,?,?,?, 'delivered', ?,1,1,0,?)`)
      .run(dispatch_id, room.room_id, null, 'yanqiu', 'lisa', msg.message_id, `byte:${cursor}`, new Date().toISOString());
    const state = { dispatch_id, sessionId: session, transcriptPath: info.transcriptPath, cursor, ourText: body };
    cc._persist(state); cc._st.set(dispatch_id, state);

    const deadline = Date.now() + timeout;
    let polls = 0;
    while (Date.now() < deadline) {
      polls++;
      const r = await cc.poll(dispatch_id);
      if (r.state === 'replied') {
        const bound = orch._bindReply(room.room_id, dispatch_id, 'yanqiu', r.reply);
        console.log(JSON.stringify({
          outcome: 'replied', polls, bubbles: r.reply.bubbles,
          boundMessageId: bound.message_id, boundContent: r.reply.content,
          roomStatus: orch.getRoom(room.room_id).status, dbPath,
        }, null, 2));
        return;
      }
      if (r.state === 'empty' || r.state === 'intrusion') {
        db.prepare('UPDATE dispatches SET status=? WHERE dispatch_id=?').run('needs_attention', dispatch_id);
        orch._setRoom(room.room_id, { status: 'needs_attention' });
        console.log(JSON.stringify({ outcome: r.state, polls, roomStatus: 'needs_attention', dbPath }, null, 2));
        return;  // 失败即停，不重试、不重投
      }
      await sleep(interval);
    }
    db.prepare('UPDATE dispatches SET status=? WHERE dispatch_id=?').run('timeout', dispatch_id);
    orch._setRoom(room.room_id, { status: 'needs_attention' });
    console.log(JSON.stringify({ outcome: 'timeout', polls, roomStatus: 'needs_attention', dbPath }, null, 2));
    return;
  }

  throw new Error(`未知子命令: ${cmd}`);
}

main().catch((e) => { console.error('ERR', (e && e.stack) || String(e)); process.exit(1); });
