// 她 2026-10-05：「群线上开了共处一室……心声还是这样，单聊有时候又是好的」——群那边还是旧的一长串禁令
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("群线上两支心声都只用 THOUGHT_MEANING，旧禁令清掉", () => {
  const i = app.indexOf("const _gThoughtIs = "), seg = app.slice(i, app.indexOf("const thoughtField", i));
  assert.ok(i > 0);
  assert.match(seg, /THOUGHT_MEANING/);
  assert.doesNotMatch(seg, /别重复、别原地打转、别套话/);
  assert.doesNotMatch(seg, /本轮真正有情绪波动/);
  assert.equal((seg.match(/_gThoughtIs/g) || []).length, 3, "两支没都用它");
});

// 她 2026-10-28：群里心声只剩场景（八股），单聊同一类人想得很多——给群心声跟单聊同一个来处
test("群心声从TA这一轮最在意的那一点长出来", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js/app.js"), "utf8");
  const eng = require("fs").readFileSync(require("path").join(__dirname, "..", "js/engine.js"), "utf8");
  assert.match(eng, /const THOUGHT_ORIGIN = "心声从TA在这一轮里最在意的那一点长出来/, "一句公用的");
  assert.match(src, /\+ \(typeof THOUGHT_ORIGIN === "string" \? THOUGHT_ORIGIN : ""\);/, "线上群聊引它");
  // 她 2026-10-29「统一」：线下单人、线下群像也引同一句
  assert.match(eng, /thought 每轮必须填写，禁止 null、空串或省略：\$\{THOUGHT_MEANING_CHAR\}\$\{THOUGHT_VOICE\}\$\{THOUGHT_ORIGIN\}/);
  assert.match(eng, /THOUGHT_EACH_OWN : ""\) \+ THOUGHT_ORIGIN/);
});

// 她 2026-10-30：群聊心声太短——心声挂在短气泡那一格，被气泡长短带着走
test("群心声跟气泡长短脱钩", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js/app.js"), "utf8");
  assert.match(src, /心声跟这条气泡的长短无关：话可以只说一两句，心里想的可以写成一整段；心思多的时候写长是正常的。/);
});
