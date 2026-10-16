// 线下回应选项（群友 2026-10-16）：开了才让模型顺手写三条，点一条直接发；不另外调用
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
test("开关存在线下设置里，传给生成", () => {
  assert.match(comp, /const \[sOpts, setSOpts\] = useState\(!!os\.replyOpts\);/);
  assert.match(comp, /fontSize: sFont, replyOpts: sOpts \}\);/);
  assert.match(app, /replyOpts: !!osFor\(charId\)\.replyOpts,/);
});
test("同一次生成里顺手写，三条，开了才写", () => {
  assert.match(eng, /\(\(!isDigital && session\.replyOpts\) \? "\\n【replyOpts·上面输出形状的追加项】/);
  assert.match(eng, /replyOpts: \(session\.replyOpts && Array\.isArray\(parsed\.replyOpts\)\)[^\n]*\.slice\(0, 3\)/);
});
test("存在那一拍上，最后一拍是 TA 的才出，点了直接发", () => {
  assert.match(app, /\.\.\.\(res\.replyOpts && res\.replyOpts\.length \? \{ replyOpts: res\.replyOpts \} : \{\}\),/);
  assert.match(comp, /"data-wk": "offreplyopt", onClick: \(\) => send\(o\)/);
  assert.match(comp, /lm && lm\.role === "char" && Array\.isArray\(lm\.replyOpts\)/);
});
