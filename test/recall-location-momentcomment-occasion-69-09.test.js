// 她 2026-09-16：「再列一下单聊所有功能以及它们有没有提示让角色不用我提也可以自己弄」。
//
// 列下来，单聊线上还剩三样是【有格式没场合】：撤回、发位置、评论朋友圈。
// 跟 v68.62 的 voice/call 一模一样——能力字典里写着长什么样，
// 可【什么时候真人会这么做】一个字都没有，于是模型只在她点名那轮填。
//
// ⚠️「已经有人管了吗」查过了：上面那条【能力使用总则】确实把 recall 点了名，
//   但它只是列了一排名字。call 和 voice 也在那句里，她照样报「都是我问才会」，
//   补上场合才动——所以这三条补的是场合，不是又一条总则。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

const segOf = (from, to) => app.slice(app.indexOf(from), app.indexOf(to));

test("撤回 / 位置 / 评论朋友圈：三样都得有「什么时候该用」", () => {
  assert.match(app, /capState\.push\("recall：/, "撤回没有场合那一句");
  assert.match(app, /capState\.push\("location：/, "位置没有场合那一句");
  assert.match(app, /capState\.push\("momentComment：/, "评论朋友圈没有场合那一句");
});

test("关键的那半句：不必等她开口", () => {
  assert.match(app, /\*\*不必等 Ta 问，也不必是什么说漏嘴的大事\*\*/);
  assert.match(app, /\*\*不必等 Ta 问你在哪\*\*/);
  assert.match(app, /\*\*不必等 Ta 来问你看没看见\*\*/);
});

test("撤回要说清那一秒是会被看见的，不然模型不敢撤", () => {
  const seg = segOf('capState.push("recall：', 'capState.push("location：');
  assert.match(seg, /撤回之前那一秒它是正常显示的/);
  assert.match(seg, /本来就是这样/, "得明说这不是失败，否则又变成不敢用");
  assert.match(seg, /要补一句就把补的话写进 word/);
});

test("给场合不给配额（施工规则/bans-make-it-dumber）", () => {
  const seg = segOf('capState.push("recall：', '// 顺手发朋友圈');
  [/每\s*\d+\s*轮/, /至少.{0,4}一条/, /必须发/, /别频繁/].forEach(re =>
    assert.doesNotMatch(seg, re, "写成配额了：" + re));
  // 也不许用判决式收尾（「不许／禁止／删掉重说」）
  [/不许/, /禁止/, /删掉重说/].forEach(re =>
    assert.doesNotMatch(seg, re, "判决式收尾：" + re));
});

test("留格式示范、删内容示范（施工规则/prompt-no-content-samples）", () => {
  const seg = segOf('capState.push("location：', '(moments || []).some');
  // 说的是判据（他自己嘴里怎么叫），不是给一个地名让他照抄
  assert.match(seg, /name 写你自己嘴里会怎么称呼这个地方/);
  assert.match(seg, /不是导航软件上那串全称/);
});

test("评论朋友圈：没有她发的动态就不给这一格", () => {
  // 一格开着却无处可评＝回执是个承诺，承诺不了的别让TA开口
  assert.match(app, /if \(\(moments \|\| \[\]\)\.some\(m => m && m\.mine\)\) \{\s*\n\s*capState\.push\("momentComment：/);
});

test("评论朋友圈带公开围栏：那条底下别人也刷得到", () => {
  const seg = segOf('capState.push("momentComment：', '// 顺手发朋友圈');
  assert.match(seg, /刷到的人都看得见/);
  assert.match(seg, /只属于你和 " \+ uName \+ " 之间的私事别写进去/);
});

test("四处一样喂：差异写着理由，不是忘了", () => {
  const seg = segOf('撤回 / 位置 / 评论朋友圈：有格式，没场合', 'capState.push("recall：');
  assert.match(seg, /four-surfaces-same-context\.md/);
  assert.match(seg, /单聊线下 ❌ 【欠的，不是有理由不给】/);
  assert.match(seg, /群聊 ❌ 有真理由/);
  assert.match(seg, /MAIN_ONLY_FIELDS/, "momentComment 群里不给的理由要落到那份名单上");
});

test("momentComment 确实在 MAIN_ONLY_FIELDS 里（上一条的理由不能是空的）", () => {
  const rooms = fs.readFileSync(path.join(__dirname, "..", "js", "chat-rooms.js"), "utf8");
  const list = rooms.slice(rooms.indexOf("MAIN_ONLY_FIELDS"), rooms.indexOf("MAIN_ONLY_FIELDS") + 300);
  assert.match(list, /"momentComment"/);
});
