const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const ts = fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("block bar and unblock card carry theme hooks, registered in the studio", () => {
  ["blockbar", "blockbaricon", "blockbartitle", "blockbarhint", "blockbarbtn", "unblockcard", "unblocktitle", "unblockbody", "unblockbtns", "unblockstatus"].forEach(k => {
    assert.ok(comp.includes('"data-wk": "' + k + '"'), "缺挂点 " + k);
    assert.ok(ts.includes('["' + k + '", '), "工作台没登记 " + k);
  });
  assert.match(comp, /"data-who": bk\.theyBlocked \? "them" : "me"/);
  assert.match(comp, /bk\.iBlocked && onUnblock \?/);
  assert.match(app, /onUnblock: \(\) => toggleBlock\(activeChar\.id, blockChatKey\(activeChar\.id\)\)/);
});
test("system note paper carries hooks; block notes tagged", () => {
  ["sysnote", "sysnotelabel", "sysnotetext", "sysnoteclose"].forEach(k => {
    assert.ok(comp.includes('"data-wk": "' + k + '"'), "缺挂点 " + k);
    assert.ok(ts.includes('["' + k + '", '), "工作台没登记 " + k);
  });
  assert.match(comp, /const sysNoteKind = m =>/);
  assert.match(app, /content: "你拉黑了 TA", sub: "block"/);
  assert.match(app, /content: "你解除了拉黑", sub: "block"/);
});
