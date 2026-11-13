// CC 合格回流 -> App 自动记忆抽取的持久书签。
// 只管逐条 ledgerKey 是否已经成功审过；不保存正文、不自行决定什么值得记。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CcMemoryAuto = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const KEY = "cc_memory_auto_v1";
  const CAP = 2000;
  const text = v => String(v == null ? "" : v).trim();
  const eligible = m => !!(m && m.ledgerImported && m.ledgerKey && !m.recalled
    && ["user", "assistant"].includes(m.role) && text(m.content));

  function fresh(ownerId, charId) {
    return { owner_id: String(ownerId || ""), char_id: String(charId || ""), processed_keys: [], last_success_at: null, last_error: null };
  }

  function normalize(raw, ownerId, charId) {
    const owner = String(ownerId || ""), char = String(charId || "");
    if (!raw || String(raw.owner_id || "") !== owner || String(raw.char_id || "") !== char) return fresh(owner, char);
    return { ...fresh(owner, char), ...raw, owner_id: owner, char_id: char,
      processed_keys: [...new Set(Array.isArray(raw.processed_keys) ? raw.processed_keys.map(String) : [])].slice(-CAP) };
  }

  function load(storage, ownerId, charId) {
    let raw = null;
    try { raw = JSON.parse(storage.getItem(KEY) || "null"); } catch (_) {}
    return normalize(raw, ownerId, charId);
  }

  function plan(messages, state, options) {
    const all = Array.isArray(messages) ? messages : [], done = new Set((state && state.processed_keys) || []);
    const pending = all.filter(m => eligible(m) && !done.has(String(m.ledgerKey)));
    const minNew = Math.max(2, Number(options && options.minNew) || 2);
    if (pending.length < minNew) return null;
    const first = all.indexOf(pending[0]), start = Math.max(0, first - 4);
    // 从最早未审处向后分批，不能只截最新 120 条却把更老的 pending 一并盖章。
    const context = all.slice(start).filter(m => m && !m.recalled && ["user", "assistant"].includes(m.role) && text(m.content)).slice(0, 120);
    const keys = context.filter(m => eligible(m) && !done.has(String(m.ledgerKey))).map(m => String(m.ledgerKey));
    return { messages: context, keys, pending: pending.length };
  }

  function commit(storage, state, keys, nowValue) {
    const next = normalize(state, state && state.owner_id, state && state.char_id);
    next.processed_keys = [...new Set([...(next.processed_keys || []), ...(keys || []).map(String)])].slice(-CAP);
    next.last_success_at = new Date(Number(nowValue) || Date.now()).toISOString();
    next.last_error = null;
    next.fail_count = 0;
    storage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  function fail(storage, state, error, nowValue) {
    const next = normalize(state, state && state.owner_id, state && state.char_id);
    next.last_error = String(error && error.message || error || "unknown");
    next.last_attempt_at = new Date(Number(nowValue) || Date.now()).toISOString();
    next.fail_count = Math.max(0, Number(next.fail_count) || 0) + 1;
    storage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  // 失败后要歇一阵再试（她 2026-11-13：一夜每分钟扣一次钱）：账本每分钟同步一次，失败了不歇就每分钟再抽一遍，
  //   而后台被掐断的那一枪中转站照样计费。歇 10 分钟起、每失败一次翻倍，最多 6 小时；成功一次清零。
  function cooling(state, nowValue) {
    const n = Math.max(0, Number(state && state.fail_count) || 0);
    if (!n || !state.last_attempt_at) return false;
    const wait = Math.min(6 * 3600e3, 10 * 60e3 * Math.pow(2, n - 1));
    return (Number(nowValue) || Date.now()) - Date.parse(state.last_attempt_at) < wait;
  }

  return { KEY, eligible, normalize, load, plan, commit, fail, cooling };
});
