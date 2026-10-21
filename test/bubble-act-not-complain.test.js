const test = require("node:test"); const assert = require("node:assert");
const g = require("../js/bubble-act-guard.js");
test("「他又抱怨」不是贴身动作；句尾带～的是在说话", () => {
  const r = g.split(["两米二的大床就留给阿暮一个人在上面横着睡", "省得他又抱怨被子缩水～"], {});
  assert.equal(r.acts.length, 0); assert.equal(r.words.length, 2);
  assert.ok(!g.hasActEvidence("他又抱歉地笑了笑"));
  assert.ok(g.hasActEvidence("她又抱紧了一点"), "真正的抱还要认");
  assert.equal(g.split(["我把脸颊在她怀里贴紧了蹭两下", "环在她后腰的手微微收紧", "不让她滑下去"], {}).acts.length, 3);
});
