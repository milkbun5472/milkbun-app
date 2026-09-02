(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ChatRooms = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const STORAGE_KEY = "x_chatRooms_v1";
  const SUMMARY_KEY = "x_chatRoomSummaries_v1";
  const MAIN_ID = "main";
  const GROUPS = {
    cognition: [
      ["formalMemory", "正式记忆", "可读取这个人的正式记忆与共同经历"],
      ["innerLife", "关系与内在状态", "可读取关系、情绪与人格成长"],
      ["mainDelta", "主房近况", "侧房回来时补看主聊天后来发生的事"],
      ["schedule", "现实时间与行程", "可感知现实钟、角色当地时间与当前行程"],
      ["otherScenes", "群聊与线下", "可参考共同群聊和线下相处留下的事实"]
    ],
    actions: [
      ["study", "一起学", "允许在本房自然提议一起学"],
      ["games", "小游戏", "允许在本房自然提议玩小游戏"]
    ],
    writeback: [
      ["roomHistory", "保留本房聊天", "始终保留这间房自己的完整时间线"],
      ["memoryCandidate", "进入记忆候选", "重要内容可进入候选箱，仍需现有记忆闸判断"],
      ["sharedState", "影响共同状态", "允许这间房更新关系、情绪、动作等共享状态"],
      ["stateMood", "其中·改写心情", "关掉后这间房不改主线的实时心情（需先开「影响共同状态」）"],
      ["stateGaze", "其中·改写印象卡", "关掉后这间房不改「Ta 眼里」（需先开「影响共同状态」）"],
      ["mainSummary", "给主房留交接", "离开侧房后，给主房一份可追溯的房间摘要"]
    ]
  };
  const bools = (entries, on) => Object.fromEntries(entries.map(([key]) => [key, !!on]));
  const PRESETS = {
    everyday: { label: "慢慢聊这件事", note: "另留一条长期话题，也跟得上你们的日常近况", cognition: { ...bools(GROUPS.cognition, true) }, actions: { ...bools(GROUPS.actions, true) }, writeback: { ...bools(GROUPS.writeback, true) }, syncMode: "follow" },
    focused: { label: "一起做件事", note: "把课程、计划或长期项目收在一条不跑题的分线里", cognition: { ...bools(GROUPS.cognition, true), otherScenes: false }, actions: { ...bools(GROUPS.actions, false), study: true }, writeback: { ...bools(GROUPS.writeback, false), roomHistory: true, memoryCandidate: true, mainSummary: true }, syncMode: "ask" },
    isolated: { label: "不带出门", note: "只在这里成立，不补主线、不改共同状态，也不进入记忆", cognition: { ...bools(GROUPS.cognition, false) }, actions: { ...bools(GROUPS.actions, false) }, writeback: { ...bools(GROUPS.writeback, false), roomHistory: true }, syncMode: "frozen" },
    alternate: { label: "长篇如果", note: "让同一个人带着另一段年龄、处境或关系与你长期对话", cognition: { ...bools(GROUPS.cognition, false) }, actions: { ...bools(GROUPS.actions, false) }, writeback: { ...bools(GROUPS.writeback, false), roomHistory: true }, syncMode: "frozen" }
  };

  const clone = obj => JSON.parse(JSON.stringify(obj));
  const id = () => "room_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  const mainRoom = personId => ({ id: MAIN_ID, personId: String(personId), createdAt: 0, updatedAt: Date.now(), ...clone(PRESETS.everyday), actions: bools(GROUPS.actions, false), name: "主聊天", main: true, preset: "everyday" });
  function normalize(room, personId) {
    const base = room && room.id === MAIN_ID ? mainRoom(personId) : { id: room && room.id || id(), personId: String(personId), name: "新房间", main: false, createdAt: Date.now(), updatedAt: Date.now(), preset: "everyday", ...clone(PRESETS.everyday) };
    const src = room || {};
    return {
      ...base, ...src, personId: String(personId), name: String(src.name || base.name).trim().slice(0, 24) || base.name,
      purpose: String(src.purpose || "").trim().slice(0, 120),
      scenario: String(src.scenario || "").trim().slice(0, 3000),
      cognition: { ...base.cognition, ...(src.cognition || {}) },
      actions: base.main ? bools(GROUPS.actions, false) : { ...base.actions, ...(src.actions || {}) },
      writeback: { ...base.writeback, ...(src.writeback || {}) },
      syncMode: ["follow", "ask", "frozen"].includes(src.syncMode) ? src.syncMode : base.syncMode,
      syncOnce: !!src.syncOnce,
      mainCursorTs: Number(src.mainCursorTs || 0),
      summaryCursorTs: Number(src.summaryCursorTs || 0),
      summaryFrame: String(src.summaryFrame || "我们刚刚在另一间房里经历了这些："),
      // 交接是拼进 system 的、每轮都发，而且不过 ChatContextWindow 的秤——
      // 摘要一条能到两三千字，六条比整个历史窗口预算还大（她 2026-08-28 让查的冲突①）。
      carryCount: Math.max(1, Math.min(6, Number(src.carryCount || 4))),
      carryChars: Math.max(150, Math.min(1500, Number(src.carryChars || 600))),
      updatedAt: Number(src.updatedAt || Date.now())
    };
  }
  function read() {
    try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (_) { return {}; }
  }
  function write(all) {
    const value = all || {};
    if (typeof saveJSON === "function") return saveJSON(STORAGE_KEY, value) ? value : null;
    try {
      const encoded = JSON.stringify(value);
      localStorage.setItem(STORAGE_KEY, encoded);
      return localStorage.getItem(STORAGE_KEY) === encoded ? value : null;
    } catch (_) { return null; }
  }
  function list(personId) {
    const all = read(), saved = Array.isArray(all[personId]) ? all[personId] : [];
    const savedMain = all.__main && all.__main[personId];
    return [normalize(savedMain ? { ...savedMain, id: MAIN_ID, main: true } : mainRoom(personId), personId), ...saved.filter(r => r && r.id !== MAIN_ID).map(r => normalize(r, personId))];
  }
  function save(personId, room) {
    const all = read(), rooms = Array.isArray(all[personId]) ? all[personId] : [], next = normalize({ ...room, updatedAt: Date.now() }, personId);
    if (next.id === MAIN_ID) {
      const existing = all.__main || {}; existing[personId] = next; all.__main = existing;
    } else {
      const i = rooms.findIndex(r => r.id === next.id); if (i >= 0) rooms[i] = next; else rooms.push(next); all[personId] = rooms;
    }
    // Main settings live separately to avoid inserting a fake side-room row.
    if (next.id === MAIN_ID) all.__main[personId] = next;
    return write(all) ? next : null;
  }
  function get(personId, roomId) {
    if (!roomId || roomId === MAIN_ID) { const all = read(), m = all.__main && all.__main[personId]; return normalize(m ? { ...m, id: MAIN_ID, main: true } : mainRoom(personId), personId); }
    return list(personId).find(r => r.id === roomId) || mainRoom(personId);
  }
  function create(personId, name, preset) {
    const p = PRESETS[preset] || PRESETS.everyday;
    return save(personId, normalize({ id: id(), name: name || p.label, preset: preset || "everyday", ...clone(p), createdAt: Date.now() }, personId));
  }
  function remove(personId, roomId) {
    if (!roomId || roomId === MAIN_ID) return false;
    const all = read(); all[personId] = (all[personId] || []).filter(r => r.id !== roomId); return !!write(all);
  }
  function chatKey(personId, roomId) { return !roomId || roomId === MAIN_ID ? String(personId) : String(personId) + "::room::" + roomId; }
  function isSideKey(key) { return String(key || "").includes("::room::"); }
  function personFromKey(key) { return String(key || "").split("::room::")[0]; }
  // React 的 chats state 是一张按 chatKey 索引的表。侧房消息一直都有单独写盘，
  // 但如果启动时只装主房，重开 App 后侧房看起来就会像被清空一样。
  function hydrateChats(characters, load) {
    const out = {};
    if (typeof load !== "function") return out;
    (Array.isArray(characters) ? characters : []).forEach(character => {
      const personId = String(character && typeof character === "object" ? character.id || "" : character || "");
      if (!personId) return;
      out[personId] = load("x_chat:" + personId, []);
      list(personId).filter(room => room && !room.main).forEach(room => {
        const key = chatKey(personId, room.id);
        out[key] = load("x_chat:" + key, []);
      });
    });
    return out;
  }
  function readSummaries() {
    try { const v = JSON.parse(localStorage.getItem(SUMMARY_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (_) { return []; }
  }
  function addSummary(row) {
    const next = readSummaries().concat([{ id: "rs_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6), ts: Date.now(), ...row }]).slice(-300);
    localStorage.setItem(SUMMARY_KEY, JSON.stringify(next));
    return next[next.length - 1];
  }
  function listSummaries(personId) {
    return readSummaries().filter(x => x && String(x.personId) === String(personId)).sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
  }
  function studySessionsFor(personId) {
    try {
      if (!window.Study || typeof window.Study.loadSessions !== "function") return [];
      return window.Study.loadSessions().filter(s => s && (String(s.teacher_id || "") === String(personId) || (s.character_ids || []).map(String).includes(String(personId))))
        .sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));
    } catch (_) { return []; }
  }
  // 写回闸。sharedState 是总开关，心情和印象卡各自还有一道。
  // ⚠️最要紧的一条：认知里关了「关系与内在状态」时，这两样一律不许写——
  // 心情要拿上一轮当起点（MOOD_TURN_RULE 明写「是起点不是答案」），印象卡更是【整块重写】，
  // 让一间看不见旧内容的房去覆盖它，等于凭空抹掉。自定义房能配出 innerLife=false + sharedState=true
  // 这个组合，所以这道闸必须在代码里，不能只靠开关摆着好看。
  function canWrite(room, kind) {
    if (!room) return true;                         // 没有房间概念＝主线本身
    const w = room.writeback || {}, c = room.cognition || {};
    if (!w.sharedState) return false;
    if (kind === "mood" || kind === "gaze") {
      if (kind === "mood" && w.stateMood === false) return false;
      if (kind === "gaze" && w.stateGaze === false) return false;
      if (!c.innerLife) return false;
    }
    return true;
  }
  function prompt(room, mainMessages) {
    if (!room) return "";
    const c = room.cognition || {}, a = room.actions || {}, w = room.writeback || {};
    const allowedActions = GROUPS.actions.filter(([k]) => a[k]).map(([, label]) => label);
    if (room.id === MAIN_ID) {
      const nCarry = Math.max(1, Math.min(6, Number(room.carryCount || 4)));
      const capCarry = Math.max(150, Math.min(1500, Number(room.carryChars || 600)));
      const carried = listSummaries(room.personId).slice(-nCarry);
      if (!carried.length) return "";
      return "\n\n【从其他房间带回的交接｜是已经发生过的背景，不是对方刚发来的新消息】\n" + carried.map(function (x) {
        const body = String(x.frame || "") + String(x.summary || "");
        return "·「" + (x.roomName || "侧房") + "」：" + (body.length > capCarry ? body.slice(0, capCarry) + "…" : body);
      }).join("\n");
    }
    const lines = ["【当前房间】你和对方正在「" + room.name + "」里交谈。这是一条独立时间线，不要假装侧房里没发生过的对话已经发生。"];
    lines.push(c.schedule
      ? "【时间边界】本房已开启现实时间与行程，可按角色当地时间、现实钟和当前行程自然回应；若它与本房限定设定冲突，以本房设定为准。"
      : "【时间边界】本房未开启现实时间与行程；不要拿主时间线此刻几点、人在何处、下一段行程来约束本房。只以本房设定与本房已经发生的内容判断时间。",
      "【心声边界】本房的未说出口心声只属于本房，单独保存；不得据此改写主房心声、关系成长或人格成长。");
    if (room.purpose) lines.push("【这间房想慢慢继续的事】" + room.purpose + "。它是这条分线的共同方向，不是每轮必须汇报的任务；相关时自然接着，不相关时正常聊天。");
    lines.push("【认知边界】" + GROUPS.cognition.map(([k, label]) => label + (c[k] ? "可用" : "不可用")).join("；") + "。");
    if (allowedActions.length) lines.push("【本房可提议的活动】" + allowedActions.join("、") + "。只需在真的想做时自然开口，不要把它当作每轮任务，也不要假装界面已经打开。");
    if (a.study) {
      const ss = studySessionsFor(room.personId).slice(0, 6);
      lines.push("【一起学邀请规则】先看下面已有课程；主题相关时优先提议续上现有 session。没有合适旧课时，你可以先提出一个轻量课程想法（学什么、为什么此刻想一起学、建议从哪个小点开始），但不能声称已经建课或已经打开界面，必须等对方确认。\n" + (ss.length ? "已有课程：\n" + ss.map(s => "· sessionId=" + s.id + "｜" + (s.title || s.subject || "未命名") + "｜" + (s.subject || "")).join("\n") : "目前没有你参与的已有课程。"));
    }
    const scenarioOn = !!room.scenario;
    lines.push("【写回边界】" + (w.sharedState ? "本房可影响共同状态" : "本房不改变主房关系、情绪、动作等共同状态") + "；" + (w.memoryCandidate ? "重要内容可经过既有闸进入记忆候选" : "本房内容不进入正式记忆或候选") + "；" + (w.mainSummary ? "离房时可以形成一份可追溯交接" : "不向主房生成交接") + "。");
    const mayReadMainDelta = room.syncMode === "follow" || (room.syncMode === "ask" && room.syncOnce);
    if (c.mainDelta && mayReadMainDelta && Array.isArray(mainMessages)) {
      const since = Number(room.mainCursorTs || room.createdAt || 0);
      const delta = mainMessages.filter(m => Number(m.ts || 0) > since && (m.role === "user" || m.role === "assistant") && m.content).slice(-16);
      if (delta.length) lines.push("【主房后来发生的事｜只作参考，不是本房新消息】\n" + delta.map(m => (m.role === "user" ? "对方" : "你") + "：" + String(m.content).slice(0, 300)).join("\n"));
    }
    // 必须压在整份本轮任务的最后。设定负责校准分线，认知/写回权限仍由 Lisa 自由混搭。
    if (scenarioOn) lines.push("【本房限定设定｜本房内优先级最高】\n" + room.scenario + "\n你可以使用上面明确标为可用的背景，也只执行上面明确允许的写回；若这些背景与本房的年龄、时间、处境、身份或关系阶段冲突，只在本房以这段设定为准，并保持人物核心性格和未被改变的底稿。不要补入未开放的主线经历，也不要在没有写回授权时把本房设定说成主线事实。本轮回复前先按这段设定校准自己，不要复述这份指令。");
    return "\n\n" + lines.join("\n");
  }
  return { STORAGE_KEY, SUMMARY_KEY, MAIN_ID, GROUPS, PRESETS, mainRoom, normalize, list, get, save, create, remove, chatKey, isSideKey, personFromKey, hydrateChats, readSummaries, addSummary, listSummaries, studySessionsFor, canWrite, prompt };
});
