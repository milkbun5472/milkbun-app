const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("擂台：配角能上台，场边名单照旧不收配角",()=>{
  const a=fs.readFileSync(__dirname+"/../js/app.js","utf8"),d=fs.readFileSync(__dirname+"/../js/debate.js","utf8");
  assert.ok(a.includes('stageNpcs: liveChars.flatMap(c => npcsOf(c.id)).concat(npcsOf("me")),'));
  assert.ok(d.includes("characters: stageChars"));
  assert.ok(d.includes("本来不认识 "));
});

// 裁判和台下也能挑配角（她 2026-10-10）
test("裁判和台下的候选里接上了配角；只有挑过才坐，老存档照旧", () => {
  const src = require("node:fs").readFileSync(require.resolve("../js/debate.js"), "utf8");
  assert.match(src, /const seatPool = \(props\.crowdChars \|\| \[\]\)\.concat\(\(props\.seatNpcs \|\| \[\]\)/);
  assert.match(src, /const benchPool = seatPool\.filter/);
  assert.match(src, /const judgePool = \(props\.crowdChars \? seatPool/);
  assert.match(src, /concat\(Array\.isArray\(s\.benchIds\) \? \(props\.seatNpcs \|\| \[\]\)/);
  assert.equal((src.match(/seatNpcs: props\.stageNpcs/g) || []).length, 2, "摆台子和开打两处都要拿到配角名单");
});
