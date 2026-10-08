const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("匿名吧里她自己的楼和楼中楼显示匿名者，不露本名",()=>{
  const s=fs.readFileSync(__dirname+"/../js/screens.js","utf8");
  assert.ok(s.includes("(cm.alt || cm.anon ? cm.authorName : meChar.name)"));
  assert.ok(s.includes("(r.alt || r.anon ? r.authorName : meChar.name)"));
  assert.ok(!/\(cm\.alt \? cm\.authorName : meChar\.name\)|\(r\.alt \? r\.authorName : meChar\.name\)/.test(s));
});
