// 配角按面具归属（她 2026-10-22：「按面具编 npc 呢」）。
//   在这之前关系页的面具筛子问的是 chatSettings[配角].maskId——可配角不单聊、压根没有聊天设置，
//   于是每个配角都算主面具：切到副面具那一档，整排配角都被滤掉。
//   现在配角问它的户口要：在谁身边就跟谁那张脸；她自己身边的人记在 maskId 上（建它时筛子挑的那张）。
//   ⚠️关系网仍然只存一份（2026-10-03 定的「面具给的是怎么看，不是存几份」）：这儿给的只是归属。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = R("js/app.js"), sui = R("js/screens-ui.js");

test("配角的面具跟着户口走：在谁身边就跟谁，自己身边的看 maskId", () => {
  const i = app.indexOf("    maskOf: charId => {");
  assert.ok(i > 0, "关系页那个 maskOf 不是现在这一支了");
  const seg = app.slice(i, app.indexOf("\n    },", i));
  // 真跑：角色甲认副面具 m1；配角 n1 在甲身边；配角 n2 是她自己身边的、记着 m2
  const chars = [{ id: "c1" }, { id: "n1", npc: true, ownerId: "c1" }, { id: "n2", npc: true, ownerId: "me", maskId: "m2" },
    { id: "n3", npc: true, ownerId: "me" }];
  const settings = { c1: { maskId: "m1" }, c9: { maskId: "m9" } };
  const maskOf = new Function("charactersRef", "characters", "settingsFor",
    "return (" + seg.slice(seg.indexOf("charId =>")) + "});")(
    { current: chars }, chars, id => settings[id] || {});
  assert.equal(maskOf("n1"), "m1", "在甲身边的配角没跟着甲那张脸");
  assert.equal(maskOf("n2"), "m2", "她自己身边的人没认自己记下的那张");
  assert.equal(maskOf("n3"), "", "没记过的照旧算主面具");
  assert.equal(maskOf("c9"), "m9", "正式角色那一支被改坏了");
});

test("建「我身边的人」时把筛子那张面具记下来；在角色身边的不另记", () => {
  assert.match(sui, /maskPick: maskPick,/, "筛子那张没传进去");
  assert.match(sui, /onAddMyNpc\(c\.npcName, c\.npcBrief, c\.npcRel, c\.meChar, pickedMask\)/);
  assert.match(app, /const addMyNpc = \(name, brief, relLabel, hostId, maskId\) =>/);
  assert.match(app, /owner === "me" && maskId \? \{ maskId: String\(maskId\) \} : \{\},/, "在角色身边的也记了一份，两处会打架");
});

// 她 2026-10-22 第二轮：「还是没有啊」——上一版只是闷头记下筛子当前那张，建的时候表单上看不见、也挑不了。
//   现在「算在谁身边＝我」那张手写表单上多一栏「算谁认识的人」：默认跟筛子，可当场改。
test("表单上有一栏看得见的「算谁认识的人」，只给自己身边的人，默认跟筛子", () => {
  const i = sui.indexOf('"data-wk": "tiesnpcmask"');
  assert.ok(i > 0, "表单上没有这一栏");
  const seg = sui.slice(Math.max(0, i - 700), i + 1400);
  assert.match(seg, /c\.meChar === "me" && \(masks \|\| \[\]\)\.some/, "在角色身边的也给挑了，会跟主人那张脸打架");
  assert.match(seg, /\[\["", "谁都看得见"\]\]\.concat/, "少了「谁都看得见」那一档");
  assert.match(seg, /c\.npcMask === undefined \? \(maskPick && maskPick !== "_main" \? maskPick : ""\) : c\.npcMask/, "没碰过这一栏时该跟着筛子");
  assert.match(sui, /const pickedMask = c\.npcMask === undefined \? \(maskPick && maskPick !== "_main" \? maskPick : ""\) : c\.npcMask;/);
  assert.match(sui, /onAddMyNpc\(c\.npcName, c\.npcBrief, c\.npcRel, c\.meChar, pickedMask\)/, "加进来那颗没照这一栏走");
  // 挑完得能收回去：下一个人别还挂着上一个挑的那张
  assert.match(sui, /set\(\{ npcName: "", npcBrief: "", npcRel: "", npcMask: undefined \}\)/, "建完没把这一栏复位");
  // 名单和主面具得传进表单，不然这一栏画不出来
  assert.match(sui, /maskPick: maskPick, masks: masks, maskPrimary: maskPrimary,/);
  assert.match(sui, /function RelComposer\(\{ comp, setComp, characters, profile, draftProfile, maskPick, masks, maskPrimary,/);
});
