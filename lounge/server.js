'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const STATIC_ROOT = path.join(__dirname, 'public');
const MAX_BODY = 32 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const REFUSAL_MESSAGE = {
  codex_confirmation_required: '这次 Codex 调用还没有得到你的明确确认',
  daily_cap: '今天的会客厅调用预算已经到安全上限',
  auto_turns_exhausted: '今天允许主动发起的双方讨论次数已经用完',
  paused: '会客厅目前处于暂停状态',
  room_stopped: '这次会客已经结束',
  THREAD_BUSY: 'Codex 当前任务正在运行，请等这一轮结束再递话',
  CODEX_CLI_MISSING: '本机没有找到 Codex 命令行桥',
  THREAD_NOT_FOUND: '绑定的 Codex 任务已经找不到了',
};

function refusalMessage(reason) {
  return REFUSAL_MESSAGE[reason] || `这次投递被安全闸拒绝：${reason || 'unknown'}`;
}

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function fail(res, status, code, message) {
  json(res, status, { error: code, message });
}

function safeHealth(value) {
  if (!value || typeof value !== 'object') return value;
  const allowed = ['online', 'running', 'lastActivityAt', 'isArchived', 'error', 'transport'];
  return Object.fromEntries(allowed.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
}

async function bodyOf(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('请求正文过大'), { status: 413, code: 'BODY_TOO_LARGE' });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON 格式不正确'), { status: 400, code: 'BAD_JSON' }); }
}

function safeRoom(orch, roomId) {
  const room = orch.getRoom(roomId);
  if (!room) return null;
  const dispatches = orch.db.prepare(
    'SELECT dispatch_id,room_id,target,message_id,status,automatic,created_at,delivered_at,resolved_at FROM dispatches WHERE room_id=? ORDER BY created_at,rowid',
  ).all(roomId);
  return {
    room: {
      room_id: room.room_id,
      title: room.title,
      mode: room.mode,
      status: room.status,
      max_auto_turns: room.max_auto_turns,
      auto_turns_used: room.auto_turns_used,
      calls_today: room.calls_today,
      usage_today: room.usage_today,
      daily_char_cap: room.daily_char_cap,
      daily_call_cap: room.daily_call_cap,
      pause_requested: room.pause_requested,
      created_at: room.created_at,
      updated_at: room.updated_at,
    },
    messages: orch.listMessages(roomId),
    dispatches,
    budget: orch.budget(roomId),
  };
}

function createEventHub() {
  const rooms = new Map();
  return {
    add(roomId, res) {
      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      rooms.get(roomId).add(res);
    },
    remove(roomId, res) {
      const set = rooms.get(roomId);
      if (!set) return;
      set.delete(res);
      if (!set.size) rooms.delete(roomId);
    },
    emit(roomId, event, data) {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      for (const res of rooms.get(roomId) || []) res.write(payload);
    },
  };
}

