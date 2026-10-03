// 群友 2026-10-03：大富翁「页面不动了，但是其他按键可以点」——接话那枪卡住时 busy 永远不放
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const g = fs.readFileSync(path.join(__dirname, "..", "js/games.js"), "utf8");

test("大富翁有看门狗：busy 超过 60 秒自动放开", () => {
  const i = g.indexOf("function MonopolyGame(");
  const seg = g.slice(i, i + 20000);
  assert.match(seg, /useEffect\(function\(\)\{ if\(!busy\)return; const tm=setTimeout\(function\(\)\{setBusy\(false\);/);
  assert.match(seg, /\},60000\); return function\(\)\{clearTimeout\(tm\);\}; \},\[busy\]\);/);
});

test("接话没回来能「再试一次」：超时 50 秒算失败，留着那一批", () => {
  assert.match(g, /new Promise\(function\(_,no\)\{setTimeout\(function\(\)\{no\(new Error\("接话超时"\)\);\},50000\);\}\)\]\)/);
  assert.match(g, /catch\(e\)\{setTalkMiss\(\{batch:batch\}\);\}/);
  assert.match(g, /async function retryTalk\(\)\{if\(!talkMiss\|\|busy\)return;/);
  assert.match(g, /"角色没接上话 · 再试一次"/);
});
