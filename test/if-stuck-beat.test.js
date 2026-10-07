// 群友 2026-10-07：另一种我们「不是卡了也没有报错」——她那一拍发出去、TA那一拍没写出来，
// 底下写「点一下继续」点了没反应，整条线停死。现在算她的回合，空着点发出就让TA重写。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
test("TA那一拍没接上时不会停死", () => {
  assert.match(S, /const stuck = lastBeat && !more && bt\.role === "user" && !line\.endedAt;/);
  assert.match(S, /const myTurn = lastBeat && !more && \(bt\.role === "char" \|\| stuck\);/);
  assert.match(S, /if \(!all\.length && !stuck\) return;/);
  assert.match(S, /disabled: !!busy \|\| \(!drafts\.length && !typing\.trim\(\) && !stuck\)/);
});
