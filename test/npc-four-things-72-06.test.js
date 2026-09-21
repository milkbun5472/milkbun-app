// 配角那四样（她 2026-09-20：「就心情想法穿着动作这四样放 npc 状态卡」）
//
// 起因：「有人反馈说觉得群聊不是很活人」→「就是她说角色和 npc 他的好兄弟们的互动差点意思」。
// 查下来配角在群里是一张纸片：900 字人设 + 一行户口，连「此刻」都没有，
// 只能对着屏幕上最后几句话反应。而 wearing/action/thought 其实【一直在写】他的状态卡，
// 从来没有被喂回去过——写了没人读，正是 v55.95 那个形状的镜像版。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js", "components.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js", "engine.js"), "utf8");

test("只有那四样：好感、印象卡、年龄生日、行程一律不给配角", () => {
  const i = app.indexOf("  const groupNowSegs = (c, opts) => {");
  const j = app.indexOf("  const memberPrivLines =", i);
  assert.ok(i > 0 && j > i, "抠不出 groupNowSegs");
  const npcBranch = app.slice(app.indexOf("if (c.npc) {", i), app.indexOf("const st = statesRef.current[c.id]", i));
  assert.match(npcBranch, /liveStateContext\(st0, \["wearing", "action", "thought"\]\)/);
  assert.match(npcBranch, /〔此刻心情〕/);
  assert.doesNotMatch(npcBranch, /affOf|ageLineFor|schedBriefFor|relationshipLineFor|groupBackgroundSegments/,
    "配角多长出了不该有的层");
});

test("不看记忆互通那个开关：闭群里的好兄弟也有情绪", () => {
  // 写：群线上 / 群线下 / 群通话三处都不被闭群那道闸挡住
  assert.match(app, /if \(gs\.memoryInterop \|\| _npcSpk\) \{/, "群线上");
  assert.match(app, /if \(\(!gOffSealed \|\| _bNpc\) && b\.senderId && b\.mood/, "群线下·心情");
  assert.match(app, /if \(!gOffSealed \|\| _bNpc\) writeGroupLiveState/, "群线下·状态卡");
  assert.match(app, /callCanWriteMain\(cur, "state"\) \|\| !!isNpc/, "群通话");
  // 要：闭群里有配角时，输出契约里得真的问他要这四样
  assert.match(app, /const npcStateHint = \(!gs\.memoryInterop && _gHasNpc\)/);
  ["thought", "mood", "wearing", "action"].forEach(k =>
    assert.ok(app.indexOf("\\\"" + k + "\\\"") > 0, "契约里少了 " + k));
});

test("好感和印象卡照旧不给配角（她 2026-08-25 拍的板，这次没动）", () => {
  assert.match(app, /if \(spk && !_npcSpk\) bumpAff/);
  assert.match(app, /if \(spk && !_npcSpk && item\.impression && window\.Gaze/);
  assert.match(app, /gazeOn: .*&& !scc\.npc,/);
  assert.match(comp, /const scale = \(?isNpc[^:]{0,24}\? null :/, "好感那颗心不许摆给配角");
});

test("这四样她看得见：闭群里配角的头像也点得开", () => {
  assert.match(comp, /const canPeek = onOpenMemberState && \(c => gsp\.memoryInterop \|\| !!\(c && c\.npc\)\)/, "群线上");
  assert.match(app, /if \(!c \|\| \(!gsFor\(offlineGroup\.id\)\.memoryInterop && !c\.npc\)\) return;/, "群线下");
});

test("人设额度：配角 3000，仍旧不参与按人数平分", () => {
  assert.match(engine, /const NPC_PERSONA_CAP = 3000;/);
  const budget = new Function(
    engine.match(/^const GROUP_PERSONA_BUDGET = .*$/m)[0]
    + engine.slice(engine.indexOf("function groupPersonaBudget("), engine.indexOf("// 群文字、群通话、群线下的六层背景"))
    + "\nreturn groupPersonaBudget;")();
  assert.equal(budget(5), 10000, "五人以内照旧不砍");
  assert.equal(budget(10), 5000);
  assert.equal(budget(40), 2500, "地板");
});
