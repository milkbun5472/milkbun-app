// 联机首页排法（2026-11-23 她：「看起来好乱」）：进门的事在上，以前的房间、认识的人其次，递名片折在最底下
const fs = require("fs"), path = require("path"), assert = require("assert"), test = require("node:test");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "netroom.js"), "utf8");
const home = src.slice(src.indexOf('h(Head, { zh: "联机", onBack: props.onBack })'));
test("首页顺序：开房/加入 → 以前的房间 → 认识的人 → 折起来的递名片", () => {
  const at = k => { const i = home.indexOf(k); assert.ok(i > 0, k); return i; };
  assert.ok(at('"nrhost"') < at('"nrhist"'));
  assert.ok(at('"nrhist"') < at('"nrknownopen"'));
  assert.ok(at('"nrknownopen"') < at('"nrsupafold"'));
  assert.match(home, /"nrsupafold", open: useSupa/);
});
