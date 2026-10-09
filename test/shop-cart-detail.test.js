const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("购物车里的商品点开能进详情，从购物车进来的不再显示加购",()=>{
  const s=fs.readFileSync(__dirname+"/../js/screens.js","utf8");
  assert.equal((s.match(/setDetail\(Object\.assign\(\{\}, it, \{ _fromCart: true \}\)\)/g)||[]).length,2);
  assert.equal((s.match(/detail\._fromCart \? null : h\("button", \{ "data-wk": "shopdetailbtn"/g)||[]).length,2);
});
