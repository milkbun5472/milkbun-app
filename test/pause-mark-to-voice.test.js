// 文字气泡里冒出 <#0.5#>：那本来是语音，还回语音（群里报 2026-09-28）
const fs = require("fs"), assert = require("assert"), vm = require("vm");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const a = eng.indexOf("const TTS_MARK_PAUSE"), b = eng.indexOf("const TTS_MARK_TAG_RE");
const c = eng.indexOf("function ttsHasPause"), d = eng.indexOf("// 按台词自动选发音矫正");
const sb = {}; vm.runInNewContext(eng.slice(a, b) + eng.slice(c, d) + ";this.f=pullPauseVoice;this.h=ttsHasPause;", sb);
let r = sb.f(["头头……<#0.5#>不气了好不好", "<#0.3#>我真的全记住了", "再也不惹你发火了～"]);
assert.deepStrictEqual([...r.voice], ["头头……<#0.5#>不气了好不好 <#0.3#>我真的全记住了"]);
assert.deepStrictEqual([...r.words], ["再也不惹你发火了～"]);
r = sb.f(["早", "吃了吗"]); assert.strictEqual(r.voice.length, 0); assert.strictEqual(r.words.length, 2);
assert.ok(sb.h("a<#1#>b") && sb.h("a<#1#>b") && !sb.h("a#1b"), "判据不受 g 正则 lastIndex 影响");
assert.ok(/pullPauseVoice\(words\)/.test(app), "单聊接上了");
assert.ok(/item\.voice === true \|\| \(typeof ttsHasPause === "function" && ttsHasPause\(item\.text\)\)/.test(app), "群聊接上了");
console.log("pause-mark-to-voice ok");
