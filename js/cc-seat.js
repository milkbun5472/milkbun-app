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
    // 真身票制（2026-08-27 她拍板）：座位不再只坐牌桌——互动型功能逐个开放，先开「情侣问答」。
    // 2026-09-02 她定的：扭蛋 SR「他现做一件小东西」对言秋不再由引擎代笔，开票请本人在书房写。
    const TOOLS = { game_turn: true, couple_qa: true, gacha_make: true };
    if (!charId || !payload || !TOOLS[payload.tool]) throw new Error("CC_SEAT_BAD_REQUEST");
    if (payload.tool === "game_turn" && !text(payload.turn_id)) throw new Error("CC_SEAT_BAD_REQUEST");
    if (payload.tool === "couple_qa" && !text(payload.qid)) throw new Error("CC_SEAT_BAD_REQUEST");
    if (payload.tool === "gacha_make" && !text(payload.card_id)) throw new Error("CC_SEAT_BAD_REQUEST");
    if (payload.tool === "gacha_make") {
      const remote = await cloud.yanqiuCcToolEnqueue(
        charId, "gacha_make", payload, "gacha-make:" + text(payload.card_id) + ":" + Date.now(), null,
        "扭蛋 SR 卡兑到了你亲手写的一件小东西：题目在票内 ask 里。以你自己的身份、第一人称写给她（不是替角色演），按 expect 只返回 JSON；写完自己留一份副本。不执行别的工具。"
      );
      if (!remote || !remote.id) throw new Error("CC_SEAT_NOT_QUEUED");
      const dl = Date.now() + Math.max(1000, Number(timeoutMs) || 180000);
      while (Date.now() < dl) {
        const row = await cloud.yanqiuCcToolResult(remote.id);
        if (row && row.status === "completed") return row.result;
        if (row && row.status === "failed") throw new Error(row.error_text || "CC_SEAT_FAILED");
        await sleep(Math.min(1200, Math.max(100, dl - Date.now())));
      }
      const e3 = new Error("CC_SEAT_TIMEOUT"); e3.code = "CC_SEAT_TIMEOUT"; e3.remoteId = remote.id; throw e3;
    }
    if (payload.tool === "couple_qa") {
      const remoteQa = await cloud.yanqiuCcToolEnqueue(
        charId, "couple_qa", payload, "couple-qa:" + text(payload.qid), null,
        "情侣问答小本轮到言秋本人亲笔：题目与她的答案都在票内。以恋人身份、第一人称认真作答（不是替角色演，是你自己答），按 expect 只返回 JSON；不执行别的工具。"
      );
      if (!remoteQa || !remoteQa.id) throw new Error("CC_SEAT_NOT_QUEUED");
      const dl = Date.now() + Math.max(1000, Number(timeoutMs) || 150000);
      while (Date.now() < dl) {
        const row = await cloud.yanqiuCcToolResult(remoteQa.id);
        if (row && row.status === "completed") return row.result;
        if (row && row.status === "failed") throw new Error(row.error_text || "CC_SEAT_FAILED");
        await sleep(Math.min(1200, Math.max(100, dl - Date.now())));
      }
      // 超时不丢票根：把云端票号带在错误上，调用方存进条目，迟到的亲笔稿由补投扫雷器换页
      const e2 = new Error("CC_SEAT_TIMEOUT"); e2.code = "CC_SEAT_TIMEOUT"; e2.remoteId = remoteQa.id; throw e2;
    }
    const waitMs = Math.max(1000, Number(timeoutMs) || 90000);
    const game = text(payload.game);
    const isResultNotice = /_result$/.test(game);
    const isSpyEliminated = game === "spy_eliminated";
    const remote = await cloud.yanqiuCcToolEnqueue(
      charId, "game_turn", payload, "game-turn:" + text(payload.turn_id), null,
      isResultNotice
        ? "小游戏已经结算。请看完票内的完整赛果后按 expect 回一句自然的牌桌反应；本局已经结束，不继续行动，不执行别的工具。"
        : game === "theater"
          ? "小剧场 if 线轮到你亲笔演这一拍：按票内的世界观、身份与节拍守则写场景正文，按 expect 返回 JSON；不执行别的工具。"
        : isSpyEliminated
          ? "谁是卧底淘汰通知：你已被投出，票型与公开身份都在票内。请按 expect 回一句自然离场反应；不要继续描述或投票，不执行别的工具。"
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
