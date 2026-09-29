// 设定不演成标签（她 2026-09-29）：房间/小剧场/同人加笔的设定走同一个 sceneSettingBlock，
// 放在人设旁边当背景，而不是压在任务尾巴上标「优先级最高」。判断句不许带内容样例。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const eng = R("js/engine.js"), app = R("js/app.js"), rooms = R("js/chat-rooms.js"), th = R("js/theater.js"), ff = R("js/fanfic.js");

test("公共判断句存在且不带内容样例", () => {
  const m = eng.match(/const SETTING_AS_BACKGROUND = [\s\S]*?;\n/)[0];
  assert.doesNotMatch(m, /暴躁|大兵|上司|比如|例如/);
  assert.match(eng, /function sceneSettingBlock\(title, text, extra\)/);
});
test("buildBundle 把 sceneSetting 紧跟人设放", () => {
  const a = eng.indexOf('parts.push("【角色人设】'), b = eng.indexOf("if (ctx.sceneSetting) parts.push(ctx.sceneSetting);");
  assert.ok(a > 0 && b > a && b - a < 600, "底子要挨着人设");
});
test("房间线上/线下两条路都挂上 sceneSetting", () => {
  assert.match(app, /gated\.sceneSetting = window\.ChatRooms && window\.ChatRooms\.scenarioSetting/);
  assert.match(app, /oCtx\.sceneSetting = window\.ChatRooms && window\.ChatRooms\.scenarioSetting/);
  assert.match(rooms, /"roomPrompt", "sceneSetting"/);
  assert.doesNotMatch(rooms.split("\n").filter(l => !l.trim().startsWith("//")).join("\n"), /本房内优先级最高/);
});
test("小剧场与同人加笔走同一个块", () => {
  assert.match(th, /sceneSettingBlock\("这条 if 线的设定"/);
  assert.match(ff, /sceneSettingBlock\("世界观：" \+ tab\.name, tab\.desc\)/);
});
