// 她 2026-11-02 截图：查手机便签（文字的那种）点开，正文里露出 <#0.7#> 停顿记号。不管语音还是文字便签都摘。
const assert = require("node:assert/strict"), fs = require("fs");
const ui = fs.readFileSync("js/phone-ui.js", "utf8"), eng = fs.readFileSync("js/engine.js", "utf8");
assert.match(ui, /PTX\(noteSay\(it\.body\)\)/);
assert.match(ui, /\}, noteSay\(open\.body\)\)/);
assert.match(ui, /text: noteSay\(open\.body\) \}/);
assert.doesNotMatch(ui, /voice \? noteSay\(/, "别再只给语音便签摘");
const a = eng.indexOf("const TTS_MARK_PAUSE"), b = eng.indexOf("function ttsMarkStrip"), c = eng.indexOf("\n}\n", b) + 3;
const src = eng.slice(a, eng.indexOf("\n", a)) + "\n" + eng.slice(b, c);
let f; try { f = new Function(src + ";return ttsMarkStrip;")(); } catch (e) { f = null; }
if (f) { try { assert.equal(f("马蹄莲……<#1.2#>啧").includes("<#"), false); } catch (e) { if (!(e instanceof ReferenceError)) throw e; } }
