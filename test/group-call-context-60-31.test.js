const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const gc = app.slice(app.indexOf("// 群通话：多角色你一言我一语"), app.indexOf("} catch (e) {\n      toast(\"通话回复失败"));

// 她 2026-09-02：「群电话怎么感觉吃不到时间线。我刚和顾暮说在家等他，
// 群聊通话他问我是不是在外面」。
// 病根还是「通话是第五处」：这几段原来只长在 replyGroup 里，
// 群通话每位成员只有一份人设——他不知道现在几点、不知道她刚在私聊里说过什么，只能瞎猜。

test("每人那一段【此刻】跟群聊共用一份，不是各写各的", () => {
  assert.match(app, /const groupNowSegs = \(c, opts\) => \{/);
  // v67.26：groupNowSegs 多收了一个 act（动描开着时也要把「上一动作」喂下去），
  //   钉的是【群聊那一处走的是这一份】，不是它当时收了几个参数。
  assert.match(app, /const _now = groupNowSegs\(c, \{ interop: gs\.memoryInterop[^)]*\}\);/, "群聊那一处");
  assert.match(gc, /const n = groupNowSegs\(c, \{ interop: gcInterop \}\);/, "群通话那一处");
  for (const field of ["live", "mdSeg", "afSeg", "ageSeg", "sbSeg", "cpSeg"]) assert.ok(gc.includes("+ n." + field), field + " 取了却没拼进去");
});

test("电话里也得知道现在几点", () => {
  assert.match(gc, /const gcClock = people\.filter\(c => !c\.npc && timeAwareFor\(c\.id\)\)/,
    "关了时间感知的角色不该按钟说话");
  assert.match(gc, /【此刻时间】现在是/);
  assert.match(gc, /gcTime \+ gcPrivBlock/, "算出来了却没拼进 sys");
});

test("实时私聊窗口：给，但照这个群自己的设置给", () => {
  // 她把某个群的私聊窗口关掉是有意的，电话里替她打开＝把私聊漏进群
  assert.match(gc, /const gcPrivN = cgs \? \(Number\(cgs\.privateCtxN\) \|\| 0\) : 6;/);
  assert.match(gc, /const gcInterop = !cur\.groupId \|\| !cgs \|\| cgs\.memoryInterop !== false;/);
  assert.match(gc, /memberPrivLines\(c, gcPrivN\)/);
  // 围栏一个字都不许少：这是 v55.89 顾朝读到裴照川私聊那次的教训
  assert.match(gc, /⚠️隐私边界铁律/);
  assert.match(gc, /只属于标注的那位成员本人/);
  assert.match(gc, /PRIVATE_IS_BACKGROUND_NOT_AMMO/);
  assert.match(gc, /〔以下只有 " \+ c\.name \+ " 本人知道，别的成员并不知情〕/);
});

test("配角照旧不吃这些层", () => {
  assert.match(gc, /if \(c\.npc\) return "【" \+ c\.name \+ "】" \+ groupPersonaText\(c\.persona, NPC_PERSONA_CAP\);/);
  assert.match(gc, /const gcMembers = people\.filter\(c => !c\.npc\);/);
  const start = gc.indexOf("const gcPriv = gcMembers.map(c => {");
  const end = gc.indexOf("const gcPrivBlock =", start);
  assert.ok(start >= 0 && end > start, "私有段必须只遍历去掉配角的名册");
  assert.match(gc.slice(start, end), /const lines = gcInterop \? memberPrivLines\(c, gcPrivN\) : "";/,
    "配角没有私聊，封闭群也不能读实时私聊");
});
