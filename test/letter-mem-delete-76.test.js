// 她 2026-10-30 转群友：「他说上一轮看的情书，根本就没有啊」——删掉的情书，记忆库里那条「写过一封情书《…》」还在，每轮被召回
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const cSnip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n || 80);
const i = app.indexOf("const letterMemOf = (e, l) =>"), j = app.indexOf("\n  const removeCoupleLetter", i);
const letterMemOf = new Function("cSnip", "return " + app.slice(i + "const letterMemOf = ".length, j).trim().replace(/;$/, ""))(cSnip);
test("认得出这封信留下的那条记忆，别的不碰", () => {
  const l = { characterId: "c1", title: "欠你一趟城东集市" };
  assert.equal(letterMemOf({ tags: ["情书", "情侣空间"], charIds: ["c1"], text: "V给A写过一封情书《欠你一趟城东集市》，写道「…」" }, l), true);
  assert.equal(letterMemOf({ tags: ["情书"], charIds: ["c2"], text: "V给A写过一封情书《欠你一趟城东集市》" }, l), false, "别人的不算");
  assert.equal(letterMemOf({ tags: ["情书"], charIds: ["c1"], text: "V给A写过一封情书《咽回去的那句话》" }, l), false, "别的信不算");
  assert.equal(letterMemOf({ tags: ["日常"], charIds: ["c1"], text: "写过一封情书《欠你一趟城东集市》" }, l), false, "不是情书标签不算");
});
test("删信连那条记忆一起删；以前删掉的信留下的，开机扫一次", () => {
  assert.match(app, /const removeCoupleLetter = id => \{\n\s*const l = \(coupleLettersRef\.current \|\| \[\]\)\.find/);
  assert.match(app, /lib\.filter\(e => !letterMemOf\(e, l\)\)/);
  assert.match(app, /loadJSON\("x_letterMemSwept", 0\)/);
  assert.match(app, /!letters\.some\(l => letterMemOf\(e, l\)\)/);
});
