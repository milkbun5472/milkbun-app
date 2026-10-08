const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("「你最近查过她的手机」过房间那道闸：关了别处发生的事就不带",()=>{
  const a=fs.readFileSync(__dirname+"/../js/app.js","utf8");
  assert.ok(a.includes('const peekMemo = (opts.peekPhone || !roomReads("otherScenes") ? "" : peekMemoFor(charId)) + remarkHint;'));
});
