// 审美审计（AUDIT-AESTHETIC-2026-09-04）还债⑦：生活方式四页。
//
// 审计判词：这四页【不是米白】，是「时尚画册 / 科技仪表盘」皮——满版头像、
// 巨大斜体英文、白圆角卡、十九处英文眉标，跟「行程」这件事一点关系都没有。
// 「基础款不符主题」最典型的一处。行程现实里是【一本周计划手账】。
//
// ⚠️另记一笔：screen === "lifestyle" 全库【没有任何地方 set】——这四页现在进不去。
//   那是产品上的事（要么把入口放回来、要么整块删掉），不在这一版的范围里，
//   所以这份测试只判长相；进不进得去交给 Lisa 定。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const LIFE = src.slice(src.indexOf("// ── 手账的纸"), src.indexOf("// 世界书 · 设定索引"));
const CODE = LIFE.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("三页共用同一张手账纸：横线、装订红线、线圈孔", () => {
  // 一处画三处用——各写一份的话迟早只改一处（这个仓库最常犯的错）
  assert.match(CODE, /function plannerSkin\(t\) \{/);
  assert.match(CODE, /function PlannerRings\(\{ t \}\)/);
  assert.equal((CODE.match(/style: plannerSkin\(t\)/g) || []).length, 4,
    "手账纸没铺满该铺的那几页（日页两态 + 周页 + 名册）");
  assert.equal((CODE.match(/h\(PlannerRings, \{ t \}\)/g) || []).length, 4, "有页少了线圈");
  // 横线的间距是常量，正文才能对齐；不是随手写的一个数
  assert.match(CODE, /const PLANNER_RULE = 26;/);
  assert.match(CODE, /repeating-linear-gradient\(180deg," \+ t\.ink \+ "00 0 " \+ \(PLANNER_RULE - 1\)/);
  // 左边那道装订红线：只有这一道竖的，没有它就是普通横线稿纸
  assert.match(CODE, /linear-gradient\(90deg," \+ t\.ink \+ "00 0 30px," \+ red \+ "33 30px 31px/);
  // ⚠️深色/自定义主题下 t.ink / t.accent 未必是六位色号，拼透明度后缀会拼出废值
  assert.match(CODE, /if \(!\/\^#\[0-9a-f\]\{6\}\$\/i\.test\(String\(t\.ink \|\| ""\)\)\) return \{ background: t\.bg \};/);
  assert.match(CODE, /const red = \/\^#\[0-9a-f\]\{6\}\$\/i\.test\(String\(t\.accent \|\| ""\)\) \? t\.accent : t\.ink;/);
  // 线圈排在内容底下，不然顶上第一枚会压在返回键上
  assert.match(CODE, /alignItems: "center", zIndex: 1 \} \}/);
});

test("周页是手账翻开的那一面，不是仪表盘", () => {
  const wk = CODE.slice(CODE.indexOf('h(Head, { zh: char.name + " 这一周"'), CODE.indexOf("// —— browser"));
  // 那块 190px 满版头像色带、白圆角大卡、92px 斜体「LOG.」水印全撤掉
  assert.doesNotMatch(CODE, /const bandBg = char\.avatarImage/, "头像色带还在");
  assert.doesNotMatch(CODE, /"LOG\."/, "那块仪表盘水印还在");
  assert.doesNotMatch(CODE, /borderRadius: 22, border: "1px solid " \+ t\.line, boxShadow: "0 8px 24px/, "浮起来那张白卡还在");
  // 一周七格写在纸上：格与格之间是竖线（手账的栏），不是一排圆点
  assert.match(wk, /borderLeft: "1px solid " \+ t\.line/, "周栏的竖线没了");
  // 今天那一栏夹一枚书签：形状和位置都变，不只是换个色（tabs-not-plain-pills 那条底线）
  assert.match(wk, /clipPath: "polygon\(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%\)"/, "今天那枚书签没了");
  // 可点区不低于 40
  assert.match(wk, /minHeight: 62/);
});

test("四页里一个英文眉标都不剩，而且没有硬翻", () => {
  const eng = (CODE.match(/"[A-Z][A-Z0-9 ·\/&'.-]{2,}"/g) || []);
  assert.deepEqual(eng, [], "还留着这些英文：" + eng.join(" "));
  // 换的时候不是把英文译回来——眉标该说这一栏在干嘛
  assert.match(CODE, /"今天这一页"/);          // TODAY'S BRIEF
  assert.match(CODE, /"几件事"/);              // EVENTS
  assert.match(CODE, /"大概几个钟头"/);        // EST. TIME
  assert.match(CODE, /"跟原来说好的不一样了"/); // ✳ DEVIATION DETECTED
  assert.match(CODE, /"翻到今天这一页"/);      // OPEN TIMELINE
  assert.match(CODE, /"翻开这一本"/);          // OPEN SCHEDULE
  assert.match(CODE, /"第 " \+ s\.seq \+ " 件"/); // SEQ-01
  assert.match(CODE, /"临时改了："/);          // ［DEVIATION］
  assert.doesNotMatch(CODE, /"负荷"|"日志"|"简报"/, "把英文硬翻回来了");
  // 周几那一格原来是 M T W T F S S：既是英文，两个 T 两个 S 本来也分不清
  assert.match(src, /dowL: SCHED_DOW_ZH\[dd\.getDay\(\)\]\.slice\(1\)/);
  // dowEn 最后一处引用没了，那份英文星期表和字段一起删掉（撤东西要删干净）
  assert.doesNotMatch(src, /SCHED_DOW_EN|dowEn/, "英文星期表还留着");
});

test("日页是手账的日页：方角事项、可点区够、没有 emoji", () => {
  const day = CODE.slice(CODE.indexOf("function LifeDay("), CODE.indexOf("function Lifestyle("));
  assert.match(day, /borderRadius: 3, padding: "16px 16px 15px"/, "事项还是 16 圆角的通用卡");
  assert.match(day, /minHeight: 28/, "「重新推演」那颗的可点区没了");
  assert.match(day, /width: 40, height: 40, marginLeft: -8/, "返回键的可点区没了");
  const emo = [...day].filter(ch => { const c = ch.codePointAt(0); return (c >= 0x1F000 && c <= 0x1FAFF) || (c >= 0x2600 && c <= 0x27BF); });
  assert.deepEqual([...new Set(emo)], [], "日页里还留着 emoji：" + emo.join(""));
});
