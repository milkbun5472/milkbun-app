const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
const c=fs.readFileSync(__dirname+"/../js/components.js","utf8");
test("群里她在上面看时，新消息不把她拽到底，底下挂一颗",()=>{
  assert.ok(c.includes('if (!atBottomRef.current && added > 0 && !(last && last.role === "user")) { setNewBelow(n => n + added); return; }'));
  assert.ok(c.includes('"data-wk": "gnewbelow"'));
});