function createLoungeServer({
  orch,
  landlord = null,
  roomDefaults = {},
  runtime = { mode: 'preview', cc: 'preview', codex: 'preview' },
  healthTargets = {},
  staticRoot = STATIC_ROOT,
} = {}) {
  if (!orch) throw new Error('createLoungeServer requires orchestrator');
  const events = createEventHub();
  const lateWatchers = new Map();

  function roomState(roomId) {
    const state = safeRoom(orch, roomId);
    if (state && landlord) state.landlord = landlord.current(roomId);
    return state;
  }

  function snapshot(roomId) {
    const state = roomState(roomId);
    if (state) events.emit(roomId, 'snapshot', state);
    return state;
  }

  async function withProgress(roomId, operation) {
    snapshot(roomId);
    // 进度只用于让页面知道仍在等待；不需要以动画帧级频率重发整份房间。
    const ticker = setInterval(() => snapshot(roomId), 750);
    try { return await operation(); }
    finally {
      clearInterval(ticker);
      snapshot(roomId);
    }
  }

  function watchLateReply(roomId, dispatchId) {
    if (!dispatchId || lateWatchers.has(dispatchId)) return;
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        const result = await orch.collectExisting(dispatchId);
        if (result.status === 'replied' || result.status === 'skipped'
          || Date.now() - started > 30 * 60 * 1000) {
          clearInterval(timer);
          lateWatchers.delete(dispatchId);
        }
        snapshot(roomId);
      } catch {
        clearInterval(timer);
        lateWatchers.delete(dispatchId);
      }
    }, 2000);
    if (typeof timer.unref === 'function') timer.unref();
    lateWatchers.set(dispatchId, timer);
  }

  async function route(req, res, url) {
    const method = req.method || 'GET';
    const parts = url.pathname.split('/').filter(Boolean);

    if (method === 'GET' && url.pathname === '/api/health') {
      const [cc, codex] = await Promise.all([
        orch.adapters.cc.getHealth(healthTargets.cc),
        orch.adapters.codex.getHealth(healthTargets.codex),
      ]);
      return json(res, 200, {
        ok: true,
        bind: '127.0.0.1',
        runtime,
        adapters: { cc: safeHealth(cc), codex: safeHealth(codex) },
      });
    }

    if (method === 'POST' && url.pathname === '/api/rooms') {
      const b = await bodyOf(req);
      const room = orch.createRoom({
        ...roomDefaults,
        title: typeof b.title === 'string' && b.title.trim() ? b.title.trim().slice(0, 80) : '三方会客厅',
      });
      return json(res, 201, safeRoom(orch, room.room_id));
    }

    if (method === 'GET' && url.pathname === '/api/rooms/current') {
      const room = orch.db.prepare(`SELECT room_id FROM rooms WHERE status != 'stopped'
        ORDER BY updated_at DESC, created_at DESC, rowid DESC LIMIT 1`).get();
      if (!room) return fail(res, 404, 'ROOM_NOT_FOUND', '当前还没有会客厅');
      return json(res, 200, roomState(room.room_id));
    }

    if (parts[0] === 'api' && parts[1] === 'rooms' && parts[2]) {
      const roomId = parts[2];
      if (!orch.getRoom(roomId)) return fail(res, 404, 'ROOM_NOT_FOUND', '这间会客厅不存在');

      if (method === 'GET' && parts.length === 3) return json(res, 200, roomState(roomId));

      if (method === 'GET' && parts[3] === 'events') {
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        });
        events.add(roomId, res);
        res.write(`event: snapshot\ndata: ${JSON.stringify(roomState(roomId))}\n\n`);
        const keepalive = setInterval(() => res.write(': keepalive\n\n'), 15000);
        req.on('close', () => {
          clearInterval(keepalive);
          events.remove(roomId, res);
        });
        return;
      }

      if (method === 'POST' && parts[3] === 'messages') {
        const b = await bodyOf(req);
        const content = typeof b.content === 'string' ? b.content.trim() : '';
        if (!content) return fail(res, 400, 'EMPTY_MESSAGE', '先写一句想说的话');
        if (content.length > 6000) return fail(res, 400, 'MESSAGE_TOO_LONG', '单条消息最多 6000 字');
        const message = orch.postLisaMessage(roomId, content);
        snapshot(roomId);
        return json(res, 201, { message, state: safeRoom(orch, roomId) });
      }

      if (landlord && parts[3] === 'landlord') {
        if (method === 'GET' && parts.length === 4) return json(res, 200, { game: landlord.current(roomId) });
        if (method === 'POST' && parts[4] === 'start') {
          const b = await bodyOf(req);
          if (b.codex_confirmed !== true) return fail(res, 409, 'CODEX_CONFIRMATION_REQUIRED', '请先确认本局允许在轮到 Codex 时自动叫醒一次');
          const game = landlord.start(roomId, { codexConfirmed: true });
          return json(res, 201, { game, state: snapshot(roomId) });
        }
        if (method === 'POST' && parts[4] === 'action') {
          const b = await bodyOf(req);
          const current = landlord.current(roomId);
          if (!current || current.game_id !== b.game_id) return fail(res, 404, 'GAME_NOT_FOUND', '当前牌局不存在');
          const game = await withProgress(roomId, () => landlord.lisaAction(b.game_id, b.action || {}));
          return json(res, 200, { game, state: snapshot(roomId) });
        }
        if (method === 'POST' && parts[4] === 'sync') {
          const b = await bodyOf(req);
          const current = landlord.current(roomId);
          if (!current || current.game_id !== b.game_id) return fail(res, 404, 'GAME_NOT_FOUND', '当前牌局不存在');
          const game = await landlord.sync(b.game_id);
          return json(res, 200, { game, state: snapshot(roomId) });
        }
      }

      if (method === 'POST' && parts[3] === 'dispatch') {
        const b = await bodyOf(req);
        if (!['yanqiu', 'codex'].includes(b.target)) return fail(res, 400, 'BAD_TARGET', '目标只能是言秋或 Codex');
        const messageIds = Array.isArray(b.message_ids) && b.message_ids.length ? b.message_ids : [b.message_id].filter(Boolean);
        if (!messageIds.length) return fail(res, 400, 'MESSAGE_REQUIRED', '缺少要转交的消息');
        const source = orch.composeLisaMessages(roomId, messageIds);
        const context = orch.composeContextForTarget(roomId, b.target, {
          fallbackMessageId: source.message_id,
        });
        const result = await withProgress(roomId, () => orch.dispatch({
          room_id: roomId,
          target: b.target,
          message_id: context.message_id,
          codex_confirmed: b.target === 'codex' ? b.codex_confirmed === true : false,
        }));
        if (result.status === 'needs_attention' && result.reason === 'timeout') {
          watchLateReply(roomId, result.dispatch_id);
        }
        const state = snapshot(roomId);
        return json(res, result.status === 'refused' ? 409 : 200, {
          result,
          state,
          ...(result.status === 'refused' ? { message: refusalMessage(result.reason) } : {}),
        });
      }

      if (method === 'POST' && parts[3] === 'summon') {
        const b = await bodyOf(req);
        if (!['yanqiu', 'codex'].includes(b.target)) return fail(res, 400, 'BAD_TARGET', '目标只能是言秋或 Codex');
        const invitation = orch.composeSummon(roomId, b.target);
        const result = await withProgress(roomId, () => orch.dispatch({
          room_id: roomId,
          target: b.target,
          message_id: invitation.message_id,
          codex_confirmed: b.target === 'codex' ? b.codex_confirmed === true : false,
        }));
        if (result.status === 'needs_attention' && result.reason === 'timeout') {
          watchLateReply(roomId, result.dispatch_id);
        }
        const state = snapshot(roomId);
        return json(res, result.status === 'refused' ? 409 : 200, {
          result,
          state,
          ...(result.status === 'refused' ? { message: refusalMessage(result.reason) } : {}),
        });
      }

      if (method === 'POST' && parts[3] === 'handoff') {
        const b = await bodyOf(req);
        if (!['yanqiu', 'codex'].includes(b.target)) return fail(res, 400, 'BAD_TARGET', '接手人只能是言秋或 Codex');
        const messageIds = Array.isArray(b.message_ids) && b.message_ids.length ? b.message_ids : [b.message_id].filter(Boolean);
        if (!messageIds.length) return fail(res, 400, 'MESSAGE_REQUIRED', '缺少要交接的施工内容');
        const handoff = orch.composeHandoff(roomId, messageIds, b.target);
        const result = await withProgress(roomId, () => orch.dispatch({
          room_id: roomId,
          target: b.target,
          message_id: handoff.message_id,
          codex_confirmed: b.target === 'codex' ? b.codex_confirmed === true : false,
        }));
        if (result.status === 'needs_attention' && result.reason === 'timeout') {
          watchLateReply(roomId, result.dispatch_id);
        }
        const state = snapshot(roomId);
        return json(res, result.status === 'refused' ? 409 : 200, {
          result,
          state,
          ...(result.status === 'refused' ? { message: refusalMessage(result.reason) } : {}),
        });
      }

      if (method === 'POST' && parts[3] === 'run-one-each') {
        const b = await bodyOf(req);
        const messageIds = Array.isArray(b.message_ids) && b.message_ids.length ? b.message_ids : [b.message_id].filter(Boolean);
        if (!messageIds.length) return fail(res, 400, 'MESSAGE_REQUIRED', '缺少要讨论的消息');
        const source = orch.composeLisaMessages(roomId, messageIds);
        const result = await withProgress(roomId, () => orch.runOneEach({
          room_id: roomId,
          lisa_message_id: source.message_id,
          first_speaker: b.first_speaker === 'codex' ? 'codex' : 'yanqiu',
          codex_confirmed: b.codex_confirmed === true,
        }));
        for (const baton of result.results || []) {
          if (baton.status === 'needs_attention' && baton.reason === 'timeout') {
            watchLateReply(roomId, baton.dispatch_id);
          }
        }
        const state = snapshot(roomId);
        return json(res, result.refused ? 409 : 200, {
          result,
          state,
          ...(result.refused ? { message: refusalMessage(result.reason) } : {}),
        });
      }

      if (method === 'POST' && parts[3] === 'pause') {
        orch.pause(roomId);
        const state = snapshot(roomId);
        return json(res, 200, state);
      }

      if (method === 'POST' && parts[3] === 'stop') {
        orch.stop(roomId);
        const state = snapshot(roomId);
        return json(res, 200, state);
      }
    }

    if (parts[0] === 'api' && parts[1] === 'dispatch' && parts[2] && method === 'POST') {
      const dispatchId = parts[2];
      const dispatch = orch.getDispatch(dispatchId);
      if (!dispatch) return fail(res, 404, 'DISPATCH_NOT_FOUND', '这次投递不存在');
      let result;
      if (parts[3] === 'retry') result = await orch.retry(dispatchId);
      else if (parts[3] === 'abandon') result = orch.abandon(dispatchId);
      else return fail(res, 404, 'NOT_FOUND', '接口不存在');
      const state = snapshot(dispatch.room_id);
      return json(res, 200, { result, state });
    }

    if (method === 'GET' && !url.pathname.startsWith('/api/')) {
      const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const file = path.resolve(staticRoot, relative);
      if (file !== path.resolve(staticRoot) && !file.startsWith(`${path.resolve(staticRoot)}${path.sep}`)) {
        return fail(res, 403, 'FORBIDDEN', '路径不可访问');
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return fail(res, 404, 'NOT_FOUND', '页面不存在');
      const ext = path.extname(file);
      res.writeHead(200, {
        'content-type': MIME[ext] || 'application/octet-stream',
        // 本地工具更新后必须立刻拿到同版 JS/CSS；旧前端会继续全量重画并造成抖动。
        'cache-control': 'no-store',
        'content-security-policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'",
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      });
      fs.createReadStream(file).pipe(res);
      return;
    }

    return fail(res, 404, 'NOT_FOUND', '接口不存在');
  }

  const server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host || '127.0.0.1';
      await route(req, res, new URL(req.url || '/', `http://${host}`));
    } catch (error) {
      const status = error.status || (error.code === 'LOCKED' ? 409 : 500);
      const code = error.code || 'INTERNAL_ERROR';
      fail(res, status, code, status >= 500 ? '会客厅刚刚绊了一下，请看本机日志' : error.message);
    }
  });
  server.on('close', () => {
    for (const timer of lateWatchers.values()) clearInterval(timer);
    lateWatchers.clear();
  });
  return { server, events, snapshot, watchLateReply };
}

module.exports = { createLoungeServer, safeRoom, safeHealth, bodyOf };
