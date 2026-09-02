const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const _i = scr.indexOf("// —— 名册视图（默认，v60.55 重做）——");
const us = scr.slice(_i, scr.indexOf("unlinkChar && onUnlink ? h(Sheet", _i));
const card = comp.slice(comp.indexOf("function CoupleInviteCard"), comp.indexOf("// 解除拉黑申请卡片"));

// 她 2026-09-02：「这个界面也修一修，当时也是参考了别人的。不一定要这种一个框一个框，
//                 显示的文字也不一定要这些。还有情侣邀请卡也一起做好看点」。

test("不再是一框一框", () => {
  assert.ok(_i > 0, "切片没对上");
  assert.ok(!/borderRadius: 20, padding: "20px 16px 18px"/.test(us), "原来那张卡还在");
  assert.match(us, /borderTop: idx === 0 \? "none" : "1px solid " \+ t\.line/, "改成发丝分隔");
});

test("她自己的头像不再每一行重复一遍", () => {
  assert.ok(!/const meChar = \{ name: \(profile && profile\.name\)/.test(us),
    "每张卡里都摆一遍她自己的脸——她知道自己是谁");
  assert.equal((us.match(/h\(Avatar, \{ character: e\.char/g) || []).length, 1);
});

test("「恋爱中」那句去掉了，天数变成主角", () => {
  assert.ok(!/"与 " \+ e\.char\.name \+ " 恋爱中 · "/.test(us), "整页都是恋爱中，每行再写一遍是废字");
  assert.match(us, /fontSize: 26, lineHeight: 1, color: "#d16a86" \} \}, String\(n\)\)/, "天数是主角");
  assert.match(us, /"天 · 从 " \+ dayFmt\(e\.st\.since\) \+ " 起"/);
});

test("几段关系各走了多远，是这一页真正的内容", () => {
  // 一段就是一条走过来的路：30 天一根刻度，满 90 天那根高一截，末端实心点是今天
  assert.match(us, /const maxDays = Math\.max\(1, \.\.\.entries\.filter/, "整页共用一把长度尺才比得出来");
  assert.match(us, /for \(let d = 30; d <= n; d \+= 30\)/);
  assert.match(us, /big: d % 90 === 0/);
  assert.match(us, /width: \(n \/ maxDays \* 100\) \+ "%"/);
});

test("有新情书＝头像上一个红点，不是粉药丸", () => {
  assert.ok(!/borderRadius: 999, padding: "2px 11px" \} \}, "有新的" \+ tags\.join/.test(us), "粉药丸还在");
  assert.match(us, /position: "absolute", top: -2, right: -2, width: 10, height: 10/,
    "跟聊天列表的未读同一套语汇");
});

test("解除用 SVG 图标，不用 💔 这个 emoji", () => {
  // mobile-ui-layout 第 2 条：不用 Unicode 方块/爱心字符当图标
  assert.ok(!/\} \}, "💔"\)/.test(us), "💔 还在");
  assert.match(us, /h\(CGlyph, \{ k: "heartbreak", size: 17/);
  assert.match(comp, /heartbreak: \[P\(/, "图标要真的画在 CGlyph 里");
});

test("紧凑标题栏，不是那个占掉小半屏的大标题", () => {
  assert.ok(!/h\(Head, \{ zh: "情侣", en: "Us \/ Couple"/.test(us));
  assert.match(us, /paddingTop: safeTop\(10\)/);
  assert.match(us, /className: "flex-1 min-h-0 overflow-y-auto/);
});

test("邀请卡做成一封信：纸、折痕、封蜡", () => {
  assert.ok(!/"COUPLE INVITE"/.test(card), "原来那张通用白卡搬进任何 app 都成立");
  assert.match(card, /"第一封"/, "这个 app 本来就有情书，邀请就是第一封");
  assert.match(card, /background: "#fbf9f5"/, "纸色");
  // 折痕：上面一丝暗、下面一丝亮，压出来的那种
  assert.match(card, /background: "rgba\(0,0,0,\.10\)"[\s\S]{0,160}background: "rgba\(255,255,255,\.85\)"/);
  // 封蜡三态：形状不一样，不是只换个颜色
  assert.match(card, /st === "accepted" \? "none" : "1\.5px " \+ \(st === "declined" \? "solid" : "dashed"\)/);
  assert.match(card, /st === "declined" \? h\("div"[\s\S]{0,120}transform: "rotate\(16deg\)"/, "退回来的那封，封蜡上要有裂口");
});
