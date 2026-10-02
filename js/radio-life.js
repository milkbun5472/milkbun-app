// 电台主线：日程现场和共同节目共用这一份事实仓。收藏不改变角色知情范围。
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.RadioLife = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";
  const KEY = "x_radioLife", flights = new Map();
  const uid = () => "rl_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
  const text = v => typeof v === "string" ? v.trim() : "";
  const read = () => {
    const d = typeof loadJSON === "function" ? loadJSON(KEY, {}) : {};
    return { events: Array.isArray(d.events) ? d.events : [], shows: Array.isArray(d.shows) ? d.shows : [] };
  };
  const write = d => { if (saveJSON(KEY, d) === false) throw new Error("这次录音没有保存成功，请检查存储状态再重试。"); return d; };
  const updateEvent = (id, fn) => {
    const d = read(), i = d.events.findIndex(e => e.id === id);
    if (i < 0) throw new Error("这段录音已经不在了。");
    d.events[i] = fn(d.events[i]); write(d); return d.events[i];
  };
  // 钟点选择和自动补结束时间沿用现有日程的公共算法；日期属于角色当地。
  function slot(char, plans, now, deviceOffset) {
    if (!char || !root.ScheduleClock) return null;
    const clock = root.ScheduleClock, at = now || Date.now();
    const off = deviceOffset == null ? -new Date().getTimezoneOffset() : deviceOffset;
    const day = clock.dayKey(char, at, off), plan = (plans || {})[day];
    if (!plan || !Array.isArray(plan.seqs)) return null;
    const seqs = typeof schedFillEnds === "function" ? schedFillEnds(plan.seqs) : plan.seqs;
    const minute = clock.localMinute(char, at, off), index = clock.currentSeqIdx(seqs, minute);
    const cur = seqs[index];
    if (!cur || !text(cur.title) || cur.type === "sleep") return null;
    const toMin = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); return m ? +m[1] * 60 + +m[2] : NaN; };
    const startMin = toMin(cur.time), endMin = toMin(cur.end);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) return null;
    const date = day.split("-").map(Number);
    const midnight = Date.UTC(date[0], date[1] - 1, date[2]) - clock.offsetMinutes(char, off) * 60000;
    let wraps = 0, prev = -1;
    for (let i = 0; i <= index; i++) { const m = toMin(seqs[i].time); if (prev >= 0 && prev - m > 720) wraps++; prev = m; }
    let startAt = midnight + (startMin + wraps * 1440) * 60000;
    // 凌晨属于昨天跨午夜的尾段时，公共索引给出的 wrap 要回到真实日期。
    if (startAt > at && wraps && minute < 720) startAt -= 86400000;
    const duration = ((endMin <= startMin ? endMin + 1440 : endMin) - startMin) * 60000;
    const endAt = startAt + duration;
    if (at < startAt || at >= endAt) return null;
    const scene = { charId: String(char.id), name: char.name, day, time: cur.time, end: cur.end,
      title: cur.title, location: cur.location || "", type: cur.type || "other", deviation: cur.deviation || null, startAt, endAt };
    scene.key = JSON.stringify([scene.charId, day, startAt, endAt, scene.title, scene.location, scene.deviation]);
    return scene;
  }
  function accept(raw, scene, actors, ordinal) {
    const allowed = new Map((actors || []).map(c => [String(c.id), c]));
    const owner = allowed.get(scene.charId) || { id: scene.charId, name: scene.name };
    allowed.set(scene.charId, owner);
    if (!raw || !Array.isArray(raw.lines) || !raw.lines.length) throw new Error("没有收到现场对话。返回内容：" + JSON.stringify(raw).slice(0, 320));
    const lines = raw.lines.map(l => {
      if (!l || !text(l.text)) throw new Error("现场里有一条空台词，请重新接收。");
      const id = text(l.speakerId), known = allowed.get(id);
      if (id && !known) throw new Error("现场说话人不在这次可接入的角色名单里。");
      const speaker = known ? known.name : text(l.speaker);
      if (!speaker) throw new Error("这句台词没有说话人。");
      // 一句不超过公共 TTS 的 800 字窗口，避免真实音频被静默裁断。
      if (l.text.length > 800) throw new Error("这句现场台词太长，请重新接收。");
      return { speakerId: known ? String(known.id) : "", speaker, text: l.text.trim() };
    });
    if (!lines.some(l => l.speakerId === scene.charId)) throw new Error("这段现场没有选中角色的声音，请重新接收。");
    return { id: uid(), kind: "life", ownerId: scene.charId, scene: { ...scene }, ordinal,
      title: text(raw.title) || scene.title, participantIds: [...new Set(lines.map(l => l.speakerId).filter(Boolean))], lines, heard: 0, createdAt: Date.now(), savedAt: 0 };
  }
  const heardLines = e => (e.lines || []).slice(0, Math.max(0, Number(e.heard) || 0));
  const transcript = (lines) => lines.map(l => l.speaker + "：" + l.text).join("\n");
  const eventsAt = scene => read().events.filter(e => e.kind === "life" && e.scene.key === scene.key).sort((a, b) => a.ordinal - b.ordinal);
  // 只有显式接入/接着听会调用模型。并发接入同一日程共用一枪，重进复用已收到的现场。
  function connect(scene, actors, generate, continuing) {
    if (!scene || Date.now() >= scene.endAt) return Promise.reject(new Error("这段日程已经结束，请调回现在的频率。"));
    const old = eventsAt(scene), last = old[old.length - 1];
    if (last && (!continuing || last.heard < last.lines.length)) return Promise.resolve(last);
    if (flights.has(scene.key)) return flights.get(scene.key);
    const task = (async () => {
      const raw = await generate(scene, old);
      if (Date.now() >= scene.endAt) throw new Error("接收时这段日程已经结束，这次没有写入现场；请调回现在的频率。");
      const e = accept(raw, scene, actors, old.length);
      const d = read(); d.events.push(e); write(d); return e;
    })();
    flights.set(scene.key, task);
    const drop = () => { if (flights.get(scene.key) === task) flights.delete(scene.key); };
    task.then(drop, drop); return task;
  }
  function reveal(id, index) {
    return updateEvent(id, e => {
      if (!Number.isInteger(index) || index < 0 || index >= e.lines.length || index > e.heard) throw new Error("请按现场顺序收听。");
      return { ...e, heard: Math.max(e.heard, index + 1) };
    });
  }
  function keep(id, value) {
    return updateEvent(id, e => { if (!e.heard) throw new Error("先听到一句，再保存这段录音。"); return { ...e, savedAt: value ? Date.now() : 0 }; });
  }
  function lifePrompt(scene, previous) {
    return "接入角色此刻的生活现场。用户在远端静默收听，现场的人没有收到连接通知，也不知道有人正在收听。\n"
      + "【当前日程·事实锚】\n" + JSON.stringify(scene) + "\n"
      + "写一小段正在发生的事情：按这段日程的活动、地点、临时变更和角色自己的处境展开。可以是角色独处时自然的自言自语，也可以是在场的人彼此说话；是否有人同行取决于此刻日程，无需安排别人出场。用户没有在场，也没有向现场发问。说话对象、话题与语言由实际情境和人设决定。\n"
      + "输出连续的口语台词（约8至16条，疏密随现场），能让人从内容听懂正在做什么。动作与环境放在可选的 sceneNote 里，播放器只念台词 text。speakerId 填下方名单里实际说话人的 id；人设中已有但不在名单里的生活人物可以用 speaker 写称呼、speakerId 留空。名单只是可用角色，不代表都在场；谁在场由日程与既有关系决定。\n"
      + (previous.length ? "【这一段日程已发生的现场·接着往后走】\n" + previous.map(e => transcript(heardLines(e))).join("\n\n") : "");
  }
  const schema = '{"title":"这段现场的短标题","lines":[{"speakerId":"实际说话角色的id，无id的生活人物留空","speaker":"说话人的名字或称呼","text":"现场实际说出口的台词"}]}';
  // 此刻现场仅在原日程有效；收藏是长期事实。按实际说话人隔离，用户听见本身不进模型。
  function contextFor(charId, opts) {
    const o = opts || {}, now = o.now || Date.now(), d = read(), id = String(charId);
    const q = String(o.query || "");
    const relevant = e => !q || q.includes(e.title) || heardLines(e).some(l => q.includes(l.speaker) || (l.text.length > 5 && q.includes(l.text.slice(0, 8))));
    const own = e => e.ownerId === id || (e.participantIds || heardLines(e).map(l => l.speakerId)).includes(id);
    const active = d.events.filter(e => e.kind === "life" && own(e) && e.heard && e.scene.startAt <= now && now < e.scene.endAt);
    const kept = d.events.filter(e => e.kind === "life" && e.savedAt && e.heard && own(e) && !active.includes(e));
    const sorted = kept.sort((a, b) => Number(relevant(b)) - Number(relevant(a)) || b.createdAt - a.createdAt);
    const life = active.concat(sorted).map(e => "〔" + e.scene.day + " " + e.scene.time + " · " + e.scene.location + " · " + e.title + "〕\n" + transcript(heardLines(e)));
    const shows = d.shows.filter(s => s.charId === id).flatMap(s => (s.episodes || []).filter(e => e.lines.length).map(e => ({ s, e })))
      .sort((a, b) => b.e.updatedAt - a.e.updatedAt).slice()
      .map(({s,e}) => "〔你和用户一起录制的「" + s.name + "」· " + e.title + "〕\n" + transcript(e.lines));
    if (!life.length && !shows.length) return "";
    return "【你实际经历过的生活片段与共同录音】\n现场原话属于你自己的生活经历；你记得当时发生过什么。用户是否通过电台听到、是否收藏，你没有收到任何通知；只有对话中用户实际告诉你的内容才使你知道对方听过。提起相关事实时按实际发生的事情接续，反应由你自己的性格和当前话题决定。\n"
      + life.concat(shows).join("\n\n");
  }
  function createShow(char, name) {
    if (!char || !text(name)) throw new Error("先选搭档，给你们的电台起个名字。");
    const s = { id: uid(), charId: String(char.id), name: name.trim(), createdAt: Date.now(), episodes: [] };
    const d = read(); d.shows.push(s); write(d); return s;
  }
  const getShow = id => read().shows.find(s => s.id === id);
  function updateShow(id, fn) {
    const d = read(), at = d.shows.findIndex(s => s.id === id);
    if (at < 0) throw new Error("找不到这座电台。");
    d.shows[at] = fn(d.shows[at]); write(d); return d.shows[at];
  }
  function startEpisode(showId, topic, speaker) {
    if (!text(topic)) throw new Error("写下今天想聊的事。");
    const e = { id: uid(), title: topic.trim(), topic: topic.trim(), lines: [], status: "recording", createdAt: Date.now(), updatedAt: Date.now(), userName: speaker || "我" };
    updateShow(showId, s => {
      if (s.episodes.some(e => e.status === "recording")) throw new Error("先录完或继续已有的这一期。");
      return { ...s, episodes: s.episodes.concat(e) };
    }); return e;
  }
  function appendShow(showId, episodeId, userText, raw, char) {
    const current = getShow(showId);
    if (!current || !char || current.charId !== String(char.id) || !current.episodes.some(e => e.id === episodeId)) throw new Error("这位搭档或这一期录音已经改变，请重新打开录音间。");
    if (String(userText || "").length > 800) throw new Error("这一轮先递一段不超过800字的话给搭档。");
    if (!raw || !Array.isArray(raw.lines) || !raw.lines.length || raw.lines.some(l => !l || !text(l.text) || l.text.length > 800)) throw new Error("没收到搭档的节目台词。返回内容：" + JSON.stringify(raw).slice(0, 320));
    return updateShow(showId, s => ({ ...s, episodes: s.episodes.map(e => {
      if (e.id !== episodeId) return e;
      if (e.status !== "recording") throw new Error("这一期已经录完了。");
      const rows = raw.lines.map(l => ({ speakerId: String(char.id), speaker: char.name, text: l.text.trim() }));
      return { ...e, lines: e.lines.concat(userText ? [{ speakerId: "me", speaker: e.userName, text: userText.trim() }] : [], rows), updatedAt: Date.now() };
    }) }));
  }
  function finishEpisode(showId, episodeId, title) {
    const current = getShow(showId);
    if (!current || !current.episodes.some(e => e.id === episodeId)) throw new Error("找不到这一期录音。");
    return updateShow(showId, s => ({ ...s, episodes: s.episodes.map(e => {
      if (e.id !== episodeId) return e;
      if (!e.lines.length) throw new Error("先录一点内容再收麦。");
      return { ...e, title: text(title) || e.title, status: "finished", updatedAt: Date.now() };
    }) }));
  }
  function studioPrompt(show, episode, input) {
    return "你正在和用户共同录制你们的电台「" + show.name + "」。用户也是主持人，台词由用户自己说；你只写你本人此刻说出口的几段话，让用户随时接得上。你可以带自己的想法、追问、跑题或提出栏目，节目由你们的性格和实际合作长出来。\n"
      + "【本期主题】" + episode.topic + "\n【本期已录内容】\n" + transcript(episode.lines)
      + "\n【用户此刻递来的话】" + (input || "开始这一期，给搭档留接话的地方。")
      + "\n【往期节目】\n" + (show.episodes || []).filter(e => e.status === "finished").slice(-4).map(e => e.title + "\n" + transcript(e.lines)).join("\n\n")
      + "\n输出2至5段口语台词，text 是真实说出口的话，动作不混入台词。";
  }
  return { KEY, read, slot, accept, connect, reveal, keep, heardLines, transcript, eventsAt, lifePrompt, schema, contextFor,
    createShow, getShow, startEpisode, appendShow, finishEpisode, studioPrompt };
});
