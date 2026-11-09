// 「我的动作」和平时打的（）是同一种消息、开关只在旁白栏（群友 2026-10-31：「不要一个功能分两处」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const R = f => fs.readFileSync(require.resolve("../js/" + f), "utf8");
const app = R("app.js"), cmp = R("components.js"), ts = R("theme-studio.js");
test("输入框旁不再冒开关；开关只在旁白栏「我的动作」那一档", () => {
  assert.doesNotMatch(cmp, /PAREN_ACT_RE\.test\(String\(draft/);
  assert.match(cmp, /kind === "act" && actKey \? h\(ParenActToggle, \{ key: actKey, actKey \}\) : null/);
  assert.match(cmp, /h\(NarrBar, \{ actKey: character && character\.id,/);
  assert.match(cmp, /h\(NarrBar, \{ actKey: group && !gs\.spectate \? "g:" \+ group\.id : null,/);
});
test("「我的动作」发成她自己的一句（）+ parenAct，单聊群聊都是", () => {
  assert.match(cmp, /if \(chatMode === "narr" && narrKind === "act"\) sendRich\(actMsg\(v\)\);/);
  assert.match(cmp, /gKind === "act"\) \{ const tv = String\(v\)\.trim\(\); onSendRich && onSendRich\(\{ role: "user", senderName: meName, content: [^}]+parenAct: true/);
  assert.match(cmp, /if \(gAct\(v\)\) \{ onSendRich && onSendRich\(\{ role: "user", senderName: meName, content: v, parenAct: true \}\); return; \}/);
});
test("单聊群聊气泡斜体，提示词都说明括号里是动作", () => {
  assert.equal((cmp.match(/isU && m\.parenAct \? h\(ParenActText, \{ text: m\.content \}\)/g) || []).length, 2);
  assert.match(app, /const _pa = m\.parenAct && !m\.kind \?/);
  assert.equal((app.match(/m\.parenAct \? "（这条里（）括起来的是她真在做的动作，括号外才是她说的话）" : ""/g) || []).length, 2);
  assert.match(ts, /\["parenacttoggle", /);
});
