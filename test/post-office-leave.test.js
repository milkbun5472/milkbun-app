// 从小世界邮局退出会卡死回到开屏（她 2026-11-24）：先拆邮局的 3D、iframe 换空页，等一下再走
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const fg = fs.readFileSync(path.join(__dirname, "..", "js", "fairy-garden.js"), "utf8");
const game = fs.readFileSync(path.join(__dirname, "..", "apps", "post-office", "game.mjs"), "utf8");
test("邮局把 dispose 交出来", () => { assert.match(game, /window\.PostOfficeGame=\{dispose,refresh,/); });
test("返回和去别处都先 leave", () => {
  assert.match(fg, /PostOfficeGame\?\.dispose\?\.\(\);\}catch\{\}\s*try\{if\(node\)node\.src="about:blank";\}catch\{\}\s*setTimeout\(/);
  assert.match(fg, /onBack:\(\)=>leave\(\(\)=>props\.onBack\(\)\)/);
  assert.match(fg, /leave\(\(\)=>props\.onTravel\(to\)\)/);
});
