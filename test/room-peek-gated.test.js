const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("「你最近查过她的手机」过房间那道闸：关了别处发生的事就不带",()=>{
  const a=fs.readFileSync(__dirname+"/../js/app.js","utf8");
  // 后面还会接本轮刚发生的几句（改备注、照影做完/发卡）——那些是这一轮的事，不过闸；钉的只是查手机那句过闸
  assert.match(a, /const peekMemo = \(opts\.peekPhone \|\| !roomReads\("otherScenes"\) \? "" : peekMemoFor\(charId\)\) \+ remarkHint[ +\w]*;/);
});
