const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const body = src.slice(src.indexOf("function netFailMsg("), src.indexOf("async function fetchT("));
const netFailMsg = new Function(body + ";return netFailMsg;")();
test("拉模型列表连不上：不提「最低字数」，先叫查地址", () => {
  const m = netFailMsg(new Error("Load failed"), "list");
  assert.ok(!/最低字数/.test(m)); assert.ok(/接口地址/.test(m));
});
test("聊天连不上：照旧讲三种，含最低字数", () => {
  assert.ok(/最低字数/.test(netFailMsg(new Error("Failed to fetch"))));
});
test("拉列表那一处传了 list", () => { assert.ok(/netFailMsg\(e, "list"\)/.test(src)); });
