const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
const e=fs.readFileSync(__dirname+"/../js/engine.js","utf8");
test("最高准则里有：碰上真难处把理由和办法说完整，别丢半截谜语",()=>{
  const i=e.indexOf("const ANTI_CLICHE = `");const blk=e.slice(i,e.indexOf("`;",i));
  assert.ok(blk.includes("留白是给情绪的，不是给道理的"));
});
