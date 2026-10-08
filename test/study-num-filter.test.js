const test=require("node:test");const assert=require("node:assert/strict");const fs=require("fs");const path=require("path");
const src=fs.readFileSync(path.join(__dirname,"..","js","study.js"),"utf8");
const i=src.indexOf("function numFilterAsk"),j=src.indexOf("// 读她选的那个文件");
const MAT_CACHE={m1:"1. abandon^9 放弃\n2. deep^13 深的\n3. apple 苹果\nThe apple^3 is red.\n4. cat^8 猫\nbanana^2"};
const { numFilterAsk, numFilterText } = new Function("MAT_CACHE",src.slice(i,j)+"\nreturn { numFilterAsk, numFilterText };")(MAT_CACHE);
const cur={materials:[{id:"m1"}]};
test("按数字筛：全文里数，大于等于不漏",()=>{
  const ask=numFilterAsk("帮我找词频大于等于8的单词");
  assert.deepEqual(ask,{n:8,strict:false,bare:false});
  const t=numFilterText(cur,ask);
  assert.match(t,/abandon\(9\)、deep\(13\)、cat\(8\)/);
  assert.doesNotMatch(t,/banana|apple/);
});
test("没标数字的也算：只收每行打头的词",()=>{
  const ask=numFilterAsk("词频大于等于8的，没有标数字的也算");
  assert.equal(ask.bare,true);
  const t=numFilterText(cur,ask);
  assert.match(t,/没标数字的 1 个（每行打头那个词）：apple/);
});
test("不是按数字筛的话不插手",()=>{ assert.equal(numFilterAsk("讲讲 deep 怎么用"),null); });
