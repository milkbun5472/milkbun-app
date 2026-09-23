// 一起学里「这个人是谁」那几层（她 2026-09-23：「一起学之类的人设有被投进去吗」）。
// 长出来的自我、语气锚、整张卡：都给；主聊天记忆照旧不给（隔离命门）。
const assert = require("assert");
const fs = require("fs");
const st = fs.readFileSync(__dirname + "/../js/study.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const b0 = st.indexOf("function buildStudyPrompt(");
assert(b0 > 0);
const b = st.slice(b0, st.indexOf("\n  }\n", b0));
assert(/grownSelfBlock\(ctx\.grown, ctx\.grownEvolve\)/.test(b));
assert(/parts\.push\(PERSONA_REGISTER_ANCHOR\)/.test(b));
assert(/parts\.push\(WHOLE_CARD_RULE\)/.test(b));
assert(!/memLib|retrieveMemories|formatMemLib/.test(b), "记忆照旧不进一起学");
// 长出来的自我那段措辞只写在一处
assert.strictEqual((eng.match(/【你长出来的自我】这些是这段日子里/g) || []).length, 1);
assert(/parts\.push\(grownSelfBlock\(ctx\.personaGrown, ctx\.personaEvolve\)\)/.test(eng));
// app 递进来的只有这两项
const s0 = app.indexOf("selfFor: c =>");
assert(s0 > 0);
assert(/return \{ grown: x\.personaGrown \|\| "", evolve: !!x\.personaEvolve \}/.test(app.slice(s0, s0 + 300)));
assert(/selfFor: props\.selfFor/.test(st));
console.log("study-whole-person-73-13 ok");
