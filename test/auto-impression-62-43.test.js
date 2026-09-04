// v62.43 月度印象自动出卡 + 周刊按角色「记录喂不喂」（她 2026-09-04 点单）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const weekly = fs.readFileSync(path.join(__dirname, "..", "js", "weekly.js"), "utf8");
const policy = fs.readFileSync(path.join(__dirname, "..", "js", "auto-refresh-policy.js"), "utf8");

test("政策表有 impression 一项（总开关+按角色）", () => {
  assert.match(policy, /id: "impression", group: "content", title: "月度印象"/);
});

test("月度印象自动出卡挂进 wakeSweeps，闸齐全：run 锁 / offlineActive / 总开关 / 按角色 / 已写过的月份跳过", () => {
  const seg = app.slice(app.indexOf("const autoImpressionSweep"), app.indexOf("const wakeSweeps"));
  assert.match(seg, /autoRefreshOn\("impression"\)/);
  assert.match(seg, /autoRefreshOn\("impression", c\.id\)/);
  assert.match(seg, /some\(x => x\.monthKey === monthKey\)/);
  assert.match(seg, /rows\.length < 6/);
  assert.match(app, /desireTendAllToday, phoneWeeklySweep, autoImpressionSweep\]/);
});

test("周刊素材三处全按「喂不喂」名单取，展示仍用全量", () => {
  assert.equal((weekly.match(/props\.autoCharacters \|\| props\.characters \|\| \[\]/g) || []).length >= 6, true);
  assert.match(weekly, /喂不喂进周刊/);
});
