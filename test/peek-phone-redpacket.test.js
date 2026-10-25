// 查手机「＋」里也能发红包（她 2026-10-25）：私聊走转账那条加 packet；群里走他自己发群红包那条（点人就是专属）
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");
const app = R("app.js"), ui = R("phone-ui.js");
test("加号里多一颗红包，跟转账同一块输入", () => {
  assert.match(ui, /onTransferAs \? \["rp", "红包", /);
  assert.match(ui, /const rpOpen = plus === "rp";\n\s+const tfOpen = plus === "tf" \|\| rpOpen;/);
  assert.match(ui, /onTransferAs\(th, tfAmt, tfNote, tfTo, rpOpen \? \{ packet: true, count: Number\(rpCount\) \|\| 0 \} : null\)/);
  assert.match(ui, /onTransferAs: onTransferAs \? \(sess, amt, note, toId, opt\) => onTransferAs\(char, sess, amt, note, toId, opt\) : null/);
});
test("私聊：带 packet 的转账；群里：postRedPacket，没另开一套", () => {
  assert.match(app, /postCharTransfer\(char\.id, a, nt, pk \? \{ byUser: true, packet: true \} : \{ byUser: true \}\)/);
  assert.match(app, /postRedPacket\(gid, char, a, to \? 1 : n, nt, to \? \(to\.remark \|\| to\.name\) : "", \{ byUser: true \}\)/);
  assert.match(app, /const postRedPacket = \(groupId, char, total, count, message, toId, extra\) =>/);
});
test("他手机里那张卡认得出是红包", () => {
  assert.match(ui, /"data-packet": m\.packet \? "1" : "0"/);
  assert.match(app, /status: m\.status \|\| "pending", \.\.\.\(m\.packet \? \{ packet: true \} : \{\}\) \}/);
});
