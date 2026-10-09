const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
const a=fs.readFileSync(__dirname+"/../js/app.js","utf8"),c=fs.readFileSync(__dirname+"/../js/components.js","utf8"),s=fs.readFileSync(__dirname+"/../js/screens.js","utf8");
test("论坛和朋友圈都能换一批，她自己的话留着",()=>{
  assert.ok(a.includes('f.authorType === "me" || (f.replies || []).some(r => r && r.authorType === "me")'));
  assert.ok(a.includes('c.author === meName0 || c.author === "我"'));
  assert.ok(a.includes("onRegenFloors: regenForumFloors,")&&a.includes("onRegenMomentComments: regenMomentComments,"));
  assert.ok(s.includes('"data-wk": "foregen"')&&c.includes('"data-wk": "moregen"'));
});
