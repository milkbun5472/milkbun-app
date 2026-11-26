// 群友 2026-11-25：查手机刷新微信，阅读过的文章变空白——新的 me 整个盖掉旧的，格式也没给
const test = require("node:test"), assert = require("node:assert/strict");
const P = require("../js/phone.js");
test("公众号文章：旧的留着、新的加在上面；格式不对的不收", () => {
  const old = { chats: [], me: { signature: "a", accounts: [{ title: "旧文", source: "号", time: "前天" }] } };
  const out = P.phoneGrowMerge("wechat", old, { updates: [], me: { accounts: [{ title: "新文", source: "号", time: "昨晚" }, "只有一个字符串"] } }, Date.now());
  const ts = (out.me.accounts || []).map(a => a.title);
  assert.ok(ts.includes("旧文") && ts.includes("新文"), JSON.stringify(ts));
  assert.ok(!(out.me.accounts || []).some(a => typeof a !== "object"));
});
