// 她 2026-10-06：「存进时刻也要做小卡」——原来只落一行灰字系统消息
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const shike = fs.readFileSync(path.join(__dirname, "..", "js", "shike.js"), "utf8");
test("TA 存一刻时落的是同一张 ShikeShareCard，标「TA 存进时刻」", () => {
  assert.ok(app.indexOf("把这一刻存进了时刻：") < 0, "那行灰字还在");
  assert.match(app, /role: "assistant", kind: "shikeshare", content: "〔把这一刻存进了时刻〕「"/);
  assert.match(app, /shike: \{ title: _kt, ts: Date\.now\(\), byChar: true, lines: _kw \? \[_kw\] : \[\] \}/);
  assert.match(shike, /sk\.byChar \? "TA 存进时刻 · " : "时刻 · "/);
});

test("以前那几行灰字画的时候也认成小卡，存档不动；为什么从时刻里那条找回来", () => {
  const cmp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
  const a = cmp.indexOf("function oldKeepMoment("), b = cmp.indexOf("function shareCardOf(kind)");
  const pins = { c1: [{ byChar: true, title: "她说她也想我", text: "这句要留着", ts: 1000 }, { byChar: true, title: "别的", text: "x", ts: 1000 }] };
  const f = new Function("loadJSON", cmp.slice(a, b) + "\nreturn oldKeepMoment;")(() => pins);
  const r = f({ role: "system", kind: "system", content: "齐周 把这一刻存进了时刻：「她说她也想我」", ts: 1200 }, { id: "c1" });
  assert.equal(r.shike.title, "她说她也想我");
  assert.deepEqual(r.shike.lines, ["这句要留着"]);
  assert.equal(r.shike.byChar, true);
  assert.equal(f({ role: "system", content: "别的系统消息" }, { id: "c1" }), null);
  assert.match(cmp, /const _oldKeep = \(m\.kind === "system" \|\| m\.role === "system"\) && window\.ShikeShareCard \? oldKeepMoment\(m, character\) : null;/);
});
