// 她 2026-11-19：「群里他们不能发起骰子和抽签吗」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js");
test("群成员能自己掷骰子／抽签：协议里有这一格，结果手机现掷，落成同一张卡、写着是谁", () => {
  assert.match(app, /\\"luck\\":\{\\"type\\":\\"dice\\",\\"n\\":骰子颗数1到3\}/);
  assert.match(app, /if \(item\.luck && typeof item\.luck === "object" && spk\)/);
  assert.match(app, /kind: "luck", luck: \{ type: "dice", vals, by: spk\.name \}/);
  assert.match(app, /kind: "luck", luck: \{ type: "draw", what: q0, names: names0, by: spk\.name \}/);
  assert.match(comp, /\(L\.by \? L\.by \+ " " : ""\)/);
});
test("骰子卡摆在这个人这一条的话后面", () => {
  assert.ok(app.indexOf("// 他们自己掷骰子／抽签") > app.indexOf("bubbleId: \"word-\" + i + \"-\" + j"), "得在这一条的气泡发完之后");
  assert.ok(app.indexOf("// 他们自己掷骰子／抽签") < app.indexOf("// 群照片：该成员这条发言带了 photo 对象"));
});
