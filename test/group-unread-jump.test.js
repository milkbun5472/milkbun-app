const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
const a=fs.readFileSync(__dirname+"/../js/app.js","utf8"),c=fs.readFileSync(__dirname+"/../js/components.js","utf8");
test("进群记住几条没看，群里挂一颗跳到第一条没看的",()=>{
  assert.ok(a.includes("setGOpenUnread(was > 0 ? { id: id, n: was } : null)"));
  assert.ok(a.includes("openUnread: gOpenUnread && gOpenUnread.id === activeGroup.id ? gOpenUnread.n : 0"));
  assert.ok(c.includes('"data-wk": "gunreadjump"'));
  assert.ok(c.includes("const idx = Math.max(0, messages.length - openUnread);"));
});
