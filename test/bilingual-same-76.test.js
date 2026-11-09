// 中文句子被套成「原文 | (同一句)」：摘掉竖线那半截（2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
const a = s.indexOf("function splitBilingual("); let d = 0, i = s.indexOf("{", a); for (; i < s.length; i++) { if (s[i] === "{") d++; else if (s[i] === "}" && --d === 0) break; }
const f = new Function(s.slice(a, i + 1) + ";return splitBilingual;")();
test("译文就是原文（只差括号）就只留原文", () => {
  assert.deepEqual(f("【想要】 | (想要)", false), { text: "【想要】", zh: "" });
  assert.deepEqual(f("おやすみ | 晚安", false), { text: "おやすみ", zh: "晚安" });
});
test("竖线右边带假名不算中译（她 2026-11-04：日文挂成了译文）", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
  assert.match(src, /if \(\/\[\\u3040-\\u30ff\]\/\.test\(zh\)\) return \{ text: orig, zh: "" \};/);
});
