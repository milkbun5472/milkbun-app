const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
const a=fs.readFileSync(__dirname+"/../js/app.js","utf8"),e=fs.readFileSync(__dirname+"/../js/engine.js","utf8");
test("专属表情包单独标出来，带包名",()=>{
  assert.ok(a.includes("【你的专属表情包】"));
  assert.ok(a.includes('!pk.global && (pk.charIds || []).includes(charId)'));
});
test("心情两处都带上「情绪怎么带出来照你这个人」",()=>{
  assert.equal((e.match(/\+ MOOD_HOW\)/g)||[]).length,2);
});
