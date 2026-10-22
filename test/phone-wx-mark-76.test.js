// 拿他手机对微信名单做的几样（删好友、解散群、拉黑）收成 PHONE_WX_MARKS 一处（她 2026-10-22「不能单独搞个拉黑嘛」）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), ui = R("phone-ui.js");
test("三样走同一个 phoneWxMark，刷新提示也从同一张表出", () => {
  assert.match(app, /const PHONE_WX_MARKS = \{/);
  ["del: { key: \"x_phoneWxDel\"", "gone: { key: \"x_phoneWxGone\"", "block: { key: \"x_phoneWxBlock\""].forEach(k => assert.ok(app.includes(k), k));
  assert.match(app, /const phoneBlockFriend = \(char, name, undo\) => phoneWxMark\("block", char, name, undo\);/);
  assert.match(app, /Object\.keys\(PHONE_WX_MARKS\)\.map\(k => \[k, phoneWxList\(k, char\.id\)\]\)/);
  assert.ok(!/loadJSON\("x_phoneWxDel"/.test(app), "app.js 里还有人绕过 phoneWxList 直接读名单");
});
test("通讯录里有「加入黑名单」，接到 onBlockFriend", () => {
  assert.ok(ui.includes('"data-wk": "pblockfriend"'));
  assert.ok(ui.includes("onBlockFriend: ctx.onBlockFriend"));
  assert.ok(app.includes("onBlockFriend: phoneBlockFriend"));
});
