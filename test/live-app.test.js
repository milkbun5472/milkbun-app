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
  assert.match(A, /screen === "live" \|\| screen === "shua"\) \{/);
  assert.match(A, /runProbe\(apiFor\(char\.id\), ctxFor\(char\), \{ voiceScene: true, instruction, schemaHint, tag: "live" \}\)/);
  assert.match(A, /maxTokens: 12000, tag: "live"/);
  assert.match(L, /function watchInstruction\(/);
  assert.match(L, /function hostInstruction\(/);
});
test("入口、文件夹、脚本都挂上了", () => {
  // v74.99x 直播挪进刷刷当一格：主屏上只剩刷刷，原来放过直播的原位换掉
  assert.match(C, /shua: \{ kind: "app", zh: "片刻", G: window\.GShua \|\| GDebate \}/);
  assert.match(C, /swapAppOnce\(st, "live", "shua", "x_shuaSwapped"\)/);
  assert.match(C, /placeNewAppOnce\(st, "shua", "theater", "x_shuaPlaced"\)/);
  assert.match(I, /<script src="js\/shua\.js\?v=/);
  assert.match(I, /<script src="js\/live\.js\?v=/);
  assert.match(R("js/engine.js"), /"x_live",/);
});

test("回放能发回聊天：走公共那条转发卡，不让TA当场开口", () => {
  assert.match(C, /if \(kind === "liveshare"\) return window\.LiveShareCard \|\| null;/);
  assert.match(L, /window\.LiveShareCard = LiveShareCard;/);
  assert.match(A, /kind: "liveshare", live: snap, content: K\.shareText\(snap, userName\(profile\), c\.name\), ts: Date\.now\(\), read: true \}/);
  assert.match(L, /直播间里那个「" \+ snap\.maskName \+ "」就是她/);
});
