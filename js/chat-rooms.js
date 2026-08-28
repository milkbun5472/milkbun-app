(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ChatRooms = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const STORAGE_KEY = "x_chatRooms_v1";
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
      ["study", "一起学", "可发起或继续学习 Session"],
      ["games", "小游戏", "可邀请、入局或执行游戏动作"]
    ],
    writeback: [
      ["roomHistory", "保留本房聊天", "始终保留这间房自己的完整时间线"],
      ["memoryCandidate", "进入记忆候选", "重要内容可进入候选箱，仍需现有记忆闸判断"],
      ["sharedState", "影响共同状态", "允许这间房更新关系、情绪、动作等共享状态"],
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
  const mainRoom = personId => ({ id: MAIN_ID, personId: String(personId), createdAt: 0, updatedAt: Date.now(), ...clone(PRESETS.everyday), name: "主聊天", main: true, preset: "everyday" });
  function normalize(room, personId) {
    const base = room && room.id === MAIN_ID ? mainRoom(personId) : { id: room && room.id || id(), personId: String(personId), name: "新房间", main: false, createdAt: Date.now(), updatedAt: Date.now(), preset: "everyday", ...clone(PRESETS.everyday) };
    const src = room || {};
    return {
      ...base, ...src, personId: String(personId), name: String(src.name || base.name).trim().slice(0, 24) || base.name,
      cognition: { ...base.cognition, ...(src.cognition || {}) },
      actions: { ...base.actions, ...(src.actions || {}) },
      writeback: { ...base.writeback, ...(src.writeback || {}) },
      syncMode: ["follow", "ask", "frozen"].includes(src.syncMode) ? src.syncMode : base.syncMode,
      mainCursorTs: Number(src.mainCursorTs || 0), updatedAt: Number(src.updatedAt || Date.now())
    };
  }
  function read() {
    try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (_) { return {}; }
  }
  function write(all) { localStorage.setItem(STORAGE_KEY, JSON.stringify(all || {})); return all; }
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
    write(all); return next;
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
    const all = read(); all[personId] = (all[personId] || []).filter(r => r.id !== roomId); write(all); return true;
  }
  function chatKey(personId, roomId) { return !roomId || roomId === MAIN_ID ? String(personId) : String(personId) + "::room::" + roomId; }
  function isSideKey(key) { return String(key || "").includes("::room::"); }
  function personFromKey(key) { return String(key || "").split("::room::")[0]; }
  function prompt(room, mainMessages) {
    if (!room) return "";
    const c = room.cognition || {}, a = room.actions || {}, w = room.writeback || {};
    const allowedActions = GROUPS.actions.filter(([k]) => a[k]).map(([, label]) => label);
    const lines = room.id === MAIN_ID ? ["【主聊天行动权限】这是你们的主聊天。"] : ["【当前房间】你和对方正在「" + room.name + "」里交谈。这是一条独立时间线，不要假装侧房里没发生过的对话已经发生。"];
    if (room.id === MAIN_ID) {
      lines.push("【额外行动权限】当前可主动发起：" + (allowedActions.length ? allowedActions.join("、") : "无") + "。论坛和朋友圈仍按主聊天原有触发规则工作；照片、地图是聊天原生能力；钱包只属于主聊天；不要代替本人写日记。");
      return "\n\n" + lines.join("\n");
    }
    lines.push("【认知边界】" + GROUPS.cognition.map(([k, label]) => label + (c[k] ? "可用" : "不可用")).join("；") + "。");
    lines.push("【额外行动权限】本房" + (allowedActions.length ? "可主动发起：" + allowedActions.join("、") : "不额外开放一起学或小游戏") + "。照片、地图仍是聊天原生能力；侧房不触发朋友圈、论坛、钱包或日记。");
    lines.push("【写回边界】" + (w.sharedState ? "本房可影响共同状态" : "本房不改变主房关系、情绪、动作等共同状态") + "；" + (w.memoryCandidate ? "重要内容可经过既有闸进入记忆候选" : "本房内容不进入正式记忆或候选") + "；" + (w.mainSummary ? "离房时可以形成一份可追溯交接" : "不向主房生成交接") + "。");
    if (c.mainDelta && room.syncMode !== "frozen" && Array.isArray(mainMessages)) {
      const since = Number(room.mainCursorTs || room.createdAt || 0);
      const delta = mainMessages.filter(m => Number(m.ts || 0) > since && (m.role === "user" || m.role === "assistant") && m.content).slice(-16);
      if (delta.length) lines.push("【主房后来发生的事｜只作参考，不是本房新消息】\n" + delta.map(m => (m.role === "user" ? "对方" : "你") + "：" + String(m.content).slice(0, 300)).join("\n"));
    }
    return "\n\n" + lines.join("\n");
  }
  return { STORAGE_KEY, MAIN_ID, GROUPS, PRESETS, mainRoom, normalize, list, get, save, create, remove, chatKey, isSideKey, personFromKey, prompt };
});
