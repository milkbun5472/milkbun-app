const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const gaze = fs.readFileSync(path.join(root, "js/gaze.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

const G = (() => {
  const store = {};
  const sb = {
    React: { useState: () => [] }, ReactDOM: { createPortal: () => null }, h: () => null,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    F_BODY: "", F_DISPLAY: "", window: {}
  };
  new Function(...Object.keys(sb), gaze)(...Object.values(sb));
  return sb.window.Gaze;
})();


test("每轮都可以写小认识：空卡、部分卡、满卡不等待轮数",()=>{
  G.apply("part","me","person","第一次认识");
  G.seed("full",{me:{person:"a",soft:"b",like:"c",recent:"d",unread:"e"},us:{what:"f",how:"g",marks:"h",elephant:"i",want:"j"}});
  for(const id of ["empty","part","full"]){
    const p=G.spec("阿棠",id);
    assert.match(p,/新的细节、对旧判断的小补充或修正都可以写/);
    assert.match(p,/空块可写相处中已经形成的认识/);
    assert.match(p,/没有新增或修正就省略 impression/);
    assert.match(p,/不需要重大事件或关系变化/);
    assert.doesNotMatch(p,/必须二选一|这一轮请复看这一块|极少发生|不许两个都省略/);
    assert.ok(G.nudge("阿棠",id));
  }
});
test("更新仍要求真实依据，保留旧认识，不制造内容",()=>{
  const p=G.spec("阿棠");
  assert.match(p,/每一句都得能落回某一次具体的对话/);
  assert.match(p,/已有块保留仍成立的内容/);
  assert.match(p,/不为填字段编事或随情绪翻转/);
  assert.match(p,/不必换词刷新日期/);
  assert.match(p,/一轮每位角色至多更新一块/);
});
test("四条写入路径共用轻量标准，保留隔离闸",()=>{
  assert.match(app,/window\.Gaze\.spec\("对方", charId, \{ tail: true \}\)/);
  assert.match(app,/oCtx\.gazeSpec = .*window\.Gaze\.spec\("对方", charId\)/);
  assert.match(app,/window\.Gaze && gs\.memoryInterop \?/);
  assert.match(app,/window\.Gaze\.updateRule\(userName\(profile\)\)/);
  assert.match(engine,/window\.Gaze\.updateRule\(userName\)/);
  assert.match(app,/if \(_roomCanWrite\("gaze"\) && window\.Gaze && !_s\.engineerEyes\)/);
  assert.match(app,/if \(!sideRoom && window\.Gaze && !settingsFor\(charId\)\.engineerEyes\)/);
  assert.doesNotMatch(app,/Gaze\.tick\(/);
  assert.doesNotMatch(engine,/impression 与 impressionChecked 必须二选一/);
});
test("可选提醒仍接在单聊任务尾部，字段说明不会丢",()=>{
  const task=app.slice(app.indexOf("const _normalTaskV2 = ("),app.indexOf("const _roomHint"));
  assert.ok(task.indexOf("_gazeNudgeHint")>task.indexOf("_turnClosing"));
  assert.match(G.spec("阿棠","part",{tail:true}),/impression:/);
  assert.doesNotMatch(G.spec("阿棠","part",{tail:true}),/【Ta 眼里】/);
});
test("聊够了还一块都没有，代码自己替他建一次卡；一个角色一辈子只这一次", () => {
  assert.equal(G.autoSeedDue("never"), true, "全空的卡该自动建一次");
  assert.equal(G.markAutoSeed("never"), true);
  assert.equal(G.autoSeedDue("never"), false, "标记之后还在建——每轮都会多花她一次钱");
  // 手动建过卡的、已经有块的，都不该再自动建
  G.seed("byhand", { me: { person: "她比看上去能扛" }, us: {} });
  assert.equal(G.autoSeedDue("byhand"), false);
});

test("接线：先记标记再打调用；线上线下两路都接上，且都有条数门槛", () => {
  assert.match(app, /if \(auto && window\.Gaze\.markAutoSeed\) window\.Gaze\.markAutoSeed\(char\.id\)/);
  assert.match(app, /先记标记再打调用/, "为什么要先记标记，写在代码里");
  // v62.35 从 10 抬到 30：十条≈五个来回，那时候他除了她自己写的设定没有别的材料，
  // 「你看出了什么」只能靠复述人设来答（她 2026-09-04 报的就是这个）。
  assert.match(app, /const GAZE_AUTOSEED_MSGS = 30/);
  assert.match(app, /if \(msgs\.length \+ \(Number\(extra\) \|\| 0\) < GAZE_AUTOSEED_MSGS\) return/);
  // 线上
  // ⚠️断言要跳过注释行：v63.51 在这两行之间加了一句解释，原来那个「紧挨着下一行」的
  //   正则当场红——它测的是「接线在不在」，不是「中间有没有注释」。
  const appCode = app.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(appCode.includes("try { maybeAutoSeedGaze(char); }"));
  // 线下：这一场的对话不在 chatsRef 里，只数线上会永远够不着门槛
  assert.match(app, /maybeAutoSeedGaze\(char, \(\(workSess && workSess\.msgs\) \|\| \[\]\)\.length\)/);
  // 言秋和 NPC 不参与
  assert.match(app, /if \(!char \|\| char\.npc \|\| !window\.Gaze \|\| !window\.Gaze\.autoSeedDue\) return/);
  assert.match(app, /if \(settingsFor\(char\.id\)\.engineerEyes\) return/);
  // 自动那一路失败不吵她（她没按过任何按钮），但必须留下败因——
  // v59.80 那版是「不吵也不记」，于是一次网络抖动就静悄悄烧掉这个角色仅有的机会
  // （她 2026-09-02：「另一个死活不填」）。重试上限由 Gaze.autoSeedDue 兜。
  {
    const seg = app.slice(app.indexOf("const seedGazeFor"), app.indexOf("const maybeAutoSeedGaze"));
    const rescue = seg.slice(seg.indexOf("} catch (e)"));
    assert.ok(/(?:!auto\)|else) toast\("建卡失败/.test(rescue), "只有她亲手按的那一路才弹 toast");
    assert.ok(/markAutoSeedFail\(char\.id/.test(rescue), "auto 失败要把败因写进卡里");
  }
});
