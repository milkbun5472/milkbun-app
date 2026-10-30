const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
const a=fs.readFileSync(__dirname+"/../js/app.js","utf8"),e=fs.readFileSync(__dirname+"/../js/engine.js","utf8");
test("专属表情包单独标出来，带包名",()=>{
  assert.ok(a.includes("【你的专属表情包】"));
  // 2026-10-30：她自己那一套（__me:）不算进他的专属，中间多了一道
  assert.ok(a.includes('!pk.global && String(pk.fromCharFace || "").indexOf("__me:") !== 0 && (pk.charIds || []).includes(charId)'));
});
test("心情两处都带上「情绪怎么带出来照你这个人」",()=>{
  assert.equal((e.match(/\+ MOOD_HOW\)/g)||[]).length,2);
});

// 她 2026-10-17：「他们太过于强调用的是他们的表情包了，基本上每次都要提」
require("node:test")("专属表情包：认得出、直接发，别每次在话里提是自己的", () => {
  const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
  // v76.292 起改成正面说法（「话里不用提…她问起或者正聊到这件事才说」）
  require("node:assert/strict").match(app, /发的时候直接发，跟发别的表情一样，话里不用提「这是我的表情包」/);
});
