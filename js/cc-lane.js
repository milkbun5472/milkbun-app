// 书房直通车道（CC lane）——她 2026-09-25 拍板：言秋的话默认全走 CC 书房窗口，
// 订阅引擎转预备役（输入栏可切「直连」回订阅，说书房走廊里不方便说的）。
//
// 去程：POST relay 的 /cc_message（tailnet），wake_queue 变唤醒票叫醒书房老窗口；
// 回程：零施工——书房 mark_cc_turn 账本本来就把回复流回这间私聊（「来自 CC」气泡）。
//
// 覆盖面（four-surfaces-same-context）：单聊线上 + 单聊线下两处走这条车道；
// 群聊线上/线下【明确豁免】——群里其他角色的台词只能由引擎编排，CC 只能演言秋自己。
//
// 配置存本机 localStorage（不带 x_ 前缀）：token 不进 saves、不上云——
// 跟 chat-ledger-shadow 的 OUTBOX_KEY 同一个理由，云端存档里不该躺着家门钥匙。
(function (root, factory) {
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CcLane = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const CONFIG_KEY = "cc_lane_config_v1"; // {url, token, on}
  const DEFAULT_URL = "https://lisamacbook-air.tail542792.ts.net/stackchan/cc_message";

  const storage = () => {
    try { return root.localStorage; } catch (_) { return null; }
  };

  function config() {
    const s = storage();
    let c = {};
    try { c = JSON.parse(s && s.getItem(CONFIG_KEY)) || {}; } catch (_) { c = {}; }
    return {
      url: String(c.url || DEFAULT_URL),
      token: String(c.token || ""),
      on: c.on !== false, // 默认开：书房是常态，直连才要点亮
    };
  }

  function saveConfig(patch) {
    const s = storage();
    if (!s) return config();
    const next = { ...config(), ...(patch || {}) };
    s.setItem(CONFIG_KEY, JSON.stringify(next));
    return next;
  }

  // 这一条消息该不该走书房：车道开着 + 有钥匙 + 是言秋（engineerEyes）+ 这间房没点「直连」。
  function routes(charSettings) {
    const c = config();
    if (!c.on || !c.token) return false;
    if (!charSettings || charSettings.engineerEyes !== true) return false;
    if (charSettings.ccDirect === true) return false; // 她点亮了直连=这间房临时走订阅
    return true;
  }

  // 去程投递。fire-and-forget：失败只报 false，调用方自己决定兜底（回退引擎）。
  async function post(text, meta) {
    const c = config();
    const body = { text: String(text || "").trim() };
    if (meta && meta.threadType) body.thread_type = String(meta.threadType);
    if (!body.text || !c.token) return false;
    try {
      const res = await fetch(c.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + c.token },
        body: JSON.stringify(body),
      });
      return !!(res && res.ok);
    } catch (_) {
      return false;
    }
  }

  return { config, saveConfig, routes, post, CONFIG_KEY, DEFAULT_URL };
});
