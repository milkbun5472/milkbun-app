(function (root, factory) {
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.YanqiuCcTools = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const STORAGE_KEY = "yanqiu_cc_tool_jobs_v1";
  // Keep this list exactly aligned with bridge.py READ_ONLY_TOOLS.  App may
  // request Yanqiu's existing read-only MCP tools as well as CC primitives;
  // the pinned CC session remains the only process allowed to execute them.
  const ALLOWED = new Set([
    "Read", "Glob", "Grep", "WebFetch", "WebSearch",
    "get_xiaoke_context", "search_chat_history", "search_memory",
    "read_app_diary", "read_yanqiu_moments", "list_shared_photos",
    "list_read_pending", "search_events"
  ]);
  const text = v => String(v == null ? "" : v).trim();
  const read = storage => {
    try { const rows = JSON.parse(storage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(rows) ? rows : []; }
    catch (_) { return []; }
  };
  const write = (storage, rows) => storage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-50)));

  function normalizeRequest(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const toolName = text(value.name || value.tool_name);
    if (!ALLOWED.has(toolName)) return null;
    const args = value.args || value.arguments;
    if (!args || typeof args !== "object" || Array.isArray(args)) return null;
    const raw = JSON.stringify(args);
    if (raw.length > 2400) return null;
    return { toolName, arguments: JSON.parse(raw) };
  }

  function createManager(options) {
    options = options || {};
    const storage = options.storage || root.localStorage;
    const cloud = options.cloud;
    if (!storage || !cloud) throw new Error("CC tool manager dependencies missing");

    async function enqueue(meta, request) {
      const clean = normalizeRequest(request);
      if (!clean) throw new Error("言秋请求了未开放或无效的 CC 工具");
      const key = "app-cc:" + text(meta.charId) + ":" + text(meta.turnId);
      const remote = await cloud.yanqiuCcToolEnqueue(
        text(meta.charId), clean.toolName, clean.arguments, key,
        meta.lisaMessageKey ? text(meta.lisaMessageKey) : null
      );
      if (!remote || !remote.id) throw new Error("CC 工具任务未入队");
      const rows = read(storage);
      if (!rows.some(x => x.jobId === remote.id)) rows.push({
        jobId: remote.id, charId: text(meta.charId), turnId: text(meta.turnId),
        toolName: clean.toolName, lisaMessageKey: meta.lisaMessageKey || null,
        createdAt: Date.now(), delivered: false
      });
      write(storage, rows);
      return remote;
    }

    async function poll() {
      const rows = read(storage), completed = [];
      for (const row of rows.filter(x => !x.delivered).slice(0, 5)) {
        const remote = await cloud.yanqiuCcToolResult(row.jobId);
        if (!remote || !["completed", "failed"].includes(remote.status)) continue;
        completed.push({ ...row, status: remote.status, result: remote.result, error: remote.error_text || null, completedAt: remote.completed_at || null });
      }
      return completed;
    }

    function markDelivered(jobId) {
      write(storage, read(storage).map(row => row.jobId === jobId ? { ...row, delivered: true, deliveredAt: Date.now() } : row));
    }

    function status() { return read(storage); }
    return { enqueue, poll, markDelivered, status };
  }

  return { ALLOWED: Array.from(ALLOWED), normalizeRequest, createManager };
});
