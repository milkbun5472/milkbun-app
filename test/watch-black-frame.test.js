// 一起看：本地片子截出来一片黑（群友 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/watch.js", "utf8");
test("截帧认得出一片黑，重画一次还黑就换成「发张截图给 TA」", () => {
  assert.match(src, /if \(n && lit \/ n < 0\.02\) return "black";/);
  assert.match(src, /requestVideoFrameCallback\(go\)/);
  assert.match(src, /if \(full === "black"\) \{ setFrameBlack\(true\);/);
  assert.match(src, /online \|\| frameBlack\n\s+\? btn\("发张截图给 TA"/);
  assert.match(src, /h\("input", \{ key: "pic", ref: picRef[^\n]+\),\n/);
});
test("一起看分条说：「说」只落下这一句，框空着有没被接的话就变「让 TA 接」，一起回", () => {
  assert.match(src, /if \(!v\) \{ const pend = pendingLines\(\); if \(pend\.length\) ask\("reply", pend\.join\("\\n"\)\); return; \}/);
  assert.ok(!/pushTalk\(\[\{ role: "user", content: v, at: at, ts: Date\.now\(\) \}\]\); setTxt\(""\);\n\s+ask\("reply", v\);/.test(src), "说完不再立刻让 TA 接");
  assert.equal((src.match(/"让 TA 接" : "说"/g) || []).length, 2, "放映和影院两处");
  assert.match(src, /while \(past\.length && past\[past\.length - 1\]\.role === "user" && !past\[past\.length - 1\]\.frame\) past\.pop\(\);/);
});
