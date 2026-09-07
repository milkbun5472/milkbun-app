// v62.62 审美审计（2026-09-04）：梦境三页是【最可惜】的一处——
// 「米白 + 圆角卡 + 徽标，没有一样属于梦」，而 core.js 里的 SKIN_PATS.night（星点）
// 现成摆着，一直没人用过。
//
// 判据：这一页原样搬到别的 app 里还成立，它就是坏了。
// 米白底 + 圆角 13 卡 + 色块 badge + 虚线新建按钮，搬到哪儿都成立。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const SRC = fs.readFileSync("js/dream.js", "utf8");
const NOC = SRC.split("\n").map(l => l.split("//")[0]).join("\n");

test("三页都进夜色，而且用的是 core.js 现成的那张 night 皮", () => {
  // ⚠️v65.18：那套夜色变成了【底稿】(NIGHT_BASE)，真正发下去的那份从 nightNow() 过一道
  //   themeFor("dream", …)——她在主题工作台里给梦境换几支色，整页跟着变
  //（她 2026-09-07：「我让秋秋改梦境变白还是没有变化」）。
  assert.match(NOC, /pageSkin\("night", N, \{ base: N\.bg/);
  // 三处外壳都要铺；漏一处那一页就还是米白的
  assert.equal((NOC.match(/style: dreamPage\(\)/g) || []).length, 3, "有一页没铺夜色");
  // 顶栏透上来 + 顶栏的字跟着进夜（Head 的 bg/ink 口子）
  assert.equal((NOC.match(/bg: "transparent", ink: t\.ink/g) || []).length, 3);
});

test("星点压到 .55：满强度是点阵，不是夜空", () => {
  // 17px / 29px 两层等距点在满强度下会打出摩尔纹，看着像织物纹理
  assert.match(NOC, /strength: \.55/);
});

test("三个组件的取色都换成夜里那一套，不再拿她的主题色", () => {
  // ⚠️不重写结构，只换取色的那个 t（跟 v62.61 歌单同一个手法）
  assert.equal((NOC.match(/const t = nightNow\(\);/g) || []).length, 3, "有组件还在用 useTheme()");
  assert.ok(!/const t = NIGHT_BASE;/.test(NOC), "有组件把底稿直接当成色，她改了主题这一页不会跟着变");
  assert.doesNotMatch(NOC, /const t = useTheme\(\);/);
  // 雾紫在夜里做字太暗，所以分成两支：ACCENT 只填色，ACC_LIT 写字画线
  assert.match(NOC, /const ACC_LIT = "#a99ac9";/);
  assert.match(NOC, /borderLeft: "2px solid " \+ ACC_LIT/);
  // 抵达/梦碎那两种色也得提亮，否则在夜里发黑
  assert.match(NOC, /const GOOD_LIT = "#7fc0a0";/);
  assert.match(NOC, /const BAD_LIT = "#d98a8a";/);
});

test("列表：梦没有边——不给框，用会淡掉的地平线分开", () => {
  const home = NOC.slice(NOC.indexOf("saves.slice().sort("), NOC.indexOf("长按可忘掉这场梦"));
  assert.doesNotMatch(home, /borderRadius: 13/, "又变回圆角卡了");
  assert.doesNotMatch(home, /border: "1px solid " \+ t\.line/);
  assert.match(home, /linear-gradient\(90deg,transparent,rgba\(232,230,240,\.20\) 22%/);
  // 徽标从填色 chip 换成一颗会发光的点 + 两个字
  assert.match(home, /boxShadow: "0 0 7px " \+ mark\.c/);
  assert.doesNotMatch(home, /background: badge\.bg/);
});

test("新建是一扇门，而且门要高于宽", () => {
  // ⚠️别用「往回数 N 个字符」来划范围：NOC 抹掉注释之后长度会变，
  //   数出来的窗口可能压根盖不到要判的那几行（这一处刚绊过一次）。用代码锚点。
  const btn = NOC.slice(NOC.indexOf('setView("setup"); },'), NOC.indexOf('} }, "推开一扇门")'));
  assert.match(btn, /borderRadius: "75px 75px 3px 3px"/, "上圆下方才是门洞");
  // 宽 150、上下 padding 加起来 142+：铺满一行的那个上圆下方看着是桥洞不是门
  assert.match(btn, /width: 150, maxWidth: "56%"/);
  assert.match(btn, /padding: "116px 0 26px"/);
  assert.doesNotMatch(NOC, /"＋ 编织一场梦"/, "虚线圆角「新建」按钮还在");
});
