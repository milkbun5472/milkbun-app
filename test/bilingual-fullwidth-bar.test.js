// 群友 2026-11-03：「加竖线为啥没被识别成翻译」——全角 ｜ 没认。双语认之前一律换成半角。
const assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8"), cmp = fs.readFileSync("js/components.js", "utf8");
const F = new Function("bracketBilingual", eng.slice(eng.indexOf("function splitBilingual"), eng.indexOf("// 模型把中译另起了一行")) + ";return splitBilingual;")(null);
assert.deepEqual(F("심심해서 연락함｜闲的才来找你"), { text: "심심해서 연락함", zh: "闲的才来找你" });
assert.deepEqual(F("너는 뭐 해? | 你在干嘛"), { text: "너는 뭐 해?", zh: "你在干嘛" });
assert.match(eng, /function joinBilingualLines\(lines, hanLang, opts\) \{\n  lines = \(lines \|\| \[\]\)\.map\(x => x == null \? x : String\(x\)\.replace\(\/\[｜│︱┃\]\/g, "\|"\)\);/);
assert.match(cmp, /\/\[\|｜│︱┃\]\/\.test\(text\.slice\(1\)\)/, "已经躺在记录里的全角那几条，画的时候也劈开");
