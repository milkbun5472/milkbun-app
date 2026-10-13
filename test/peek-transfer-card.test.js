// 她 2026-10-13：TA手机微信里转账只是一行字；想替TA点收下。＋那排还是 emoji
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), ph = R("phone.js");
test("查手机里转账渲染成卡，能替TA收下/退回", () => {
  assert.match(app, /m\.kind === "transfer" && m\.tid\) \? \{ kind: "transfer", tid: m\.tid/);
  assert.match(app, /onTfReplyAs: \(char, tid, accept\) => respondTransfer\(char\.id, tid, accept\)/);
  assert.match(ph, /"data-wk": "ptfcard"/);
  assert.match(ph, /onTfReplyAs\(m\.tid, k === "ok"\)/);
  assert.match(ph, /onTfReplyAs: ctx\.onTfReplyAs/);
});
test("＋那排不用 emoji", () => {
  assert.doesNotMatch(ph, /"🛍"|"🥡"/);
  assert.match(ph, /h\(Svg, \{ size: 24, color: "#555", sw: 1\.6 \}, ic\)/);
});

test("别的小卡和语音也渲染，不是一行【…】", () => {
  const i = app.indexOf("function richCardOf(m)");
  const f = new Function(app.slice(i, app.indexOf("\n    }", i) + 6) + "; return richCardOf;")();
  assert.deepEqual(f({ kind: "redpacket", content: "[红包] 恭喜发财" }), { kind: "card", label: "红包", body: "恭喜发财" });
  assert.equal(f({ kind: "voice", content: "在吗在吗", dur: 2 }).kind, "voice");
  assert.equal(f({ content: "你好" }), null);
  assert.match(ph, /"data-wk": "pcard"/);
});
