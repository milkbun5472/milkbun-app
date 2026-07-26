'use strict';

const $ = (selector) => document.querySelector(selector);
const ui = {
  timeline: $('#timeline'),
  empty: $('#emptyState'),
  input: $('#messageInput'),
  post: $('#postButton'),
  tray: $('#dispatchTray'),
  summon: $('#summonDock'),
  batchPrompt: $('#batchPrompt'),
  pause: $('#pauseButton'),
  notice: $('#notice'),
  status: $('#roomStatus'),
  runtime: $('#runtimeBadge'),
  callCount: $('#callCount'),
  budgetButton: $('#budgetButton'),
  budgetPanel: $('#budgetPanel'),
  callBudget: $('#callBudget'),
  charBudget: $('#charBudget'),
  callMeter: $('#callMeter'),
  charMeter: $('#charMeter'),
  ccPresence: $('#ccPresence'),
  codexPresence: $('#codexPresence'),
  dialog: $('#confirmDialog'),
  firstSpeaker: $('#firstSpeaker'),
  confirmBoth: $('#confirmBoth'),
  handoffDialog: $('#handoffDialog'),
  handoffTarget: $('#handoffTarget'),
  confirmHandoff: $('#confirmHandoff'),
};

const state = {
  roomId: sessionStorage.getItem('lounge.roomId'),
  snapshot: null,
  selectedMessageIds: [],
  busy: false,
  stream: null,
  timelineSignature: null,
};

const STATUS = {
  paused: '等你主持',
  dispatching: '正在递话',
  waiting_reply: '等待回复',
  needs_attention: '需要你处理',
  stopped: '本次会客结束',
};

function text(tag, value, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = value;
  return el;
}

function formatTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.valueOf()) ? '' : d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function showNotice(message) {
  ui.notice.textContent = message;
  ui.notice.hidden = false;
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => { ui.notice.hidden = true; }, 5500);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
  return data;
}

function latestLisaBatch(snapshot) {
  const batch = [];
  for (let i = snapshot.messages.length - 1; i >= 0; i -= 1) {
    const message = snapshot.messages[i];
    if (message.speaker !== 'lisa') break;
    if (message.automatic) break; // 已合并递出的上一组消息是批次边界
    if (message.origin === 'lounge') batch.unshift(message);
  }
  return batch;
}

function renderMessages(messages) {
  ui.timeline.replaceChildren();
  if (!messages.length) {
    ui.timeline.append(ui.empty);
    return;
  }
  for (const message of messages.filter((m) => !m.automatic)) {
    const wrap = document.createElement('article');
    wrap.className = `message ${message.speaker}-message`;
    const avatar = text('span', message.speaker === 'lisa' ? 'L' : message.speaker === 'yanqiu' ? '秋' : 'C', 'message-avatar');
    const body = document.createElement('div');
    body.className = 'message-body';
    const head = document.createElement('div');
    head.className = 'message-head';
    head.append(
      text('span', message.speaker === 'lisa' ? 'Lisa' : message.speaker === 'yanqiu' ? '言秋' : 'Codex'),
      text('time', formatTime(message.created_at)),
    );
    body.append(head, text('div', message.content, 'bubble'));
    wrap.append(avatar, body);
    ui.timeline.append(wrap);
  }
  const room = state.snapshot && state.snapshot.room;
  if (room && ['dispatching', 'waiting_reply'].includes(room.status)) {
    ui.timeline.append(text('div', room.status === 'dispatching' ? '正在把话递进原来的窗口…' : '对方正在原来的窗口里回复…', 'system-strip'));
  }
}

function ratioWidth(used, cap) {
  if (!cap) return 0;
  return Math.min(100, Math.round((used / cap) * 100));
}

function render(snapshot) {
  state.snapshot = snapshot;
  const room = snapshot.room;
  ui.status.textContent = STATUS[room.status] || room.status;
  ui.status.dataset.status = room.status;
  ui.pause.disabled = room.status === 'stopped';
  ui.callCount.textContent = room.calls_today;
  ui.callBudget.textContent = `${room.calls_today} / ${room.daily_call_cap || '不限'}`;
  ui.charBudget.textContent = `${room.usage_today} / ${room.daily_char_cap || '不限'}`;
  ui.callMeter.style.width = `${ratioWidth(room.calls_today, room.daily_call_cap)}%`;
  ui.charMeter.style.width = `${ratioWidth(room.usage_today, room.daily_char_cap)}%`;
  ui.budgetButton.dataset.level = snapshot.budget.level;
  // 等待回复时服务端会连续发进度快照。消息和状态没变就不要拆掉整条
  // 时间线重建，否则输入框和页面布局会跟着每次进度快照抖一下。
  const timelineSignature = JSON.stringify({
    status: room.status,
    messages: snapshot.messages.map((m) => [m.message_id, m.content, m.created_at, m.automatic]),
  });
  if (timelineSignature !== state.timelineSignature) {
    state.timelineSignature = timelineSignature;
    renderMessages(snapshot.messages);
  }
  const batch = latestLisaBatch(snapshot);
  if (batch.length) {
    ui.batchPrompt.textContent = batch.length === 1
      ? '本批共 1 条，要先递给谁？'
      : `本批共 ${batch.length} 条，会合成一张票递出：`;
  }
  const already = batch.length && batch.every((m) => snapshot.dispatches.some((d) => d.message_id === m.message_id));
  if (!state.busy && batch.length && !already && room.status !== 'stopped') {
    state.selectedMessageIds = batch.map((m) => m.message_id);
    ui.tray.hidden = false;
  } else if (!state.busy) {
    ui.tray.hidden = true;
  }
}

