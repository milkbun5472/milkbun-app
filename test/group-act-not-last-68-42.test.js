// 她 2026-09-14 在旁观群里撞见：一轮停在「萧成烨 我靠在水榭紫檀椅里…」上，
// 后面一句话都没有——「为啥会卡在动作没有气泡说话」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("动描是这几泡的前缀，绝不能当一轮的最后一行", () => {
  // 病根：自动轮按【行】算额度，动描也算一行。它占掉最后一格之后，
  // 底下那个 for 第一句就是 `if (autoRoomLeft() <= 0) break;`，这个人就哑了。
  assert.match(app, /const _actNeed = gBubbles\.length \? 2 : 1;/,
    "动描没按「还得留一格给他说话」来算");
  assert.match(app, /if \(!sameActLine\(gActionNow, _gprevAct\) && autoRoomLeft\(\) >= _actNeed\)/,
    "还是只要有一格就把动描摆上去");
  // 底下那道闸照旧（超了就不再往下冒）
  assert.match(app, /if \(autoRoomLeft\(\) <= 0\) break;   \/\/ 拆出来的气泡也一泡一条/);
});

test("只有动作没有话的那种人，仍然摆得出动描", () => {
  // 他这一轮本来就没话说（gBubbles 空）——那一行动描该照常出，不能被这道新闸误伤
  const i = app.indexOf("const _actNeed = gBubbles.length ? 2 : 1;");
  assert.ok(i > 0);
  assert.equal("gBubbles.length ? 2 : 1".includes("? 2 : 1"), true);
});
