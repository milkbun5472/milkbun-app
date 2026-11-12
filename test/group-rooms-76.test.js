// 群里的小房间（她 2026-11-13「群聊咋开房间」「弄一下吧」）：房间就是一个带 roomOf 的普通群
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = read("js/app.js"), comp = read("js/components.js"), studio = read("js/theme-studio.js"), manual = read("js/assistant-manual.js");
const fnBody = (src, head) => { const i = src.indexOf(head); assert.ok(i >= 0, "缺 " + head); return src.slice(i, i + 2500); };

test("开房间：照主群抄一份，挂 roomOf，两种走同一个群设置写入口", () => {
  const b = fnBody(app, "const createGroupRoom = ");
  assert.match(b, /roomOf: parent\.id/);
  assert.match(b, /saveGroupSettingsRaw\(g\.id/);
  assert.match(b, /memoryInterop: kind === "closed" \|\| par \? false/);
  assert.match(app, /onNewRoom: \(name, kind\) => createGroupRoom\(/);
  assert.match(app, /onSwitchRoom: id =>/);
});

test("聊天列表和群聊列表不单独列房间，未读算进主群那行", () => {
  assert.match(comp, /groups\.filter\(g => !g\.roomOf\)\.map\(g =>/);
  assert.match(comp, /\(groups \|\| \[\]\)\.filter\(g => !g\.roomOf\)\.map\(g => h\("button"/);
  assert.match(fnBody(comp, "const renderGroupRow = "), /r\.roomOf === g\.id/);
});

test("删主群连房间一起删，确认框说有几间", () => {
  const b = fnBody(app, "const deleteGroup = ");
  assert.match(b, /g\.roomOf === groupId/);
  assert.match(comp, /间小房间也一起删掉/);
});

test("小房间的挂点都登记进美化工作室", () => {
  ["groomstrip", "groomchip", "groomnew", "groomform", "groomname", "groomkind", "groomopen", "groomentry", "groomtag"].forEach(wk => {
    assert.ok(comp.includes('"' + wk + '"'), "components 缺 " + wk);
    assert.ok(studio.includes('["' + wk + '"'), "theme-studio 没登记 " + wk);
  });
});

test("攻略讲的是现在有小房间", () => {
  assert.ok(manual.includes("### 群聊里的小房间"));
  assert.ok(!manual.includes("没有，小房间只在单聊里"));
});

// 平行世界房间（她 2026-11-13「加吧」）：人设、世界书、面具照旧，主线一概不带进来、也不带出去
const sliceFn = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); assert.ok(i > 0 && j > i, "抠不出 " + a); return src.slice(i, j); };

test("平行世界：createGroupRoom 在群上挂 parallel、互通关、修罗场关", () => {
  const b = fnBody(app, "const createGroupRoom = ");
  assert.match(b, /const par = kind === "parallel"/);
  assert.match(b, /\.\.\.\(par \? \{ parallel: true \} : \{\}\)/);
  assert.match(b, /\.\.\.\(par \? \{ drama: false \} : \{\}\)/);
  assert.match(b, /groupsRef\.current = /);
});

test("平行世界：判据只有 groupParallel 一处，记忆召回和关系线各走一份公共的", () => {
  assert.match(app, /const groupParallel = gid => !!gid && !!\(\(groupsRef\.current/);
  assert.match(app, /const groupMemSplit = \(gid, ids, text, opts\) => groupParallel\(gid\) \? \{ shared: \[\], perChar: \{\} \} : splitGroupMemories\(/);
  assert.match(app, /const groupRelLines = \(gid, people, me\) => \(groupParallel\(gid\)/);
  // 群里不许再有直接召记忆库的：群线上／投票／群通话／群线下全走 groupMemSplit
  assert.strictEqual((app.match(/splitGroupMemories\(memLibRef\.current/g) || []).length, 1);   // 只剩 groupMemSplit 里那一处
  assert.strictEqual((app.match(/groupMemSplit\(/g) || []).length, 4);   // 群线上／投票／群通话／群线下
  assert.strictEqual((app.match(/groupRelLines\(/g) || []).length, 2);   // 群线上／群通话（群线下走 ctx.rels）
});

test("平行世界：共用的三层（背景／此刻／私下往来）都认 parallel，三条群路都按 groupParallel 递进去", () => {
  assert.match(app, /const groupParallelBackground = b => \(\{ sleep:/);
  const now = sliceFn(app, "const groupNowSegs = ", "const memberPrivLines = ");
  assert.match(now, /if \(o\.parallel\) return \{/);
  assert.match(now, /groupParallelBackground\(groupBackgroundFor\(c\)\)/);
  assert.match(sliceFn(app, "const memberPrivateContextFor = ", "const offBeats = "), /if \(opts && opts\.parallel\) return "";/);
  assert.match(app, /groupNowSegs\(c, \{ interop: gs\.memoryInterop, act: !!gs\.actDesc, drama: !!gs\.drama, parallel: _gPar \}\)/);
  assert.match(app, /groupNowSegs\(c, \{ interop: gsp\.memoryInterop, parallel: groupParallel\(groupId\) \}\)/);
  assert.match(app, /groupNowSegs\(c, \{ interop: gcInterop, parallel: gcPar \}\)/);
  assert.match(app, /groupId: group\.id, parallel: _gPar \}\)/);
  assert.match(app, /groupId: cur\.groupId, parallel: gcPar \}\)/);
  assert.match(app, /const privateText = \[groupParallel\(groupId\) \? "" : memories\[c\.id\]/);
});

test("平行世界：群线下 ctx 主线那几层都掐掉", () => {
  const b = sliceFn(app, "const ctxForGroupOffline = ", "const pGOffline = ");
  assert.match(b, /_par \? groupParallelBackground\(b\) : b/);
  assert.match(b, /const _par = groupParallel\(group\.id\)/);
  ["rels: _par ? {} : rels", "memberGaze: _par ? {} :", "memberRecent: _par ? [] :", "wishLog: _par ? \"\" :", "groupSpectating(group) || _par"].forEach(k => assert.ok(b.includes(k), "群线下缺 " + k));
  assert.ok((b.match(/if \(_par\) return m;/g) || []).length >= 4, "心情／好感／行程／关系四样要掐");
});

test("平行世界：群线上和群通话那几处单独的主线层也掐", () => {
  assert.match(app, /const _gPar = groupParallel\(groupId\)/);
  assert.match(app, /_preJoinN > 0 && !gs\.memoryInterop && !_gPar/);
  assert.match(app, /const said = _gPar \? "" : crossChannelSaid\(/);
  assert.match(app, /const _gOutside = _gPar \? \[\] :/);
  assert.match(app, /const _gOnMe = _gPar \? "" : onMeFor\(\)/);
  assert.match(app, /const gcPar = groupParallel\(cur\.groupId\)/);
  assert.match(app, /const gcOnMe = gcPar \? "" : onMeFor\(\)/);
});

test("平行世界：新开小表有第三项、房间上挂「平行」、群设置不给开互通", () => {
  assert.match(comp, /\["parallel", "平行世界", "/);
  assert.match(comp, /r\.parallel \? "平行" : ""/);
  assert.match(comp, /group && group\.parallel \? h\("div"/);
  assert.ok(manual.includes("**平行世界**"));
});
