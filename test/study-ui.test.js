"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");
const ui = src.slice(src.indexOf("// UI"));

test("一起学整套界面是一册活页学习夹，不再是通用白卡", () => {
  assert.match(ui, /const STUDY_SKIN = \{/);
  assert.match(ui, /const STUDY_MODE_SKIN = \{[\s\S]*teach:[\s\S]*costudy:[\s\S]*nv1:/);
  // v63.01 no-english-titles 收尾：这几条原来是「英文 · 中文」夹着写的
  // （LAST NOTES · 学到哪了…），中文那半已经把话说完了，英文那半是装饰，删掉。
  // StudyHead 的 en 有中文 zh 时本来就不发，那几个死的 en 也一并撤了。
  ["学到哪了", "历次课 ", "研究什么", "大目标", "找谁一起", "找谁教（选 1 个）"]
    .forEach(z => assert.ok(ui.includes('"' + z + '"'), "少了这条中文眉标：" + z));
  ["COURSE FILE", "LAST NOTES", "LESSON SLIPS", "NEW RESEARCH SHEET", "OPEN STUDY BINDER",
    "COURSE SUBJECT", "RESEARCH QUESTION", "PARTNER ·", "TEACHER ·", "SEATING ·"]
    .forEach(w => assert.ok(!ui.includes(w), "旧那条英文眉标还在：" + w));
  // v62.73 no-english-titles：QUIZ CARD → 「小测」。眉标说的是这一栏在干嘛，
  // 不是把英文原样译回来。
  assert.match(ui, /"小测 · "/);
  assert.match(ui, /课后批注页/);
});

test("一起学所有内页共用紧凑安全顶栏与聊天同尺底栏", () => {
  assert.match(ui, /function StudyHead\(props\)/);
  // ⚠️v65.14：StudyHead 不再自己搭一条，它就是【包了一层桌面纸参数的共用 Head】。
  //   原来那句「不许出现 h(Head," 是 v61.27 之前的事（那时 Head 是 30px 大标题），
  //   理由过期，删掉重写（施工规则/no-yes-unless.md）：安全区、可点区、居中都归 Head 管，
  //   这一页只传自己的纸色/墨色/线色，顶栏那几个挂点也跟着白得。
  assert.match(ui, /return h\(Head, \{/, "一起学又自己写了一条顶栏");
  assert.match(ui, /ink: STUDY_SKIN\.ink, subInk: skin\.accent, lineInk: STUDY_SKIN\.line/, "桌面那几档色没传进去");
  assert.match(ui, /bg: "rgba\(251,248,239,\.92\)"/);
  assert.equal((ui.match(/h\(Head, \{/g) || []).length, 1, "Head 只该在 StudyHead 那一处出现（别处又各写各的）");
  assert.match(ui, /function StudyFooter\(props\)/);
  assert.match(ui, /paddingBottom: COMPOSER_PAD_BOTTOM/);
  assert.doesNotMatch(ui, /calc\(env\(safe-area-inset-bottom\) \+/, "底栏又把安全区整条重复垫高了");
});

test("三种模式是学习夹分隔页，不是换色药丸", () => {
  assert.match(ui, /三种模式是活页夹里三张分隔页/);
  assert.match(ui, /minHeight: on \? 58 : 49/);
  assert.match(ui, /borderRadius: "12px 12px 0 0"/);
  assert.match(ui, /borderTop: "4px solid " \+ skin\.accent/);
  assert.match(ui, /transform: on \? "none" : "translateY\(1px\)"/);
});

test("首页和课程档案进入内页后都能恢复原滚动位置", () => {
  assert.match(ui, /homeScrollTopRef\.current = homeScrollRef\.current\.scrollTop/);
  assert.match(ui, /homeScrollRef\.current\.scrollTop = homeScrollTopRef\.current/);
  assert.match(ui, /consoleScrollTopRef\.current = consoleScrollRef\.current\.scrollTop/);
  assert.match(ui, /consoleScrollRef\.current\.scrollTop = consoleScrollTopRef\.current/);
  assert.match(ui, /ref: props\.scrollRef, className: "flex-1 min-h-0 overflow-y-auto/);
});

test("学习线程工具、题卡与作答选项保留可点击高度", () => {
  assert.match(ui, /const lessonTools =/);
  assert.match(ui, /minHeight: 42/);
  assert.match(ui, /const baseButton = \{ minHeight: 42/);
  assert.match(ui, /minHeight: 40/);
  assert.match(ui, /写在这张课页上/);
});

test("填空题卡使用原生可点词块，不执行模型生成的 HTML", () => {
  assert.match(ui, /const bank = q\.wordBank \|\| \[\]/);
  assert.match(ui, /点词块拼答案，也可以直接输入/);
  assert.match(ui, /重新拼/);
  assert.doesNotMatch(ui, /dangerouslySetInnerHTML|srcDoc/);
});

test("抽一张题卡只请求一题，避免无状态的三题承诺", () => {
  assert.match(ui, /只出 1 题/);
  assert.doesNotMatch(ui, /出 3 道小题/);
});

test("课程、课页和研究纸删除都走 App 可见确认层", () => {
  assert.match(ui, /requestAppConfirm\("移除这张课页？"/);
  assert.match(ui, /requestAppConfirm\("删除这张研究纸？"/);
  assert.match(ui, /requestAppConfirm\("删除整门课程？"/);
});
