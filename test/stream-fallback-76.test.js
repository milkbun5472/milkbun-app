// 她 2026-10-24「为啥不改可以选」：流式默认自动；被线路拒了就退回一次给完、记住这条线路＋模型；每条线路能手动关
const assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8"), ui = fs.readFileSync("js/screens-ui.js", "utf8");
assert.match(eng, /function streamOffFor\(p\) \{ return !!\(p && \(p\.streamMode === "off" \|\| streamLearned\(p\)\)\); \}/);
assert.match(eng, /function routeCanStream\(p\) \{\n  if \(!p \|\| typeof p !== "object"\) return false;\n  if \(typeof streamOffFor === "function" && streamOffFor\(p\)\) return false;/);
assert.match(eng, /const wantStream = !noStream && [^\n]*streamOffFor\(p\)\);/);
assert.match(eng, /const streamRefused = msg => _streamTried && !_streamGot && /);
assert.match(eng, /if \(!d2\.error\) \{ streamLearnOff\(p\); d = d2; \}/);
assert.match(eng, /saveJSON\("x_noStream"/);
assert.ok(!/localStorage\.setItem\("x_noStream"/.test(eng), "新键走 saveJSON，不进小仓库");
assert.match(ui, /"data-wk": "apistream"/);
assert.match(ui, /upd\(\{ streamMode: v \|\| undefined \}\)/);
// 实际跑一遍（浏览器里假线路）：node scripts/checks/stream-fallback-browser.cjs
console.log("ok");
