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
assert.ok(!/没说出口的一句(真实第一人称|第一人称)?心声/.test(eng + app));
// 换行留着
assert.equal(guard.accept("188……\n酸死我了  酸死我了\n\n反正是给她花的"), "188……\n酸死我了 酸死我了\n反正是给她花的");
assert.equal(guard.turnPatch({}, "一行\n两行", 1).thought, "一行\n两行");
console.log("ok");