async function postMessage() {
  const content = ui.input.value.trim();
  if (!content || state.busy) return;
  setBusy(true);
  try {
    const data = await api(`/api/rooms/${state.roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    ui.input.value = '';
    $('#charCount').textContent = '0 / 6000';
    state.selectedMessageIds = latestLisaBatch(data.state).map((m) => m.message_id);
    render(data.state);
    ui.tray.hidden = false;
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  } catch (error) { showNotice(error.message); }
  finally { setBusy(false); }
}

function setBusy(value) {
  state.busy = value;
  ui.post.disabled = value;
  ui.input.disabled = value;
  for (const button of ui.tray.querySelectorAll('button')) button.disabled = value;
  for (const button of ui.summon.querySelectorAll('button')) button.disabled = value;
  if (value) ui.tray.hidden = true;
}

async function summon(target) {
  if (state.busy) return;
  setBusy(true);
  try {
    const data = await api(`/api/rooms/${state.roomId}/summon`, {
      method: 'POST',
      body: JSON.stringify({ target, codex_confirmed: target === 'codex' }),
    });
    render(data.state);
  } catch (error) { showNotice(error.message); await refresh(); }
  finally { setBusy(false); }
}

async function dispatch(target) {
  if (!state.selectedMessageIds.length || state.busy) return;
  if (target === 'both') {
    ui.dialog.showModal();
    return;
  }
  if (target === 'handoff') {
    ui.handoffDialog.showModal();
    return;
  }
  setBusy(true);
  try {
    const data = await api(`/api/rooms/${state.roomId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({
        target,
        message_ids: state.selectedMessageIds,
        codex_confirmed: target === 'codex',
      }),
    });
    render(data.state);
  } catch (error) { showNotice(error.message); await refresh(); }
  finally { setBusy(false); }
}

async function handoff() {
  if (!state.selectedMessageIds.length || state.busy) return;
  setBusy(true);
  try {
    const target = ui.handoffTarget.value;
    const data = await api(`/api/rooms/${state.roomId}/handoff`, {
      method: 'POST',
      body: JSON.stringify({
        target,
        message_ids: state.selectedMessageIds,
        codex_confirmed: target === 'codex',
      }),
    });
    render(data.state);
  } catch (error) { showNotice(error.message); await refresh(); }
  finally { setBusy(false); }
}

async function runBoth() {
  if (!state.selectedMessageIds.length || state.busy) return;
  setBusy(true);
  try {
    const data = await api(`/api/rooms/${state.roomId}/run-one-each`, {
      method: 'POST',
      body: JSON.stringify({
        message_ids: state.selectedMessageIds,
        first_speaker: ui.firstSpeaker.value,
        codex_confirmed: true,
      }),
    });
    render(data.state);
  } catch (error) { showNotice(error.message); await refresh(); }
  finally { setBusy(false); }
}

async function refresh() {
  if (!state.roomId) return;
  const snapshot = await api(`/api/rooms/${state.roomId}`);
  render(snapshot);
}

function connectEvents() {
  if (state.stream) state.stream.close();
  state.stream = new EventSource(`/api/rooms/${state.roomId}/events`);
  state.stream.addEventListener('snapshot', (event) => {
    try { render(JSON.parse(event.data)); } catch {}
  });
  state.stream.onerror = () => {
    ui.status.textContent = '本地连接重试中';
  };
}

async function init() {
  try {
    const health = await api('/api/health');
    const preview = health.runtime.mode === 'preview';
    const onlineText = (healthInfo) => preview
      ? (healthInfo.online ? '模拟连接' : '模拟离线')
      : (healthInfo.online ? '已连接' : '未连接');
    ui.ccPresence.textContent = onlineText(health.adapters.cc);
    ui.codexPresence.textContent = onlineText(health.adapters.codex);
    if (health.runtime.mode === 'preview') {
      ui.runtime.hidden = false;
      ui.runtime.textContent = '本地预览 · 不调用真实窗口';
    }
    if (state.roomId) {
      try { await refresh(); }
      catch { state.roomId = null; sessionStorage.removeItem('lounge.roomId'); }
    }
    if (!state.roomId) {
      const created = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ title: '三方会客厅' }) });
      state.roomId = created.room.room_id;
      sessionStorage.setItem('lounge.roomId', state.roomId);
      render(created);
    }
    connectEvents();
  } catch (error) {
    showNotice(`本地会客厅没有接上：${error.message}`);
  }
}

ui.post.addEventListener('click', postMessage);
ui.input.addEventListener('input', () => {
  $('#charCount').textContent = `${ui.input.value.length} / 6000`;
  ui.input.style.height = 'auto';
  ui.input.style.height = `${Math.min(180, ui.input.scrollHeight)}px`;
});
ui.input.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') postMessage();
});
ui.tray.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (button) dispatch(button.dataset.action);
});
ui.summon.addEventListener('click', (event) => {
  const button = event.target.closest('[data-summon]');
  if (button) summon(button.dataset.summon);
});
ui.pause.addEventListener('click', async () => {
  try { render(await api(`/api/rooms/${state.roomId}/pause`, { method: 'POST', body: '{}' })); }
  catch (error) { showNotice(error.message); }
});
ui.budgetButton.addEventListener('click', () => {
  ui.budgetPanel.hidden = !ui.budgetPanel.hidden;
  ui.budgetButton.setAttribute('aria-expanded', String(!ui.budgetPanel.hidden));
});
ui.confirmBoth.addEventListener('click', (event) => {
  event.preventDefault();
  ui.dialog.close();
  runBoth();
});
ui.confirmHandoff.addEventListener('click', (event) => {
  event.preventDefault();
  ui.handoffDialog.close();
  handoff();
});

init();
