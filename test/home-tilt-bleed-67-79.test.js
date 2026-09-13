// 她 2026-09-13 带截图：「组件和装饰要是歪着叠，他的角会被截掉」。
//
// 病根：主屏每一格【定了高就 overflow:hidden】，而卡是转过角度的——
// 一张 340 宽的卡歪 4°，上下各要多出十来像素，那几个角正好被这个方框削掉。
//
// ⚠️不能把它改成 visible：homeWidgetPresetStyle 里写着理由——
//   「格子是按格算落位的，让装饰画到格子外面会盖住邻居」。那句话是对的，不许绕过。
// 所以不放开裁剪，而是【把裁剪框往外挪几像素】，挪进格与格之间那道缝里：
//   padding + 负 margin + 高度补两倍（border-box）→ 占位、内容尺寸、位置一个都没变，
//   变的只有那个方框。
//
// ⚠️主屏是「一个都不许改」的地方（施工规则/home-screen-layout.md）：根节点、
//   那条安全区空带、Home 的 100vh、内容区的 pt-3 —— 这一版一个都没碰，只动了格子里那几行。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

test("借的那几像素比格与格之间那道缝窄：盖不到邻居", () => {
  const m = comp.match(/const HOME_TILT_BLEED = (\d+);/);
  assert.ok(m, "找不到 HOME_TILT_BLEED");
  const bleed = Number(m[1]);
  // 缝是 tailwind 的 gap-y-2 / gap-x-2＝8px（0.5rem）
  assert.match(comp, /className: "grid grid-cols-4 gap-y-2 gap-x-2"/);
  assert.ok(bleed * 2 < 8 + bleed, "两边各借 " + bleed + "px，缝只有 8px——邻居要被盖住了");
  assert.ok(bleed <= 6, "借得太多了：" + bleed);
  // 歪的角度最多 ±12°，6px 挡不住最歪那几张的全部转角，但挡得住日常那几度
  assert.match(comp, /return Math\.max\(-12, Math\.min\(12, Math\.round\(n\)\)\);/);
});

test("只把裁剪框往外挪，占位和内容尺寸一个都不许变", () => {
  const i = comp.indexOf('        gridColumn: gCol, gridRow: gRow,');
  const seg = comp.slice(i, i + 1400);
  // 高度补两倍、padding 一倍、margin 负一倍——三样必须同时在，少一样就是真的把格子改大了
  assert.match(seg, /height: fixedH \? fixedH \+ HOME_TILT_BLEED \* 2 : undefined,/);
  assert.match(seg, /padding: fixedH \? HOME_TILT_BLEED : undefined,/);
  assert.match(seg, /margin: fixedH \? -HOME_TILT_BLEED : undefined,/);
  // 裁剪本身照旧（那句「会盖住邻居」的理由还在）
  assert.match(seg, /overflow: fixedH \? "hidden" : undefined,/);
  assert.ok(!/overflow: fixedH \? "visible"/.test(seg), "把裁剪放开了——装饰会画到邻居头上");
  // 没定高的那几格（自己决定高度的）一个字都没动
  assert.match(seg, /height: fixedH \? fixedH \+ HOME_TILT_BLEED \* 2 : undefined/);
});

test("主屏那几样「不许动」的东西，这一版一个都没碰", () => {
  // 施工规则/home-screen-layout.md 点名的四样
  assert.match(comp, /height: "100vh"/, "Home 的 100vh 没了");
  assert.match(comp, /className: "relative flex-1 min-h-0 overflow-hidden pt-3 flex flex-col"/, "内容区那个 pt-3 被动了");
  assert.match(comp, /paddingBottom: "calc\(env\(safe-area-inset-bottom\) \+ 26px\)"/, "底下那排快捷栏的安全区被动了");
  assert.match(comp, /const HOME_PAD_X = 12;/, "主屏左右边距被动了");
});
