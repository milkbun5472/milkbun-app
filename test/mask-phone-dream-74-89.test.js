// 群里属数 2026-10-06：「梦境的创作小稿为什么是认成主面具的呀」「查手机时看见的微信聊天里也是主面具的欸」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const dream = fs.readFileSync(path.join(__dirname, "..", "js", "dream.js"), "utf8");
test("查手机：手机页和真聊天那份都认 TA 的那张面具", () => {
  assert.match(app, /profile: selPhone \? profileFor\(selPhone\) : profile,/);
  const i = app.indexOf("const phoneWechatActual = char => {");
  assert.match(app.slice(i, i + 200), /const meName = userName\(profileFor\(char\.id\)\);/);
});
test("梦境：做梦那个人认哪张面具，梦里的「你」就是哪张", () => {
  assert.match(app, /profileFor: profileFor,/);
  assert.match(dream, /function profOf\(props, cid\) \{ return \(props\.profileFor && cid \? props\.profileFor\(cid\) : props\.profile\) \|\| \{\}; \}/);
  assert.match(dream, /profile: profOf\(props, s\.charId\)/);
  assert.match(dream, /const uName = profOf\(props, charId\)\.name \|\| "我";/);
  assert.match(dream, /const uName = profOf\(props, c\.id\)\.name \|\| "我";/);
});
