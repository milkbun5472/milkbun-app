const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const live = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const menu = comp.slice(comp.indexOf("function MsgMenu("), comp.indexOf("// ---- state card:"));

// 她 2026-09-02：「这块样式也是参考别人的也改改」＋「再加一个可以气泡转语音，
// 这样就算不是语音条也可以听」。
// 原来这一列是【大号英文衬线 + 右边一个小号中文】：Copy 复制 / Save 收藏 / Edit 编辑…
// 那两栏一模一样的中英对照，换个 app 照样成立——没有从「这是一句谁说过的话」里长出来。

test("中英对照那一套整套删掉", () => {
  ["\"Copy\"", "\"Save\"", "\"Edit\"", "\"Quote\"", "\"Select\"", "\"Recall\"", "\"Reroll\""]
    .forEach(x => assert.ok(live.indexOf(x) < 0, "英文那一栏还在：" + x));
  assert.ok(!/\}, en\)/.test(menu), "还在把英文当主标题渲染");
});

test("按「这个动作对这句话做了什么」分组，不是一长条", () => {
  const f = comp.slice(comp.indexOf("function menuItemsForKind("), comp.indexOf("// 编辑消息弹层"));
  const fn = new Function("return " + f.slice(f.indexOf("function menuItemsForKind")))();
  const g = fn({ kind: null }, false);
  assert.equal(g.length, 3, "三组：拿走它 / 动它 / 撤掉它");
  assert.deepEqual(g[0], ["copy", "fav", "quote"]);
  assert.deepEqual(g[2], ["multi", "recall"]);
  // 空组不许留下一道空隔断
  assert.match(menu, /items\.filter\(g => g && g\.length\)/);
  // 组内才画分隔线，组之间靠间距
  assert.match(menu, /borderTop: ri \? "1px solid " \+ t\.line : "none"/);
  assert.match(menu, /marginTop: gi \? 8 : 0/);
});

test("气泡转语音：不是语音条也能听", () => {
  const f = comp.slice(comp.indexOf("function menuItemsForKind("), comp.indexOf("// 编辑消息弹层"));
  const fn = new Function("return " + f.slice(f.indexOf("function menuItemsForKind")))();
  assert.ok(fn({ kind: null }, true)[1].indexOf("speak") >= 0, "配了音色的普通气泡要能念");
  assert.ok(fn({ kind: null }, false)[1].indexOf("speak") < 0, "没音色还摆出来，点了没反应");
  // 语音条自己气泡上就有 ▶，别再给一份
  assert.ok(fn({ kind: "voice" }, true).every(g => g.indexOf("speak") < 0));
  assert.match(comp, /speak: \["念出来", "wave"\]/);
});

test("能不能念，门槛跟语音条那一条完全一样", () => {
  const hits = comp.match(/const canSpeakMsg = m => \{[\s\S]{0,220}?\};/g) || [];
  assert.equal(hits.length, 2, "单聊和群聊两处都要有（一处写一份就会漂走）");
  hits.forEach(h => {
    assert.match(h, /spk\.voiceId/, "没选音色就没有嗓子");
    assert.match(h, /ttsReady\(\)/, "没配 TTS 就念不出来");
    assert.match(h, /m\.content/, "空消息没什么可念");
  });
  // 她自己那句没有音色 —— 说话人只可能是角色
  assert.equal((comp.match(/speakerOf = m => \(m && m\.role === "user"\) \? null :/g) || []).length, 2);
  // 群里各人各的音色，从 senderId 找回来
  assert.match(comp, /speakerOf = m => \(m && m\.role === "user"\) \? null : \(m && m\.senderId \? memberById\(m\.senderId\) : null\)/);
  // 两处都真的接上了动作
  assert.equal((comp.match(/act === "speak"\)[\s\S]{0,40}?speakMsg\(menu, messages\[menu\]\)/g) || []).length, 2);
});

test("菜单顶上那句话，是把它在聊天里的那个气泡原样端上来", () => {
  assert.match(menu, /isMine \? BUBBLE_SKIN\.myBg : BUBBLE_SKIN\.charBg/, "换成通用白框就又变回一张浮在半空的菜单");
  assert.match(menu, /justifyContent: isMine \? "flex-end" : "flex-start"/, "谁说的要站在原来那一边");
  assert.equal((comp.match(/isMine: messages\[menu\] && messages\[menu\]\.role === "user"/g) || []).length, 2);
});

test("编辑框那句「可拖右下角放大」是假的——iOS 没有那个角", () => {
  assert.ok(live.indexOf("可拖右下角放大") < 0);
  const es = comp.slice(comp.indexOf("function MsgEditSheet("), comp.indexOf("function MsgMenu("));
  assert.match(es, /resize: "none"/, "拖拽角在她手机上根本不存在");
  assert.match(es, /el\.style\.height = Math\.min\(el\.scrollHeight/, "得靠自己长高");
});
