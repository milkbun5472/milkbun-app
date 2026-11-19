// 群里 2026-11-19 许愿：「角色把聊天记录截图发朋友圈」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
test("聊天里顺手发的朋友圈能配一张聊天记录截图：只认主聊天原话，房里不截，看的人知道截了什么", () => {
  const a = R("js/app.js"), c = R("js/components.js");
  assert.match(a, /momentChat:string\[\]=想给这条朋友圈配一张你俩聊天记录的截图/);
  assert.match(a, /const _mc = !sideRoom && Array\.isArray\(parsed\.momentChat\)/);
  assert.match(a, /if \(_mc\.length >= 2\) pMom\(/);
  assert.match(a, /配了一张跟" \+ m\.chatShot\.with \+ "的聊天记录截图/);
  assert.match(c, /function MomentChatShot\(\{ shot \}\)/);
  assert.equal((c.match(/h\(MomentChatShot, \{ shot: m\.chatShot \}\)/g) || []).length, 2);
  assert.match(R("js/theme-studio.js"), /\["momchatshot", /);
});
