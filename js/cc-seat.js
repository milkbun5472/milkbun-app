(function (root, factory) {
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CCSeat = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const text = v => String(v == null ? "" : v).trim();

  async function ask(payload, timeoutMs, options) {
    options = options || {};
    const cloud = options.cloud || root.Cloud;
    const charId = text(options.charId || payload && payload.char_id);
    if (!cloud || typeof cloud.yanqiuCcToolEnqueue !== "function" || typeof cloud.yanqiuCcToolResult !== "function") throw new Error("CC_SEAT_OFFLINE");
    if (!charId || !payload || payload.tool !== "game_turn" || !text(payload.turn_id)) throw new Error("CC_SEAT_BAD_REQUEST");
    const waitMs = Math.max(1000, Number(timeoutMs) || 90000);
    const isResultNotice = text(payload.game) === "uno_result";
    const remote = await cloud.yanqiuCcToolEnqueue(
      charId, "game_turn", payload, "game-turn:" + text(payload.turn_id), null,
      isResultNotice
        ? "UNO 已结算：Lisa 赢了。请看完赛果后按 expect 回一句自然的牌桌反应，不继续出牌，不执行别的工具。"
        : "小游戏轮到言秋本人出手；只需按 expect 返回 JSON，不执行别的工具。"
    );
    if (!remote || !remote.id) throw new Error("CC_SEAT_NOT_QUEUED");
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      const row = await cloud.yanqiuCcToolResult(remote.id);
      if (row && row.status === "completed") return row.result;
      if (row && row.status === "failed") throw new Error(row.error_text || "CC_SEAT_FAILED");
      await sleep(Math.min(1200, Math.max(100, deadline - Date.now())));
    }
    const error = new Error("CC_SEAT_TIMEOUT"); error.code = "CC_SEAT_TIMEOUT"; throw error;
  }

  return { ask };
});
