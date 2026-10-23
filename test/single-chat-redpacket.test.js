// 私聊红包（她 2026-10-23「转账和红包要不要合并」→ 代码合一、界面分开）：
//   钱走转账那一套（kind transfer + packet），脸是红包；她发过来没拆的那一个，他不知道多少
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");
const app = R("app.js"), comp = R("components.js"), ts = R("theme-studio.js");
test("发红包就是带 packet 的转账，没开第二套记账", () => {
  assert.match(app, /onSendTransfer: \(amount, note, packet\) => runRoomAction\(activeChar\.id, "transfer", \(\) => sendTransfer\(activeChar\.id, amount, note, packet \? \{ packet: true \} : undefined\)\)/);
  assert.match(app, /postCharTransfer\(charId, Number\(parsed\.redPacket\.amount\), parsed\.redPacket\.note \|\| "", \{ packet: true \}\)/);
  assert.doesNotMatch(app, /const sendRedPacketSingle|const respondPacket/);
});
test("她发来没拆的那一个，喂给他的那行不带金额", () => {
  const seg = app.slice(app.indexOf("const transferLineForModel"), app.indexOf("const setMoodFor"));
  assert.match(seg, /还没拆，里面多少钱拆开才知道/);
  assert.match(app, /"\[红包\] 你给 " \+ char\.name \+ " 发了个红包"/);
  assert.match(app, /给" \+ who \+ "发了个红包（里面多少拆开才知道）/);
  assert.match(app, /【她给你发了个红包·还没拆】/);
});
test("界面：＋里多一颗红包，卡用的是群红包那张脸，挂点登记了", () => {
  assert.match(comp, /\["packet", "红包", "packet"\]/);
  assert.match(comp, /m\.kind === "transfer" && m\.packet\) \{/);
  assert.match(comp, /h\(RedPacketCard, \{ rp: \{ message: m\.note \}/);
  assert.match(ts, /\["rpsingle", /);
});
