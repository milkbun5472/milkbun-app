// ============================================================
// 自动存一份到手机里（File System Access API）
// ============================================================
// 立因（群友 2026-11-09）：安卓把这个站点的 IndexedDB 整个回收了，localStorage 一个字没动——
//   角色名单和美化还在（小，仓库外头有副本），每个人的聊天和整座图库一条不剩（大，只住 IndexedDB）。
//   她没开云同步，于是手上一件工具都没有。**大多数人都不开云同步**（她 2026-11-09），
//   所以真正要补的不是云那一头，是「什么都没配的人，手里得有一份谁也动不了的文件」。
//
// ⚠️这个文件的红线（她 2026-11-09：「这种碰数据的做不好万一下次其他人打开数据没了」）：
//   **只读存档、只写她自己挑的那个文件夹。**
//   全文件不许出现任何一次对 localStorage 的 x_ 键、文字金库、图库的写入。
//   它做不好，最坏的结果是这一次没备份上，下次再来；绝不可能反过来弄坏谁的数据。
//   唯一写进本机的是【那个文件夹的把手】和一行时间戳，住在自己那个小库里（x_autobackup），
//   跟存档那几个库不沾边，清掉它也只是忘了备份在哪。
//
// ⚠️为什么只写文字那一份（显式差异，不是忘了）：
//   图是 base64 塞进 JSON 的，一份几百 MB 很常见，手机浏览器拼到一半就撑不住
//   （群里 2026-10-16「备份不下来了」就是这么来的）。自动那一路没人看着，
//   撑崩了没人知道，所以它只写几乎一定会成的那一份：角色、聊天、记忆、手机、情侣空间。
//   图片仍然走设置里手动的「图片第 N 包」。界面上要当面说清楚它不含图，不许让人以为全带走了。
(function () {
  "use strict";
  const DB = "x_autobackup", STORE = "h", KEY = "dir", MARK = "meta";
  const EVERY_MS = 6 * 3600 * 1000;      // 两次之间至少隔这么久
  const KEEP = 7;                         // 文件夹里留最近几份
  const PREFIX = "qiuqiu-auto-";

  const g = (typeof window !== "undefined") ? window : globalThis;
  const has = () => typeof g.showDirectoryPicker === "function";

  function open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  function put(k, v) { return open().then(db => new Promise((res, rej) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); })); }
  function get(k) { return open().then(db => new Promise((res, rej) => { const tx = db.transaction(STORE, "readonly"); const q = tx.objectStore(STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); })); }
  function del(k) { return open().then(db => new Promise((res) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); })); }

  let meta = null;
  const loadMeta = async () => { if (!meta) { try { meta = (await get(MARK)) || {}; } catch (e) { meta = {}; } } return meta; };
  const saveMeta = async m => { meta = m; try { await put(MARK, m); } catch (e) {} };

  // 这一份里有几个「有话的对话」。判法跟 cloud.js 那道整类归零闸同一个口径：
  //   键名照【写存档那一段】来（app.js 的 "x_chat:" + id），内容是一串带 "role": 的消息。
  function chatCount(text) {
    let n = 0;
    try {
      const data = JSON.parse(text || "{}").data || {};
      Object.keys(data).forEach(k => {
        if (k.indexOf("x_chat:") !== 0 && k.indexOf("x_gchat:") !== 0) return;
        if (String(data[k] || "").indexOf('"role":') >= 0) n++;
      });
    } catch (e) {}
    return n;
  }

  async function dirHandle() { try { return (await get(KEY)) || null; } catch (e) { return null; } }
  async function permission(dir, ask) {
    if (!dir || !dir.queryPermission) return "granted";
    try {
      let p = await dir.queryPermission({ mode: "readwrite" });
      if (p === "prompt" && ask && dir.requestPermission) p = await dir.requestPermission({ mode: "readwrite" });
      return p;
    } catch (e) { return "denied"; }
  }

  // 她点「选个地方」时才走这儿（要手势）。挑完当场写一份，让她立刻看得到文件。
  async function pick() {
    if (!has()) throw new Error("这个浏览器没有这个功能");
    const dir = await g.showDirectoryPicker({ mode: "readwrite", id: "qiuqiu-backup" });
    if ((await permission(dir, true)) !== "granted") throw new Error("没拿到写这个文件夹的许可");
    await put(KEY, dir);
    const r = await run(true);
    if (r && r.err) throw new Error(r.err);
    return r;
  }

  async function forget() { await del(KEY); await saveMeta(Object.assign(await loadMeta(), { lastAt: 0, lastName: "", lastErr: "" })); }

  // ⚠️这一支是自动跑的，没人看着：每一道闸都宁可【这一次不写】，不许将就着写。
  async function run(force) {
    const m = await loadMeta();
    if (!has()) return { skip: "unsupported" };
    const dir = await dirHandle();
    if (!dir) return { skip: "no_dir" };
    if (!force && m.lastAt && Date.now() - m.lastAt < EVERY_MS) return { skip: "too_soon" };
    // 闸一：文字库灌完了没有。没灌完＝界面上是一台空手机，这时候写出去的是一份残档。
    try {
      if (typeof g.txtVaultReady === "function") {
        const st = await g.txtVaultReady(20000);
        if (!st || !st.ok) return { skip: "txt_vault" };
      }
    } catch (e) { return { skip: "txt_vault" }; }
    // 闸二：没有许可就安静走开。requestPermission 需要手势，自动这一路不许弹。
    if ((await permission(dir, false)) !== "granted") { await saveMeta(Object.assign(m, { needGesture: true })); return { skip: "need_gesture" }; }
    if (!g.BackupPack || typeof g.BackupPack.build !== "function") return { skip: "no_pack" };
    const pack = await g.BackupPack.build({ noImages: true });
    if (!pack || pack.refused || !pack.text) return { skip: "refused" };
    // 闸三：整类归零。上一次写出去时明明有对话，这一次一个都不剩＝这台机器出了事，
    //   不是她删的。这种时候写进去只会把文件夹里那几份好的挤掉（KEEP 轮转）。
    const chats = chatCount(pack.text);
    if (!force && m.lastChats > 0 && chats === 0) { await saveMeta(Object.assign(m, { lastErr: "gutted", needGesture: false })); return { skip: "gutted" }; }
    const d = new Date(), pad = n => String(n).padStart(2, "0");
    const name = PREFIX + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes()) + ".json";
    try {
      const fh = await dir.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(pack.text);
      await w.close();
      await saveMeta(Object.assign(m, { lastAt: Date.now(), lastName: name, lastChats: chats, lastErr: "", needGesture: false }));
    } catch (e) {
      await saveMeta(Object.assign(m, { lastErr: String((e && e.message) || e) }));
      return { err: String((e && e.message) || e) };
    }
    // 写成了才轮转。⚠️顺序不许换：先有新的，再删旧的——反过来就是「正要换新的时候断电」。
    //   而且只删我们自己按这个前缀写出来的文件，她放在那个文件夹里的别的东西一个都不碰。
    try {
      const mine = [];
      for await (const [n, h] of dir.entries()) if (n.indexOf(PREFIX) === 0 && n.endsWith(".json") && h.kind === "file") mine.push(n);
      mine.sort();
      for (const n of mine.slice(0, Math.max(0, mine.length - KEEP))) { try { await dir.removeEntry(n); } catch (e) {} }
    } catch (e) {}
    return { ok: true, name: name, chats: chats };
  }

  async function state() {
    const m = await loadMeta();
    return { supported: has(), on: !!(await dirHandle()), lastAt: m.lastAt || 0, lastName: m.lastName || "", lastErr: m.lastErr || "", needGesture: !!m.needGesture, every: EVERY_MS, keep: KEEP };
  }

  let timer = 0;
  function start() {
    if (timer) return;
    const tick = () => { run(false).catch(() => {}); };
    setTimeout(tick, 20000);                 // 开机别跟灌库抢
    timer = setInterval(tick, 30 * 60 * 1000);
  }

  g.AutoBackup = { supported: has, pick: pick, forget: forget, run: run, state: state, start: start, PREFIX: PREFIX };
})();
