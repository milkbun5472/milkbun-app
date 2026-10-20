// 她 2026-10-11：粤语角色的语音、气泡「听一下」念出来是普通话——language_boost 一律给了 Chinese
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const i = engine.indexOf("function ttsLangBoost(");
const seg = engine.slice(i, engine.indexOf("\n}\n", i) + 3);
const boost = new Function("toSimplified", seg + "\nreturn ttsLangBoost;")(t => t.replace(/聽/g, "听").replace(/話/g, "话").replace(/藥/g, "药"));

test("粤语字走 Chinese,Yue；只有繁体的，嗓子是粤语角色的才走粤语，普通话照旧 Chinese", () => {
  assert.equal(boost("食咗藥算你聽話"), "Chinese,Yue");
  assert.equal(boost("聽話", true), "Chinese,Yue");
  // 群里 2026-10-18：人设写繁体的普通话角色被念成粤语
  assert.equal(boost("聽話"), "Chinese");
  assert.equal(boost("吃了药算你听话"), "Chinese");
  assert.equal(boost("こんにちは"), "Japanese");
  assert.equal(boost("hello there"), "English");
});
test("ttsKeyFor 按这把嗓子挂在谁身上判粤语", () => {
  assert.match(engine, /const boost = ttsLangBoost\(txt, yueVoice\);/);
  assert.match(engine, /String\(c\.voiceId \|\| ""\)\.trim\(\) === vid && \/粤\|粵/);
});

test("普通话也常用的唔／咁／咩，只在粤语角色身上算粤语（群里 2026-10-20）", () => {
  assert.equal(boost("唔……被姐姐握着能不大嘛"), "Chinese");
  assert.equal(boost("唔……被姐姐握着能不大嘛", true), "Chinese,Yue");
  assert.equal(boost("你喺边度"), "Chinese,Yue");
});
