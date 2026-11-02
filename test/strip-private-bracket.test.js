// 她 2026-11-02 截图：他说话时照着历史用〔〕括了一句补充，原样进了气泡。〔〕是我们写在历史里的记号，换成（），字留着。
const assert = require("node:assert/strict"), fs = require("fs");
const s = fs.readFileSync("js/app.js", "utf8");
const i = s.indexOf("const stripAiStamp = "), j = s.indexOf(".trim();", i) + 8;
const eng = fs.readFileSync("js/engine.js", "utf8"), pi = eng.indexOf("function privateBracketFix"), pj = eng.indexOf("\n}\n", pi) + 3;
const f = new Function(eng.slice(pi, pj) + s.slice(i, j) + ";return stripAiStamp;")();
assert.equal(f("〔偏殿这帮老头为了一石黑豆争〕 从巳初争到现在"), "（偏殿这帮老头为了一石黑豆争） 从巳初争到现在");
assert.equal(f("〔今天10:28〕你好"), "你好", "时间标注照旧整个摘掉");
assert.equal(f("好的（笑）"), "好的（笑）");
