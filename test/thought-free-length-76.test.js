// 她 2026-10-22：心声别压成一句（别家那种一段念头在走的更好）。言秋那份 THOUGHT_MEANING 不动。
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const eng = rd("engine.js"), app = rd("app.js");
const guard = require("../js/thought-voice-guard.js");
assert.match(eng, /const THOUGHT_VOICE = ".*长短随这个念头本身。"/);
// 她 2026-10-22：列出「可以跳、可以翻来覆去…」也是在给方向
["翻来覆去", "劝回来", "拧着", "不用压成一句"].forEach(w => assert.ok(!eng.match(/const THOUGHT_VOICE = ".*";/)[0].includes(w), "又在给方向：" + w));
assert.ok(!/每轮必须写一句/.test(app));
assert.ok(!/第一人称短念头/.test(app));
assert.ok(!/没说出口的一句(真实第一人称|第一人称)?心声/.test(eng + app.replace(/const BLOCK_STATE_SHAPE = .*\n/, "")));   // 拉黑那条言秋也走，照旧
// 普通角色用自己那份定义，不再压「那一句／一句嘀咕」；言秋那份原样
const charMeaning = eng.match(/const THOUGHT_MEANING_CHAR = "(.*)";/)[1];
assert.ok(!/一句/.test(charMeaning));
assert.match(eng, /const THOUGHT_MEANING = "他此刻心里正转着、没说出口的那一句，/);
assert.ok(!/THOUGHT_MEANING \+ THOUGHT_VOICE|\$\{THOUGHT_MEANING\}\$\{THOUGHT_VOICE\}|THOUGHT_MEANING\}\$\{typeof THOUGHT_VOICE/.test(eng + app), "普通角色那几处还在用言秋那份");
// 换行留着
assert.equal(guard.accept("188……\n酸死我了  酸死我了\n\n反正是给她花的"), "188……\n酸死我了 酸死我了\n反正是给她花的");
assert.equal(guard.turnPatch({}, "一行\n两行", 1).thought, "一行\n两行");
console.log("ok");

// 「一句」在 11-14 一次合并里又被带回来过（她 2026-11-23：「原来我都删掉了的 什么时候又加回来了」）
require("node:test")("心声提示里不再说「一句」", () => {
  const fs = require("fs"), assert = require("assert");
  for (const f of ["js/app.js", "js/listen-talk.js"]) assert.ok(!/一句(你此刻)?没说出口的念头/.test(fs.readFileSync(f, "utf8")), f);
});
