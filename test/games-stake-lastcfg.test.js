// 小游戏彩头 + 上次那桌（她 2026-10-11「都可以做」第二批）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const R = f => fs.readFileSync(require.resolve("../js/" + f), "utf8");
const g = R("games.js"), app = R("app.js"), cmp = R("components.js");

test("开局页能写彩头、能照上次那桌摆；开局时记下这一桌", () => {
  assert.match(g, /const LAST_CFG_KEY = "x_gameLastCfg";/);
  assert.match(g, /last\[game\.key\] = config; saveJSON\(LAST_CFG_KEY, last\);/);
  assert.match(g, /"data-wk": "gamelastcfg", onClick: useLast/);
  assert.match(g, /stake: stake\.trim\(\) \|\| undefined \}\); \},/);
  assert.match(g, /"data-wk": "gamestake"/);
});
test("终局按输赢写清谁该兑现；战报里从 TA 那边看谁欠谁", () => {
  assert.match(g, /const stake = String\(\(host\.config && host\.config\.stake\) \|\| ""\)\.trim\(\);/);
  assert.match(g, /"data-wk": "gamestakeend"/);
  assert.match(app, /const owes = !rep\.stake \? "" : !taWin && rep\.meWin !== false \? "ta" : taWin && rep\.meWin === false \? "me" : "";/);
  assert.match(app, /开局说好的彩头：/);
  assert.match(cmp, /g\.owes === "ta" \? " · 你欠我的"/);
});
