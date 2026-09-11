const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

// 她 2026-08-28：「线下也接了 Ta 眼中那一堆是吧？完全不写啊」。
// 又是「这一层只写在一处」：线下【读】得到印象卡（buildBundle 会发 ctx.gazeText），
// 但四处里只有单聊线上收到过【写】的指令，线下泡多久这张卡都不动。
// 线上线下都允许省略；明确回执仍兼容。

const singleOffline = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)[0];
const groupOffline = engine.match(/async function generateOfflineGroup\([\s\S]*?async function summarizeOfflineGroup/)[0];

test("单聊线下要发【写】指令，而且是和线上同一份 Gaze.spec", () => {
  assert.match(app, /oCtx\.gazeSpec = \(!sideRoom && !settingsFor\(charId\)\.engineerEyes && window\.Gaze\) \? window\.Gaze\.spec\("对方", charId\) : ""/,
    "主线线下继续写同一份 Gaze，侧房必须隔离人格成长");
  assert.match(singleOffline, /const gazeSpecBlock = \(!isDigital && ctx\.gazeSpec/, "数字生命不发扮演类规则");
  assert.match(singleOffline, /outputSpec \+ stateBootstrapHint \+ gazeSpecBlock/, "拼进去了才算发，声明一次不算");
  assert.match(singleOffline, /impressionChecked/, "「看过了不用改」这条路线下也得有，否则同一块会被问到天荒地老");
});

test("单聊线下要把 impression / impressionChecked 带回来", () => {
  assert.match(singleOffline, /impression: \(parsed\.impression && typeof parsed\.impression === "object"\) \? parsed\.impression : null/);
  assert.match(singleOffline, /impressionChecked: cln\(parsed\.impressionChecked\)/);
});

test("单聊线下按需写入，省略不计漏答", () => {
  const blk = app.slice(app.indexOf("// 线下使用同样的按需写入"), app.indexOf("// 线下也更新状态卡的动作/穿着"));
  assert.match(blk, /window\.Gaze && !settingsFor\(charId\)\.engineerEyes/, "言秋不塑形");
  assert.match(blk, /window\.Gaze\.applyParsed\(charId, res\.impression\)/);
  assert.match(blk, /window\.Gaze\.markChecked\(charId, _offCk\)/);
  assert.doesNotMatch(blk, /Gaze\.tick/);
});

test("群线下也接上，但闭群只进不出、配角没有印象卡", () => {
  assert.match(groupOffline, /\\"impression\\":\\"（仅角色 beat，可选）/, "beat 形状里要有这一格");
  assert.match(groupOffline, /impression: \(spk && b\.impression && typeof b\.impression === "object"\) \? b\.impression : null/);
  assert.match(app, /if \(!gOffSealed && !_bNpc && b\.senderId && b\.impression && window\.Gaze && !settingsFor\(b\.senderId\)\.engineerEyes\)/);
});
