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
      ["schedule", "时间与日程", "可感知此刻时间、日程和所处生活阶段"],
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
    everyday: { label: "日常侧房", note: "跟得上主线，也能自然使用常用功能", cognition: { ...bools(GROUPS.cognition, true) }, actions: { ...bools(GROUPS.actions, true) }, writeback: { ...bools(GROUPS.writeback, true) }, syncMode: "follow" },
    focused: { label: "专注房", note: "保留共同背景，但行动和写回更克制", cognition: { ...bools(GROUPS.cognition, true), otherScenes: false }, actions: { ...bools(GROUPS.actions, false), study: true }, writeback: { ...bools(GROUPS.writeback, false), roomHistory: true, memoryCandidate: true, mainSummary: true }, syncMode: "ask" },
    isolated: { label: "隔离房", note: "不补主线、不影响共同状态，只留本房记录", cognition: { ...bools(GROUPS.cognition, false), schedule: true }, actions: { ...bools(GROUPS.actions, false) }, writeback: { ...bools(GROUPS.writeback, false), roomHistory: true }, syncMode: "frozen" }
  };

  const clone = obj => JSON.parse(JSON.stringify(obj));
  const id = () => "room_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  const mainRoom = personId => ({ id: MAIN_ID, personId: String(personId), createdAt: 0, updatedAt: Date.now(), ...clone(PRESETS.everyday), actions: bools(GROUPS.actions, false), name: "主聊天", main: true, preset: "everyday" });
  function normalize(room, personId) {
    const base = room && room.id === MAIN_ID ? mainRoom(personId) : { id: room && room.id || id(), personId: String(personId), name: "新房间", main: false, createdAt: Date.now(), updatedAt: Date.now(), preset: "everyday", ...clone(PRESETS.everyday) };
    const src = room || {};
    return {
      ...base, ...src, personId: String(personId), name: String(src.name || base.name).trim().slice(0, 24) || base.name,
      cognition: { ...base.cognition, ...(src.cognition || {}) },
      actions: base.main ? bools(GROUPS.actions, false) : { ...base.actions, ...(src.actions || {}) },
      writeback: { ...base.writeback, ...(src.writeback || {}) },
      syncMode: ["follow", "ask", "frozen"].includes(src.syncMode) ? src.syncMode : base.syncMode,
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
    lines.push("【认知边界】" + GROUPS.cognition.map(([k, label]) => label + (c[k] ? "可用" : "不可用")).join("；") + "。");
    if (allowedActions.length) lines.push("【本房可提议的活动】" + allowedActions.join("、") + "。只需在真的想做时自然开口，不要把它当作每轮任务，也不要假装界面已经打开。");
    if (a.study) {
      const ss = studySessionsFor(room.personId).slice(0, 6);
      lines.push("【一起学邀请规则】先看下面已有课程；主题相关时优先提议续上现有 session。没有合适旧课时，你可以先提出一个轻量课程想法（学什么、为什么此刻想一起学、建议从哪个小点开始），但不能声称已经建课或已经打开界面，必须等对方确认。\n" + (ss.length ? "已有课程：\n" + ss.map(s => "· sessionId=" + s.id + "｜" + (s.title || s.subject || "未命名") + "｜" + (s.subject || "")).join("\n") : "目前没有你参与的已有课程。"));
    }
    lines.push("【写回边界】" + (w.sharedState ? "本房可影响共同状态" : "本房不改变主房关系、情绪、动作等共同状态") + "；" + (w.memoryCandidate ? "重要内容可经过既有闸进入记忆候选" : "本房内容不进入正式记忆或候选") + "；" + (w.mainSummary ? "离房时可以形成一份可追溯交接" : "不向主房生成交接") + "。");
    if (c.mainDelta && room.syncMode !== "frozen" && Array.isArray(mainMessages)) {
      const since = Number(room.mainCursorTs || room.createdAt || 0);
      const delta = mainMessages.filter(m => Number(m.ts || 0) > since && (m.role === "user" || m.role === "assistant") && m.content).slice(-16);
      if (delta.length) lines.push("【主房后来发生的事｜只作参考，不是本房新消息】\n" + delta.map(m => (m.role === "user" ? "对方" : "你") + "：" + String(m.content).slice(0, 300)).join("\n"));
    }
    return "\n\n" + lines.join("\n");
  }
  return { STORAGE_KEY, SUMMARY_KEY, MAIN_ID, GROUPS, PRESETS, mainRoom, normalize, list, get, save, create, remove, chatKey, isSideKey, personFromKey, readSummaries, addSummary, listSummaries, studySessionsFor, canWrite, prompt };
});
