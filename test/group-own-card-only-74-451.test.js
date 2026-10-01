// 群里一个模型写所有人、手里摊着所有人的人设：重开的群里互不认识的人照样叫「陆医生」（她 2026-10-02）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js/engine.js"), "utf8");

test("群规里写明：你只知道你自己那张卡，别人的身份只知道他在群里说过的", () => {
  const i = eng.indexOf("const GROUP_IN_CHARACTER = `"), j = eng.indexOf("`;", i);
  assert.ok(i > 0 && j > i, "抠不出 GROUP_IN_CHARACTER");
  const seg = eng.slice(i, j);
  assert.match(seg, /【你只知道你自己的那张卡】/);
  assert.match(seg, /没设定过关系的人，你连他是做什么的都不知道/);
});

test("三处群路都吃得到（走 groupBans）", () => {
  const i = eng.indexOf("function groupBans("), j = eng.indexOf("\n}", i);
  assert.match(eng.slice(i, j), /P\.push\(GROUP_IN_CHARACTER\);/);
});
