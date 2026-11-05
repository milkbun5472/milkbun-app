// 旁观群的回声带进单聊时，按每一句那时她在不在群里标（她 2026-11-04：退出变旁观、或者反过来）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const a = R("app.js");
test("进出群那两行带 presence", () => {
  assert.match(a, /"拉进了群聊", \{ presence: "in" \}\);/);
  assert.match(a, /me \+ "退出了群聊", \{ presence: "out" \}\);/);
});
test("逐条算：第一次切换之前是反着的那个身份，没切换过照现在", () => {
  assert.match(a, /let _inNow = _first \? _first === "out" : !groupSpectating\(g\);/);
  assert.match(a, /const _p = _pres\(m\); if \(_p\) \{ _inNow = _p === "in"; return; \}/);
  assert.match(a, /surface: "群「" \+ g\.name \+ "」" \+ \(_inNow \? "" : "·她那时不在这个群里"\)/);
  assert.match(R("engine.js"), /标着「她那时不在这个群里」的那几行，是她不在群里的时候说的，她看不到/);
});
