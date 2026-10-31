// 旁白模式「我的动作」（群友 2026-10-31：用（）做动作，AI 总和线上说的话搞混）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const R = f => fs.readFileSync(require.resolve("../js/" + f), "utf8");
const app = R("app.js"), cmp = R("components.js"), ts = R("theme-studio.js");
test("单聊、群聊旁白栏都有「我的动作」，发出去是 who: me 的旁白", () => {
  assert.match(cmp, /\["event", "此刻发生了什么"\], \["act", "我的动作"\], \["dir", "往后的方向"\]\], kind: narrKind/);
  assert.match(cmp, /gNarrKinds = gs\.spectate \? [^;]+: \[\["event", "此刻发生了什么"\], \["act", "我的动作"\], \["dir", "往后的方向"\]\];/);
  assert.equal((cmp.match(/\.\.\.\(narrKind === "act" \? \{ who: "me" \} : \{\}\)/g) || []).length, 2);
  assert.match(cmp, /\.\.\.\(gNarrBar && gKind === "act" \? \{ who: "me" \} : \{\}\)/);
});
test("喂给模型标成她的动作、不是说出口的话；群里同一个 narrTag", () => {
  assert.match(app, /"【" \+ uName \+ " 此刻做的动作｜不是说出口的话】\\n" \+ m\.content/);
  assert.match(app, /const narrTag = m => m && m\.who === "me" \?/);
  assert.match(app, /m\.role === "narration" \? narrTag\(m\) \+ m\.content : m\.role === "system"/);
});
test("靠右小框，虚线／实线能换", () => {
  assert.match(cmp, /"data-wk": "myact", "data-frame": actFrameStyle\(\)/);
  assert.match(cmp, /saveJSON\("x_actFrame", n\)/);
  assert.match(ts, /\["myact", /);
  assert.match(ts, /\["actframe", /);
});
