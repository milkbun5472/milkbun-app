const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
const a=fs.readFileSync(__dirname+"/../js/app.js","utf8");
test("群背景图走 CSS 层压过皮肤的 !important 底色",()=>{
  const i=a.indexOf("const paintGroupLook");const seg=a.slice(i,a.indexOf("};",a.indexOf("applyGroupLook([",i)));
  assert.ok(seg.includes('[data-wk="chat"]{background-image:url("'));
  assert.ok(seg.includes('[data-wk="body"]{background:transparent !important'));
  assert.ok(seg.includes("applyGroupLook([bgCSS,"));
});
