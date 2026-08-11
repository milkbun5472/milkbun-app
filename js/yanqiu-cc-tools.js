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
    "Write", "Edit", "NotebookEdit", "Bash",
    "get_xiaoke_context", "search_chat_history", "search_memory",
    "read_app_diary", "read_yanqiu_moments", "list_shared_photos",
    "list_read_pending", "search_events",
    "list_characters", "browse_memory", "memory_catalog", "list_photos",
    "get_photo", "read_moments", "list_event_requests", "get_event_request",
    "archive_stats", "peek_inbox",
    "post_moment", "reply_moment_comment", "add_memory", "reply_read",
    "draft_memory_event"
  ]);
  const APPROVAL_REQUIRED = new Set([
    "Write", "Edit", "NotebookEdit", "Bash", "post_moment",
    "reply_moment_comment", "add_memory", "reply_read", "draft_memory_event"
  ]);
  const text = v => String(v == null ? "" : v).trim();
  const read = storage => {
    try { const rows = JSON.parse(storage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(rows) ? rows : []; }
    catch (_) { return []; }
  };
  const write = (storage, rows) => storage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-50)));

  function normalizeRequest(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    // 兼容已归一化的 {toolName,arguments}：app.js 先归一化再传给 enqueue，
    // 只认 name/tool_name 会把每一个合法请求都误判成「未开放或无效」。
    const toolName = text(value.name || value.tool_name || value.toolName);
    if (!ALLOWED.has(toolName)) return null;
    const args = value.args || value.arguments;
    if (!args || typeof args !== "object" || Array.isArray(args)) return null;
    const raw = JSON.stringify(args);
    const mutating = APPROVAL_REQUIRED.has(toolName);
    if (raw.length > (mutating ? 16000 : 2400)) return null;
    return { toolName, arguments: JSON.parse(raw) };
  }

  function needsApproval(request) {
    const clean = normalizeRequest(request);
    return !!(clean && APPROVAL_REQUIRED.has(clean.toolName));
  }

  function approvalSummary(request) {
    const clean = normalizeRequest(request);
    if (!clean) return "无效工具请求";
    const a = clean.arguments || {};
    if (clean.toolName === "Bash") return "运行命令：\n" + text(a.command).slice(0, 800);
    if (["Write", "Edit", "NotebookEdit"].includes(clean.toolName)) return clean.toolName + " 文件：\n" + text(a.file_path || a.notebook_path || "（未提供路径）").slice(0, 800);
    return clean.toolName + "：\n" + JSON.stringify(a, null, 2).slice(0, 1200);
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
      const purpose = text(meta.purpose).slice(0, 1200);
      const remote = await cloud.yanqiuCcToolEnqueue(
        text(meta.charId), clean.toolName, clean.arguments, key,
        meta.lisaMessageKey ? text(meta.lisaMessageKey) : null,
        purpose || null
      );
      if (!remote || !remote.id) throw new Error("CC 工具任务未入队");
      const rows = read(storage);
      if (!rows.some(x => x.jobId === remote.id)) rows.push({
        jobId: remote.id, charId: text(meta.charId), turnId: text(meta.turnId),
        toolName: clean.toolName, purpose: purpose || null, lisaMessageKey: meta.lisaMessageKey || null,
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

  return { ALLOWED: Array.from(ALLOWED), normalizeRequest, needsApproval, approvalSummary, createManager };
});
