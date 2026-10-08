const test=require("node:test");const assert=require("node:assert/strict");const fs=require("fs");const path=require("path");
const eng=fs.readFileSync(path.join(__dirname,"..","js","engine.js"),"utf8");
const i=eng.indexOf("const LORE_TOPIC_MARK"),j=eng.indexOf("function loreDoNow(",i);
const { loreText, loreSplit } = new Function("selectLore",eng.slice(i,j)+"\nreturn { loreText, loreSplit };")(x=>x);
test("常驻排前、按话题翻的排后，拆得回两半",()=>{
  const out=loreText([{title:"港口",payload:"宵禁",keyword:"港口"},{title:"说话",payload:"他说话慢",alwaysOn:true}]);
  assert.ok(out.indexOf("他说话慢")<out.indexOf("宵禁"));
  const sp=loreSplit(out);
  assert.equal(sp.always,"〔说话〕他说话慢");assert.equal(sp.topic,"〔港口〕宵禁");
  assert.deepEqual(loreSplit("〔说话〕他说话慢"),{always:"〔说话〕他说话慢",topic:""});
  const onlyTopic=loreSplit(loreText([{title:"港口",payload:"宵禁",keyword:"港口"}]));
  assert.equal(onlyTopic.always,"");assert.equal(onlyTopic.topic,"〔港口〕宵禁");
});
test("单聊那份：常驻紧跟人设，按话题翻的留在近况那段",()=>{
  const b=eng.slice(eng.indexOf("function buildBundle"));
  const g=b.indexOf("parts.push(grownSelfBlock(ctx.personaGrown"),a=b.indexOf("【世界书 · 常驻设定】"),t=b.indexOf("【世界书 · 这一轮聊到的】"),time=b.indexOf("parts.push(...timeBlock)");
  assert.ok(g>0&&a>g&&a<time&&t>time);
});
