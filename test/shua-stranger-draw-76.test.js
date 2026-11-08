const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// 群里 2026-11-08：片刻推荐里画出来每一条都没有人
test("没角色卡的人出镜，画一个普通人，不走纯空景", () => {
  const app = read("js/app.js"), eng = read("js/engine.js");
  assert.match(eng, /function buildStrangerPrompt\(sceneDesc, opts\)/);
  assert.match(app, /!char && kind !== "view" && typeof buildStrangerPrompt === "function" \? buildStrangerPrompt\(desc, \{ body: kind === "part" \}\)/);
});
test("片刻格式里 who 讲清楚是什么，不再只摆一个 none 当示范；刷出来的旧 none 交给画面自己认", () => {
  const s = read("js/shua.js");
  assert.doesNotMatch(s, /"who":"none"/);
  assert.match(s, /const WHO_FIELD = /);
  assert.match(s, /const NPC_SHAPE = [^\n]*WHO_FIELD/);
  assert.match(s, /props\.draw\(v\.by === "char" \? v\.charId : null, sc, drawWho\(v\)\)/);
  const S = x => String(x == null ? "" : x);
  const f = new Function("S", s.match(/const drawWho = [^\n]*/)[0] + "\n" + s.match(/const whoOf = [^\n]*/)[0] + "\nreturn drawWho;")(S);
  assert.equal(f({ by: "npc", who: "none" }), "");
  assert.equal(f({ by: "me", who: "none" }), "none");
  assert.equal(f({ by: "npc", who: "self" }), "self");
});
