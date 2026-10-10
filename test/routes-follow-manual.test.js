// 她 2026-10-09：「全部跟攻略走」——对表审出来跟「每一种调用走哪条线路」那张表对不上的几处
const assert = require("assert"), fs = require("fs");
const A = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), S = fs.readFileSync(__dirname + "/../js/study.js", "utf8");
assert.match(A, /summarizeChatBlock\(sumRoute\(apiFor\(charId\)\), ctxFor\(char\), toSummarize\)/, "单聊浓缩总结：后台 → 专线 → 线上");
assert.match(A, /runProbe\(apiFor\(char\.id\) \|\| active, ctxFor\(char\), \{\n\s*instruction: K\.replyPrompt\(/, "吵架和好TA的回话：专线 → 线上");
assert.match(A, /runProbe\(bgActive \|\| active, ctxFor\(char\), \{\n\s*instruction: K\.hisPrompt\(/, "吵架和好TA那一段：后台");
assert.match(A, /callAI\(bgActive \|\| active, sys, \[\{ role: "user", content: "开始。" \}\], \{ maxTokens: 65000, tag: "电台" \}\)/, "电台：后台");
assert.match(A, /const p = offlineActive \|\| active;\n\s*if \(!p\) \{ toast\("先去 设置·API 配一条线路"\); return; \}\n\s*if \(laneBusy\("ficroom:"/, "同人文写下一章：线下");
assert.match(S, /tbAutoQuiz\(props\.bgActive \|\| props\.active, s, stus\)/, "一起学出题：后台");
assert.match(S, /h\(TbThread, \{[^}]*bgActive: props\.bgActive/, "课本那页没拿到后台线路");
console.log("routes follow manual ok");
