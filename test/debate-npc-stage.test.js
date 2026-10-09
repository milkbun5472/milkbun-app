const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("擂台：配角能上台，场边名单照旧不收配角",()=>{
  const a=fs.readFileSync(__dirname+"/../js/app.js","utf8"),d=fs.readFileSync(__dirname+"/../js/debate.js","utf8");
  assert.ok(a.includes('stageNpcs: liveChars.flatMap(c => npcsOf(c.id)).concat(npcsOf("me")),'));
  assert.ok(d.includes("characters: stageChars"));
  assert.ok(d.includes("本来不认识 "));
});
