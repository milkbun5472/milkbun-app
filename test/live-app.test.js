// 直播（群友 2026-10-07，她拍板「1c 2b」：两种都要；弹幕只当背景，不进上下文）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const L = R("js/live.js"), A = R("js/app.js"), C = R("js/components.js"), I = R("index.html");

test("路人弹幕不进给模型看的那一段", () => {
  const i = L.indexOf("function transcript(");
  const body = L.slice(i, L.indexOf("\n  }\n", i));
  assert.ok(body.indexOf("noise") < 0, "transcript 里读了 noise");
});
test("两种都接上了：看 TA 播走 runProbe，我来播一枪写完", () => {
  assert.match(A, /screen === "live"\) body = window\.LiveApp \? h\(window\.LiveApp,/);
  assert.match(A, /runProbe\(apiFor\(char\.id\), ctxFor\(char\), \{ voiceScene: true, instruction, schemaHint, tag: "live" \}\)/);
  assert.match(A, /maxTokens: 12000, tag: "live"/);
  assert.match(L, /function watchInstruction\(/);
  assert.match(L, /function hostInstruction\(/);
});
test("入口、文件夹、脚本都挂上了", () => {
  assert.match(C, /live: \{ kind: "app", zh: "直播", G: window\.GLive \|\| GDebate \}/);
  assert.match(C, /placeNewAppOnce\(st, "live", "theater", "x_livePlaced"\)/);
  assert.match(I, /<script src="js\/live\.js\?v=/);
  assert.match(R("js/engine.js"), /"x_live",/);
});
