// ============================================================
// 一起学 · 开机就要的那一小份（从 js/study.js 搬出来，她 2026-10-18 瘦身）
// ============================================================
// study.js 一整份改成点进一起学才加载；可这几样开机、后台、聊天页就要用：
//   · 「到点让 TA 催我复习」的提醒（app.js 那条后台：dueReviewItems）
//   · 小房间里那门课的横幅、挪课进房（studyCoursesOf、setCourseRoom；chat-rooms.js 数房里的课要 loadSessions）
//   · 老存档的格式迁移（开机等文字库灌完就跑一次，不能等她点进一起学）
// 这些只住这一份；study.js 从这儿取，不另写。window.Study 开机先挂这几支，study.js 加载完换成完整那份。
(function (g) {
  // ---- 存储 ----------------------------------------------------------
  const K_SESS = "x_study_sessions";
  const K_CUR = "x_curricula";
  function loadSessions() { return loadJSON(K_SESS, []); }
  function saveSessions(list) { saveJSON(K_SESS, list); }
  function loadCurricula() { return loadJSON(K_CUR, []); }
  function saveCurricula(list) { saveJSON(K_CUR, list); }
  function findCurriculum(id) { return loadCurricula().find(function (c) { return c.id === id; }) || null; }
  function findCurriculumBySubject(subject) {
    const s = String(subject || "").trim().toLowerCase();
    return loadCurricula().find(function (c) { return String(c.subject || "").trim().toLowerCase() === s; }) || null;
  }
  // 课程 upsert（课程 = 大目标容器：goal + 跨 session 记忆；不再挂 units/progress）
  function saveCurriculum(cur) {
    const all = loadCurricula();
    const i = all.findIndex(function (c) { return c.id === cur.id; });
    if (i >= 0) all[i] = cur; else all.push(cur);
    saveCurricula(all);
  }
  // 把一条 session 摘要并进课程记忆（同 sessionId 覆盖旧摘要）——curriculum 内互通，不碰全局记忆库
  function pushCurriculumSummary(curId, sessionId, text) {
    const all = loadCurricula().map(function (c) {
      if (c.id !== curId) return c;
      const mem = c.memory || { summaries: [] };
      const summaries = (mem.summaries || []).filter(function (s) { return s.sessionId !== sessionId; })
        .concat([{ sessionId: sessionId, text: text, ts: Date.now() }]);
      // 保留 memory 上除 summaries 外的一切（review_items 等）——曾整体重建导致间隔复习题库被清零
      return Object.assign({}, c, { memory: Object.assign({}, mem, { summaries: summaries }), updated_at: Date.now() });
    });
    saveCurricula(all);
  }

  function newProgress(mode) {
    if (mode === "costudy") return { running_summary: "", summary_buffer: [], loose_vocab: [] };
    return { current_unit: null, completed: [], mastery: {}, review_queue: [], notes: "", evidence: [], mistakes: [], exit_ticket: null,
      warmup_queue: [], warmup_started: false };
  }
  // 从本节 outline 起一份 session 进度（第一小节起步）
  function initSessionProgress(outline) {
    const p = newProgress("teach");
    const units = outline && outline.units;
    if (Array.isArray(units) && units.length) p.current_unit = units[0].id;
    return p;
  }

  // ---- 迁移：v28「课程挂 units+progress」→ v29「课程=目标容器 + session 自带 outline」----
  // 老 session 从其课程下放 units/progress，令 session 自足；课程补 memory/mode/cast。幂等。
  function migrate() {
    const curs = loadCurricula();
    if (!curs.length) return;
    const sess = loadSessions();
    const curById = {};
    curs.forEach(function (c) { curById[c.id] = c; });
    let cChanged = false, sChanged = false;
    sess.forEach(function (s) {
      if (!s.curriculum_id || s.outline || s.mode === "costudy") return;
      const c = curById[s.curriculum_id];
      if (c && Array.isArray(c.units) && c.units.length) {
        s.outline = { units: c.units, level: c.level || "", language: c.language || "中文" };
        s.progress = s.progress || (c.progress ? c.progress : initSessionProgress(s.outline));
        sChanged = true;
      }
    });
    curs.forEach(function (c) {
      if (!c.memory) { c.memory = { summaries: [], review_items: [] }; cChanged = true; }
      else if (!Array.isArray(c.memory.review_items)) { c.memory.review_items = []; cChanged = true; }
      if (!c.mode || !c.character_ids) {
        const refs = sess.filter(function (s) { return s.curriculum_id === c.id; });
        const recent = refs.slice().sort(function (a, b) { return (b.updated_at || 0) - (a.updated_at || 0); })[0];
        if (!c.mode) c.mode = recent && recent.mode === "nv1" ? "nv1" : "teach";
        if (!c.character_ids) { c.character_ids = recent ? (recent.character_ids || []).slice() : []; c.teacher_id = recent ? (recent.teacher_id || null) : null; }
        cChanged = true;
      }
      if (!c.updated_at) { c.updated_at = c.created_at || Date.now(); cChanged = true; }
    });
    if (sChanged) saveSessions(sess);
    if (cChanged) saveCurricula(curs);
  }
  // 课程住在 IDB（x_curricula）：等文字库灌完再迁，否则开机这一刻读到的是空的
  if (typeof window !== "undefined") (typeof txtVaultReady === "function" ? txtVaultReady(20000) : Promise.resolve({ done: true })).then(function (st) { if (st && st.done) migrate(); });

  function dueReviewItems(cur, now) {
    const items = cur && cur.memory && cur.memory.review_items;
    const t = now || Date.now();
    return (Array.isArray(items) ? items : []).filter(function (x) { return x && Number(x.nextReviewAt) <= t; })
      .sort(function (a, b) { return Number(a.nextReviewAt) - Number(b.nextReviewAt); });
  }

  function studyCoursesOf(personId) {
    const pid = String(personId);
    const hasMe = function (x) { return String(x.teacher_id || "") === pid || (x.character_ids || []).map(String).indexOf(pid) > -1; };
    const room = function (x) { return String(x.roomId || "main"); };
    const curs = loadCurricula().filter(function (c) { return c && hasMe(c); }).map(function (c) {
      return { kind: "cur", id: c.id, title: c.subject || "未命名", mode: c.mode, roomId: room(c), updated: Number(c.updated_at || 0) };
    });
    const papers = loadSessions().filter(function (x) { return x && !x.curriculum_id && x.mode === "costudy" && hasMe(x); }).map(function (x) {
      return { kind: "paper", id: x.id, title: x.subject || x.title || "研究纸", mode: "costudy", roomId: room(x), updated: Number(x.updated_at || 0) };
    });
    return curs.concat(papers).sort(function (a, b) { return b.updated - a.updated; });
  }
  // 把一门课收进某间房／拿回主聊天。⚠️只挪【以后】：已经上过的课页留在当时那间房里——
  //   那几节是在那扇门里发生的，事后改戳，等于把「不带出门」那间房里的课翻出来给主线看。
  //   一起研究的一张纸本身就是一节，没有「以后」可分，整张挪。
  function setCourseRoom(kind, id, roomId) {
    const rid = roomId && roomId !== "main" ? String(roomId) : null;
    if (kind === "cur") {
      const cur = findCurriculum(id);
      if (!cur) return false;
      saveCurriculum(Object.assign({}, cur, { roomId: rid, updated_at: Date.now() }));
      return true;
    }
    const all = loadSessions(), i = all.findIndex(function (x) { return x && x.id === id; });
    if (i < 0) return false;
    all[i] = Object.assign({}, all[i], { roomId: rid });
    saveSessions(all);
    return true;
  }


  const API = { K_SESS: K_SESS, K_CUR: K_CUR, loadSessions: loadSessions, saveSessions: saveSessions, loadCurricula: loadCurricula, saveCurricula: saveCurricula,
    findCurriculum: findCurriculum, findCurriculumBySubject: findCurriculumBySubject, saveCurriculum: saveCurriculum, pushCurriculumSummary: pushCurriculumSummary,
    newProgress: newProgress, initSessionProgress: initSessionProgress, migrate: migrate, dueReviewItems: dueReviewItems, studyCoursesOf: studyCoursesOf, setCourseRoom: setCourseRoom };
  g.StudyCore = API;
  if (typeof window !== "undefined" && !window.Study) window.Study = Object.assign({}, API);
  if (typeof module === "object" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
