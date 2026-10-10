// 聊天里的时刻卡点「去时刻里看」翻到时刻里这个人、停在那一张（她 2026-10-11：角色写的时刻卡不能跳转）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const R = f => fs.readFileSync(require.resolve("../js/" + f), "utf8");
const app = R("app.js"), cmp = R("components.js"), sk = R("shike.js");

test("卡上有去时刻里看，单聊、群聊、旧灰字那张都带上是谁的", () => {
  assert.match(sk, /function ShikeShareCard\(\{ m, isU, charId \}\)/);
  assert.match(sk, /"data-wk": "shikesharego"/);
  assert.match(sk, /window\.__openShike\(charId, \{ key: m\.shikeKey \|\| "", title: sk\.title \|\| "", ts: sk\.ts \|\| m\.ts \}\)/);
  assert.match(cmp, /h\(_Share, \{ m: m, isU: m\.role === "user", charId: character && character\.id \}\)/);
  assert.match(cmp, /h\(_GShare, \{ m: m, isU: m\.role === "user", charId: m\.role !== "user" \? m\.senderId : null \}\)/);
  assert.match(cmp, /h\(window\.ShikeShareCard, \{ m: _oldKeep, isU: false, charId: character && character\.id \}\)/);
});
test("进时刻停在那一张：先认 key，再认同名里时间最近的；离开时刻就忘掉", () => {
  assert.match(app, /window\.__openShike = \(charId, f\) => \{ setShikeFocus\(/);
  assert.match(app, /focus: shikeFocus,/);
  assert.match(app, /if \(screen !== "shike" && shikeFocus\) setShikeFocus\(null\);/);
  assert.match(sk, /useState\(\(\) => \(props\.focus && props\.focus\.charId\) \|\| null\)/);
  assert.match(sk, /at = f\.key \? list\.findIndex\(x => x && x\.key === f\.key\) : -1;/);
  assert.match(sk, /x\.title === f\.title/);
});
