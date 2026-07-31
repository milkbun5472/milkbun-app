(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SomaticShadow = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";
  const DB_NAME = "lisa_somatic_shadow_v1", DB_VERSION = 1, DIAG_CAP = 800;
  let dbPromise = null, queues = new Map();
  const Core = () => root && root.SomaticCore;
  const request = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error || new Error("somatic shadow request failed")); });
  const done = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error || new Error("somatic shadow transaction failed")); tx.onabort = () => reject(tx.error || new Error("somatic shadow transaction aborted")); });
  function open(indexedDBImpl) {
    if (dbPromise) return dbPromise;
    const idb = indexedDBImpl || (typeof indexedDB !== "undefined" ? indexedDB : null);
    if (!idb) return Promise.reject(new Error("IndexedDB unavailable"));
    dbPromise = new Promise((resolve, reject) => {
      const req = idb.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("states")) db.createObjectStore("states", { keyPath: "key" });
        if (!db.objectStoreNames.contains("diagnostics")) {
          const store = db.createObjectStore("diagnostics", { keyPath: "id", autoIncrement: true });
          store.createIndex("charKey", "charKey", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("somatic shadow open failed"));
    });
    return dbPromise;
  }
  const keyOf = (ownerId, charId) => String(ownerId || "local-device") + ":" + String(charId || "");
  async function get(ownerId, charId) {
    const db = await open(), tx = db.transaction("states", "readonly");
    return (await request(tx.objectStore("states").get(keyOf(ownerId, charId)))) || null;
  }
  async function put(ownerId, charId, state) {
    const db = await open(), tx = db.transaction("states", "readwrite");
    tx.objectStore("states").put({ ...state, key: keyOf(ownerId, charId), ownerId: String(ownerId || "local-device"), charId: String(charId) });
    await done(tx); return state;
  }
  async function diagnostic(row) {
    const db = await open(), tx = db.transaction("diagnostics", "readwrite"), store = tx.objectStore("diagnostics");
    store.add(row);
    const count = await request(store.count());
    if (count > DIAG_CAP) {
      const cursor = store.openCursor(), trim = count - DIAG_CAP;
      await new Promise((resolve, reject) => {
        let removed = 0;
        cursor.onsuccess = e => { const c = e.target.result; if (!c || removed >= trim) return resolve(); c.delete(); removed++; c.continue(); };
        cursor.onerror = () => reject(cursor.error);
      });
    }
    await done(tx);
  }
  function observe(input) {
    const ownerId = input && input.ownerId || "local-device", charId = input && input.charId;
    if (!charId || !Core()) return Promise.resolve({ skipped: true });
    const queueKey = keyOf(ownerId, charId), prior = queues.get(queueKey) || Promise.resolve();
    const job = prior.then(async () => {
      const now = Number(input.now) || Date.now(), core = Core();
      const events = core.detect(input), previous = await get(ownerId, charId);
      let state = previous || core.createState(charId, now);
      events.forEach(event => { state = core.ignite(state, event, now); });
      state = core.decayState(state, now);
      await put(ownerId, charId, state);
      const snap = core.snapshot(state, now);
      await diagnostic({
        charKey: queueKey, at: now, surface: String(input.source || "unknown"),
        role: String(input.role || ""), mode: String(input.mode || "symbolic"),
        eventCodes: events.map(e => e.labelCode), activeChannels: Object.keys(snap.active),
        eventSignature: core.eventSignature(events),
        textHash: hash(String(input.text || "")), textLength: String(input.text || "").length,
        shadowOnly: true
      });
      return { state, events, snapshot: snap, shadowOnly: true };
    }).catch(error => ({ error: String(error && error.message || error), shadowOnly: true }));
    queues.set(queueKey, job);
    return job;
  }
  function observeMany(input) {
    const chars = Array.isArray(input && input.characters) ? input.characters.filter(Boolean) : [];
    const text = String(input && input.text || "");
    const mentioned = chars.filter(c => text.includes(String(c.name || "")) || (c.remark && text.includes(String(c.remark))));
    return Promise.all(chars.map(char => {
      const touchLike = /抱|摸|揉|捏|亲|吻|牵|握|拍|戳|蹭|靠/.test(text);
      if (touchLike && mentioned.length && !mentioned.some(c => String(c.id) === String(char.id))) return Promise.resolve({ skipped: true, reason: "other_target" });
      if (touchLike && !mentioned.length && chars.length > 1) return Promise.resolve({ skipped: true, reason: "ambiguous_target" });
      return observe({ ...input, charId: char.id });
    }));
  }
  async function status(ownerId, charId, now) {
    const state = await get(ownerId, charId);
    return state && Core() ? Core().snapshot(state, Number(now) || Date.now()) : { state: null, active: {}, count: 0 };
  }
  async function report(ownerId, charId, now) {
    const db = await open(), charKey = keyOf(ownerId, charId);
    const tx = db.transaction("diagnostics", "readonly");
    const rows = await request(tx.objectStore("diagnostics").index("charKey").getAll(charKey));
    const snap = await status(ownerId, charId, now);
    const channels = {}, surfaces = {};
    (rows || []).forEach(row => {
      (row.eventCodes || []).forEach(code => { const channel = String(code).split(":")[0]; channels[channel] = (channels[channel] || 0) + 1; });
      surfaces[row.surface || "unknown"] = (surfaces[row.surface || "unknown"] || 0) + 1;
    });
    return {
      phase: "shadow", sampleCount: rows.length, eventCounts: channels, surfaces,
      active: snap.active,
      firstObservedAt: rows.length ? rows[0].at : null,
      lastObservedAt: rows.length ? rows[rows.length - 1].at : null,
      containsText: false, injected: false
    };
  }
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ("00000000" + (h >>> 0).toString(16)).slice(-8);
  }
  function _resetForTest() { dbPromise = null; queues = new Map(); }
  return { DB_NAME, open, get, put, observe, observeMany, status, report, hash, _resetForTest };
});
