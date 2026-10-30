// 她 2026-10-30 截图：线下粤语台词有的句子没译键——「陸啟架車下晝兩點幾到機場……」一个粤语专用字都没有，单句认不出
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("同一段台词里认出粤语，别的繁体台词句跟着挂译键；叙述和简体不碰", () => {
  assert.match(comp, /const _yueHere = typeof translatableLang === "function" && segs\.some\(x => x\.k === "say" && offSaySentences\(x\.s\)\.some\(sen => translatableLang\(sen\) === "粤语"\)\);/);
  assert.match(comp, /const _hintOf = sen => _yueHere && typeof toSimplified === "function" && toSimplified\(sen\) !== sen \? "粤语" : undefined;/);
  assert.match(comp, /zhReady: offSayZhOf\(sayZh, sen\), langHint: _hintOf\(sen\) \}/);
  assert.match(comp, /\|\| \(langHint && \/\[\\u4e00-\\u9fff\]\/\.test\(String\(text \|\| ""\)\) \? langHint : ""\);/, "自己认不出时才照 hint");
  assert.match(comp, /return h\(TransTextState, \{ key: JSON\.stringify\(\[text, !!isU, zhReady \|\| ""\]\), text, isU, zhReady, ink, autoShow, long, size, noModel, inline, langHint \}\);/);
});
