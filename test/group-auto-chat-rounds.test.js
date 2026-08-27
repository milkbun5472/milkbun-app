const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scan = (() => {
  const i = app.indexOf("const scanAutoGroups = () => {");
  assert.ok(i > 0, "群自发巡检没了");
  return app.slice(i, app.indexOf("\n    };", i));
})();

// 她 2026-08-27：「群自发聊天他们主动发了一轮就不继续了，都没到设定的最大轮数或者次数」
// 病因是【每一轮】都要求有人此刻正想找她。认领动念的同时会给本人记 25 分钟冷却、
// 还泄掉 0.28 的 connection；自发间隔默认才 8 分钟——第二轮永远等不到人。
test("按真实数字算一遍：旧那道门第二轮根本过不去", () => {
  const FIRE_COOLDOWN_MIN = 25;              // jiwenFiredRef 的冷却
  const DEFAULT_GAP_MIN = 8;                 // gs.autoChatMin 默认
  const jitterMax = DEFAULT_GAP_MIN * 1.5;   // 代码里抖动 1~1.5×
  assert.ok(jitterMax < FIRE_COOLDOWN_MIN,
    "第二轮最晚 " + jitterMax + " 分钟就该来，可认领冷却要 " + FIRE_COOLDOWN_MIN + " 分钟");
});

test("动念只管起聊那一下，后面几轮不再要新的思念", () => {
  const i = scan.indexOf("let urgeChars = [];");
  assert.ok(i > 0, "urgeChars 的声明变了");
  const gate = scan.indexOf("if (rounds === 0) {", i);
  assert.ok(gate > i, "没有把动念这道门收进【第一轮】里");
  const seg = scan.slice(gate, gate + 1100);
  assert.match(seg, /if \(anyJiwen && !urgeChars\.length\) continue;/, "起聊仍要有人真想找她");
  assert.match(seg, /jiwenFiredRef\.current\[c\.id\] = now;/, "认领冷却要留在门里面");
  assert.match(seg, /applyDelta\(\{ connection: -0\.28 \}\)/, "泄思念也要留在门里面");
});

test("刹车还在：轮数上限、总条数上限、闲置间隔一个都不许少", () => {
  assert.match(scan, /const roundCap = Math\.max\(1, gs\.autoChatRounds \|\| 5\)/, "轮数上限没了");
  assert.match(scan, /const totalCap = Math\.max\(1, gs\.autoChatMaxMsg \|\| 50\)/, "总条数上限没了");
  assert.match(scan, /if \(rounds >= roundCap \|\| msgsSoFar >= totalCap\)/, "到顶不歇了");
  assert.match(scan, /if \(now - \(last\.ts \|\| 0\) < gap\) continue;/, "闲置间隔没了");
  // 上限判断必须排在动念那道门【之前】：先看额度够不够，再看有没有人想说话
  assert.ok(scan.indexOf("if (rounds >= roundCap") < scan.indexOf("let urgeChars = [];"), "顺序反了");
});

test("每一轮照旧记账，额度卡跨重开仍然有效", () => {
  assert.match(scan, /rounds: rounds \+ 1/, "轮数不加了");
  assert.match(app, /if \(rgOpts\.auto\) addAutoChatMessages\(groupId, safeArr\.length\)/, "条数不记了");
  assert.match(scan, /replyGroup\(gid, \{ auto: true, msgBudget: totalCap - msgsSoFar/, "剩余预算没往下传");
});

test("没配 jiwen 的群照旧纯闲置触发，一个字没变", () => {
  const gate = scan.indexOf("if (rounds === 0) {");
  const seg = scan.slice(gate, gate + 1100);
  assert.match(seg, /let anyJiwen = false;/, "没 jiwen 的群该直接放行");
});
