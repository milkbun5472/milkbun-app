const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("竞拍那一步 active 要重新赋值，不能是 const",()=>{
  const g=fs.readFileSync(__dirname+"/../js/games.js","utf8");
  const i=g.indexOf("async function decideAuctionRaw");const seg=g.slice(i,g.indexOf("\n",i));
  assert.ok(seg.includes("let active=(q.activeKeys||[]).slice();"));
  // 跑一遍：照这一行的写法 const 重新赋值会抛
  assert.ok(!/const q=pending[^;]*active=\(q\.activeKeys/.test(seg));
});
