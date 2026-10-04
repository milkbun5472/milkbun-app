// 拉黑时TA发的消息带微信那颗红色感叹号，还能美化（她 2026-10-01）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), comp = R("components.js"), ts = R("theme-studio.js");

test("被拉黑时TA那几句挂上 blocked，和好那句不挂", () => {
  assert.match(app, /const queueUnblockSpeech = \(chatKey, says, delay, charId, blocked\) => \{/);
  assert.match(app, /\.\.\.\(blocked \? \{ blocked: true \} : \{\}\)/);
  const i = app.indexOf("const blockedReaction = async ("), j = app.indexOf("applyBlockTurnState(charId, chatKey, d);", i);
  assert.ok(i > 0 && j > i, "抠不出 blockedReaction");
  assert.match(app.slice(i, j), /queueUnblockSpeech\(chatKey, says, 250, charId, true\);/);
  assert.match(app, /if \(says\.length\) queueUnblockSpeech\(chatKey, says, 300, charId\);/, "和好那几句被挂上感叹号了");
  // 她 2026-10-05：和好那句不许再是写死的台词
  assert.doesNotMatch(app, /谢谢你愿意听我说。"\]/, "和好又变回写死的一句了");
});

test("感叹号是红的，不跟主题色走；有美化挂点", () => {
  const i = comp.indexOf('"data-wk": "blockdot"');
  assert.ok(i > 0, "没有 blockdot 挂点");
  assert.match(comp.slice(i, i + 400), /background: "#FA5151"/);
  assert.match(ts, /\["blockdot", /, "主题工作台的部件表里没登记");
});
