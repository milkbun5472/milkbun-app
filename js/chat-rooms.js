(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ChatRooms = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const STORAGE_KEY = "x_chatRooms_v1";
  const SUMMARY_KEY = "x_chatRoomSummaries_v1";
  const MAIN_ID = "main";
  // 这几栏的字是给她看的，不是给工程师看的：说的是「他进这扇门带着什么」，
  // 不是「cognition 权限位」。key 一个都没动。
  const GROUPS = {
    cognition: [
      ["formalMemory", "你们一起经历过的事", "他记得你们的正式记忆和共同经历"],
      ["innerLife", "你们处到哪一步了", "他带着现在的关系、心情和他这个人长出来的样子"],
      ["mainDelta", "主聊天后来发生的", "回到这间房时，先补看主聊天这段时间的事"],
      ["schedule", "今天几号、他此刻在干嘛", "他知道现实时间、他那边的时间和今天的行程"],
      ["otherScenes", "群里和见面时发生的", "他记得共同群聊和线下相处留下的事"]
    ],
    actions: [
      ["study", "他可以拉你一起学", "允许他在这间房自然提议一起学"],
      ["games", "他可以拉你玩点什么", "允许他在这间房自然提议玩小游戏"]
    ],
    writeback: [
      ["roomHistory", "这里说过的话留在这里", "这间房永远留着自己完整的聊天记录"],
      ["memoryCandidate", "这里的事可以进记忆", "重要的能进候选箱，仍要过现有那道记忆闸"],
      ["sharedState", "这里的事算数", "允许这间房改动你们共同的关系、情绪和状态"],
      ["stateMood", "其中·能改他的心情", "关掉后这间房不动主线的实时心情（需先开「这里的事算数」）"],
      ["stateGaze", "其中·能改「Ta 眼里」", "关掉后这间房不动那张印象卡（需先开「这里的事算数」）"],
      ["mainSummary", "出门时给主聊天捎一句", "离开这间房后，给主聊天留一份说得清的交接"]
    ]
  };
  // ── 这间房里，上下文的哪几栏成立（v65.04）─────────────────────────
  // 她 2026-09-06 报：一间「不带出门」的房里，他还知道「我们开了情侣空间 3 天」。
  //
  // ⚠️病根不是漏了 coupleStatus 这一条，是那道闸原来写成了**手抄的黑名单**：
  //   ctxFor 造 41 栏，闸只点名擦掉 18 栏，**剩下 23 栏默认放行**——
  //   好感度、生理期、情侣档案那七栏、纪念日、他送过什么、一起听过什么，全在里头。
  //   而且黑名单的错法是看不见的：以后 ctxFor 每加一栏，隔离房就自动多漏一条，
  //   不报错、不红任何测试（stub-from-the-writer.md 那条「过滤等于没有」）。
  //
  // 所以改成**白名单**：每一栏都得在下面登记归谁管，没登记的**默认挡住**。
  //   加错方向至少是「少给了」——她看得见；黑名单加错方向是「私事漏出去了」，看不见。
  // ⚠️test/room-ctx-gate 钉着「ctxFor 造的每一栏都必须在这张表里」，漏登记就红。
  const CTX_GATE = {
    // 永远给：这几栏说的是【他是谁】和【怎么说话】，不是你们之间发生过什么
    always: [
      "chars",        // 在场都有谁（指代解析要用）
      "notRoleplay",  // 是不是言秋那种不被扮演的
      "directives",   // 这一轮的提示词指令
      "homeCity",     // 他自己住哪儿——属于他这个人
      "worldbook",    // 世界书是【世界的设定】，不是你俩的过去
      "recentChat"    // 房间自己那份（调用点已经按房换过了）
    ],
    // 你们一起经历过的事
    formalMemory: [
      "memory", "memLib", "ccContinuity", "yanqiuWall",
      "coupleArchive",  // 情侣空间那七栏：称呼、梗、小仪式、安慰说明书、边界、喜欢清单、第一次们
      "giftLog", "usedLog", "carryLog", "listenLog",
      "dreamKeep",      // 从梦里带出来的东西——她和 Ta 两个人之间的
      "capsuleWait",    // 埋着的时光胶囊
      "financeNote", "ownWalletNote", "memoNote"   // 主线里攒出来的他的日常账目/备忘
    ],
    // 你们处到哪一步了
    innerLife: [
      "moodLabel", "moodNote", "aMood", "gazeText", "personaGrown", "personaEvolve",
      "affinity",       // 好感度
      "coupleStatus",   // 是不是恋人、在一起多少天 ← 她这次看见的就是它
      "dateNote",       // 生日与纪念日
      "periodNote",     // 生理期——这一栏尤其不该漏
      "onMe",           // 她今天带着谁的东西出门
      "wishLog"         // 她在购物里点了「想要」的那些
    ],
    // 今天几号、他此刻在干嘛
    schedule: ["schedNow", "geo", "timeAware", "sleepTone"],
    // 群里和见面时发生的
    otherScenes: ["offlineNow", "groupEcho", "groupOfflineEcho", "forumEcho", "forumPmLog", "momentLog", "dreamEcho"]
  };
  // 清空成什么，按这一栏原来是什么类型来：数组→[]、字符串→""、真假→false、其余→null。
  // 逐栏写一遍 empty 值就是又一张要同步的表（加一栏忘一栏），所以照类型来。
  const emptyLike = v => Array.isArray(v) ? [] : typeof v === "string" ? "" : typeof v === "boolean" ? false : null;
  // 按这间房的 cognition 把上下文过一遍。主房和没有 cognition 的原样放行。
  function gateCtx(ctx, room) {
    if (!ctx || !room || room.main || !room.cognition) return ctx;
    const rc = room.cognition, out = { ...ctx };
    // roomPrompt 是线下调用点在 ctxFor 之后追加的本房边界，不是主线背景。
    const allowed = new Set(CTX_GATE.always.concat(["roomPrompt"]));
    Object.keys(CTX_GATE).forEach(group => {
      if (rc[group]) CTX_GATE[group].forEach(k => allowed.add(k));
    });
    Object.keys(out).forEach(k => { if (!allowed.has(k)) out[k] = emptyLike(out[k]); });
    return out;
  }
  const bools = (entries, on) => Object.fromEntries(entries.map(([key]) => [key, !!on]));
  const PRESETS = {
    everyday: { label: "慢慢聊这件事", note: "另留一条长期话题，也跟得上你们的日常近况", cognition: { ...bools(GROUPS.cognition, true) }, actions: { ...bools(GROUPS.actions, true) }, writeback: { ...bools(GROUPS.writeback, true) }, syncMode: "follow" },
    focused: { label: "一起做件事", note: "把课程、计划或长期项目收在一条不跑题的分线里", cognition: { ...bools(GROUPS.cognition, true), otherScenes: false }, actions: { ...bools(GROUPS.actions, false), study: true }, writeback: { ...bools(GROUPS.writeback, false), roomHistory: true, memoryCandidate: true, mainSummary: true }, syncMode: "ask" },
    isolated: { label: "不带出门", note: "只在这里成立，不补主线、不改共同状态，也不进入记忆", cognition: { ...bools(GROUPS.cognition, false) }, actions: { ...bools(GROUPS.actions, false) }, writeback: { ...bools(GROUPS.writeback, false), roomHistory: true }, syncMode: "frozen" },
    alternate: { label: "长篇如果", note: "让同一个人带着另一段年龄、处境或关系与你长期对话", cognition: { ...bools(GROUPS.cognition, false) }, actions: { ...bools(GROUPS.actions, false) }, writeback: { ...bools(GROUPS.writeback, false), roomHistory: true }, syncMode: "frozen" }
  };

  // 进门先给一句话，别一上来就是十个开关。说的是这两件事：
  // 他在这儿记不记得你们，和这儿发生的事出不出得了这道门。
  function doorLine(room) {
    const r = room || {}, c = r.cognition || {}, w = r.writeback || {};
    if (r.main) return "他在这儿是完整的他，说过的都算数。";
    const brings = c.formalMemory && c.innerLife ? "他记得你们的全部"
      : c.formalMemory ? "他记得你们经历过的事，但没带着现在的心情"
      : c.innerLife ? "他带着现在的心情，但想不起具体经历过什么"
      : (r.startFrom || r.fork) ? "他接着进门时留下的聊天" : "他在这儿不记得你们的过去";
    const takes = w.sharedState && w.memoryCandidate ? "这儿说的话会跟着他走出门"
      : w.memoryCandidate ? "这儿的事能记进去，但不动你们现在的状态"
      : w.sharedState ? "这儿的事会改你们现在的状态，但不进记忆"
      : "这儿的事他也带不出去";
    return brings + "，" + takes + "。";
  }
  // 攒够这么多条就浓缩一次，末尾这些条留着不动（照线下那一版的数，不另拍一个）
  const ROOM_SUM_THRESH = 50, ROOM_SUM_BUFFER = 15, ROOM_DIGEST_CAP = 4000;
  // 这间房该浓缩了吗：返回要浓缩的那一段，不够就 null
  function digestDue(room, msgs) {
    if (!room || room.main) return null;
    const list = (msgs || []).filter(m => m && !m.recalled && m.content);
    const from = Math.max(0, Number(room.selfSummedCount || 0));
    if (list.length - from < ROOM_SUM_THRESH) return null;
    const slice = list.slice(from, list.length - ROOM_SUM_BUFFER);
    return slice.length ? { slice, upto: list.length - ROOM_SUM_BUFFER } : null;
  }
  // 把新浓缩的一段接到房里那一份后面。⚠️满仓时【整段整段地掉】，
  // 不许按字数拦腰砍——照 maybeSummarize 那一版（砍出来的开头是半句话，看着像坏了）。
  function digestMerge(prev, seg) {
    const merged = String(prev || "").trim() ? String(prev).trim() + "\n\n" + seg : seg;
    if (merged.length <= ROOM_DIGEST_CAP) return merged;
    const segs = merged.split("\n\n");
    while (segs.length > 1 && segs.join("\n\n").length > ROOM_DIGEST_CAP) segs.shift();
    const out = segs.join("\n\n");
    return out.length > ROOM_DIGEST_CAP ? out.slice(out.length - ROOM_DIGEST_CAP) : out;
  }
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
      // 房内自留的浓缩（v65.04）：她 2026-09-06 问「过了上限就只能丢了对吗，因为不能进记忆库」。
      // 是的——记忆那条路被 memoryCandidate 关着，掉出窗口的就再也回不来了。
      // 这一份【只存在这间房里、只喂这间房】：不进长期记忆、不进记忆库、不出门，
      // 所以「不带出门」一个字都没破——它从来就没打算出门。
      selfDigest: String(src.selfDigest || "").slice(0, ROOM_DIGEST_CAP),
      selfSummedCount: Math.max(0, Number(src.selfSummedCount || 0)),
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
  // 分支与房门预览共用可见原文规则；卡片只留下文字，不复制可执行的邀请/交易。
  function visibleText(m) {
    if (!m || m.recalled || m.pending || !["user", "assistant", "narration"].includes(m.role)) return "";
    if (["system", "silence"].includes(m.kind)) return "";
    if (typeof ChatContextFilter !== "undefined" && ChatContextFilter.isExcluded(m)) return "";
    return String(m.content || m.desc || m.keyword || m.place || "").trim();
  }
  function resumeLines(messages) {
    return (Array.isArray(messages) ? messages : []).filter(m => visibleText(m)).slice(-2).map(m => ({
      role: m.kind === "narration" ? "narration" : m.role, text: visibleText(m).replace(/\s+/g, " ").slice(0, 100)
    }));
  }
  // 新房只有一种；startMode 只决定进门时房里先放哪段已载入聊天。
  // recent＝最近二十条；until＝从当前已载入开头截至选中句；blank＝空房。
  function prepareStart(personId, room, sourceRoom, messages, startMode, index) {
    if (!room || String(room.personId) !== String(personId) || !sourceRoom ||
        String(sourceRoom.personId) !== String(personId) || !Array.isArray(messages)) return null;
    const mode = ["blank", "recent", "until"].includes(startMode) ? startMode : "blank";
    const roomId = room.id;
    let picked = [];
    if (mode === "recent") picked = messages.filter(m => visibleText(m)).slice(-20);
    if (mode === "until") {
      if (!Number.isInteger(index) || index < 0 || index >= messages.length || !visibleText(messages[index])) return null;
      picked = messages.slice(0, index + 1).filter(m => visibleText(m));
    }
    const rows = picked.map((m, i) => ({
      id: roomId + "_seed_" + i, role: m.role, content: visibleText(m), ts: Number(m.ts || 0),
      ...(m.kind === "narration" || m.kind === "ooc" ? { kind: m.kind } : {}),
      read: true, forkSeed: true
    }));
    const anchor = mode === "until" ? messages[index] : picked[picked.length - 1];
    const prepared = normalize({ ...room, startFrom: mode === "blank" ? null : {
      mode, sourceRoomId: sourceRoom.id, sourceRoomName: sourceRoom.name,
      messageId: anchor && anchor.id || null, anchorTs: Number(anchor && anchor.ts || 0),
      anchorText: anchor ? visibleText(anchor).slice(0, 300) : "", seedCount: rows.length
    } }, personId);
    return { room: prepared, messages: rows };
  }
  async function commitStart(draft, writeHistory) {
    if (!draft || !draft.room || typeof writeHistory !== "function") return null;
    const room = draft.room, key = chatKey(room.personId, room.id);
    // 不覆盖已经创建的房间；失败重试仍使用同一个草稿 id。
    if (list(room.personId).some(r => r.id === room.id)) return null;
    try {
      if (!await writeHistory("x_chat:" + key, draft.messages)) return null;
      const saved = save(room.personId, room);
      return saved ? { room: saved, key, messages: draft.messages } : null;
    } catch (_) { return null; }
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
  // 课也认房间：一起学的课节记着 roomId（study.js 建课/建节时戳的），没戳的算主线。
  // 不按房筛的话，「不带出门」那间房照样看得见你在主线上跟他上的课。
  function roomIdOf(session) { return String(session && session.roomId ? session.roomId : MAIN_ID); }
  function studySessionsFor(personId, roomId) {
    try {
      if (!window.Study || typeof window.Study.loadSessions !== "function") return [];
      const want = String(roomId || MAIN_ID);
      return window.Study.loadSessions()
        .filter(s => s && (String(s.teacher_id || "") === String(personId) || (s.character_ids || []).map(String).includes(String(personId))))
        .filter(s => roomIdOf(s) === want)
        .sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));
    } catch (_) { return []; }
  }
  // 这节课算不算数：主线的一律算；侧房的课要那间房自己开了写回口子才算。
  // 读的那头（发呆的「你俩一起做过的事」）拿这一句问，别自己再判一遍。
  function studyCounts(personId, session) {
    const rid = roomIdOf(session);
    if (rid === MAIN_ID) return true;
    const room = list(personId).find(r => r && r.id === rid);
    if (!room) return false;                        // 房间已经删了：按不算数处理，宁可少说
    const w = room.writeback || {};
    return !!(w.sharedState || w.memoryCandidate);   // 两个口子有一个开着，这节课才算数
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
    const startFrom = room.startFrom || room.fork;
    if (startFrom) lines.push("【进门时带来的聊天】本房从「" + startFrom.sourceRoomName + "」带来了 " + startFrom.seedCount + " 条聊天原文。它们是本房开场前已经发生的内容；原房在这之后的内容不属于本房经历。卡片只作为历史文字，不代表本房已执行活动或交易。");
    // 这间房自己前面发生过的（掉出上下文窗口那些）。只在这儿出现，不出门。
    if (room.selfDigest) lines.push("【这间房前面发生过的｜是这条线自己的往事，不是别处的记忆】\n" + room.selfDigest);
    lines.push(c.schedule
      ? "【时间边界】本房已开启现实时间与行程，可按角色当地时间、现实钟和当前行程自然回应；若它与本房限定设定冲突，以本房设定为准。"
      : "【时间边界】本房未开启现实时间与行程；不要拿主时间线此刻几点、人在何处、下一段行程来约束本房。只以本房设定与本房已经发生的内容判断时间。",
      "【心声边界】本房的未说出口心声只属于本房，单独保存；不得据此改写主房心声、关系成长或人格成长。");
    if (room.purpose) lines.push("【这间房想慢慢继续的事】" + room.purpose + "。它是这条分线的共同方向，不是每轮必须汇报的任务；相关时自然接着，不相关时正常聊天。");
    lines.push("【认知边界】" + GROUPS.cognition.map(([k, label]) => label + (c[k] ? "可用" : "不可用")).join("；") + "。");
    if (allowedActions.length) lines.push("【本房可提议的活动】" + allowedActions.join("、") + "。只需在真的想做时自然开口，不要把它当作每轮任务，也不要假装界面已经打开。");
    if (a.study) {
      const ss = studySessionsFor(room.personId, room.id).slice(0, 6);
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
  return { visibleText, resumeLines, prepareStart, commitStart, doorLine, STORAGE_KEY, SUMMARY_KEY, MAIN_ID, GROUPS, PRESETS, CTX_GATE, gateCtx, ROOM_SUM_THRESH, ROOM_SUM_BUFFER, ROOM_DIGEST_CAP, digestDue, digestMerge, mainRoom, normalize, list, get, save, create, remove, chatKey, isSideKey, personFromKey, hydrateChats, readSummaries, addSummary, listSummaries, studySessionsFor, studyCounts, canWrite, prompt };
});
