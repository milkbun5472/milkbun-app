// 审美审计（AUDIT-AESTHETIC-2026-09-04）还债⑤：记忆库。
//
// 审计的更正：装修工单 D 节把这一页记成「已经有底子，别重做」——不属实。
// 外壳（无 style）、顶栏（自刷 t.bg）、滚动区，三层【一层底都没有】；
// 有底的只是那三张索引卡 tab，那是装饰不是底。
// 主题这一页自己早就定好了（注释写着「记忆库是一盒卡片」），底顺着同一样东西铺。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const MEM = src.slice(src.indexOf("function MemoryLib({"), src.indexOf("function MemCfgSheet("));
const CODE = MEM.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("外壳是一只卡片盒，铺在最外层、顶栏透上来", () => {
  assert.match(CODE, /className: "h-full flex flex-col", style: boxSkin/, "底纹没铺在最外那层外壳上");
  assert.match(CODE, /zh: "记忆库", bg: "transparent", onBack: onBack/, "顶栏没让底透上来");
  assert.match(CODE, /className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10"/);
  // 盒壁：左右两侧压深，页面才不是一张平纸，是往里看的一只盒子
  assert.match(CODE, /linear-gradient\(90deg," \+ t\.ink \+ "14 0," \+ t\.ink \+ "00 26px/, "盒壁没了");
  // 卡纸的纹：两套斜的，跟设置那张工程格纸（正交）、日记那块布纹分得开
  assert.equal((CODE.match(/repeating-linear-gradient\((?:115|25)deg/g) || []).length, 2, "卡纸的纹不是两套斜纹");
  // ⚠️深色/自定义主题下 t.ink 未必是六位色号，拼透明度后缀会拼出废值、整层静默消失
  assert.match(CODE, /const _hex6m = \/\^#\[0-9a-f\]\{6\}\$\/i\.test\(String\(t\.ink \|\| ""\)\)/);
  assert.match(CODE, /const boxSkin = !_hex6m \? \{ background: t\.bg \}/, "验不过没退回纯色");
  assert.doesNotMatch(CODE, /backgroundAttachment/, "底跟着滚了");
});

test("每一条是盒里的一张索引卡，跟上面那三张 tab 是同一样东西", () => {
  // 原来是 15 圆角卡 + 左边一道内阴影当强调条——那是通用卡片，跟「索引卡」没关系
  assert.doesNotMatch(CODE, /borderRadius: 15, padding: "11px 13px 10px", boxShadow: "inset 3px 0 0 "/, "旧那张通用卡还在");
  assert.match(CODE, /borderRadius: 3, padding: "13px 13px 10px", overflow: "hidden"/, "卡没改成方角");
  // 色标在顶边（索引卡的色标签），不是左边的强调条
  assert.match(CODE, /position: "absolute", left: 0, right: 0, top: 0, height: 3, background: accent/, "顶边那条色标带没了");
  // 卡面印一条横线——tab 上那三张也印着，两处得是同一样东西
  assert.match(CODE, /position: "absolute", left: 12, right: 12, top: 30, height: 1, background: t\.line/, "卡面那条横线没了");
  assert.match(CODE, /bottom: 7, height: 1, background: t\.line/, "tab 上那三张的横线被动了——两处得一致");
  // 色标的含义没变：未了＝赭、常驻＝主色、其余＝细线
  assert.match(CODE, /const accent = e\.open \? "#b06a4f" : e\.pinned \? t\.tint : t\.line;/);
});

test("英文眉标清掉，而且没有硬翻", () => {
  // 「MEMORY INDEX」和「INDEX / N」都是 no-english-titles 点名的那种。
  // 换的时候不是把英文译回来：眉标该说这一栏在干嘛——
  // 顶上说这一盒里此刻真有几张，列表上说这一摞抽出来几张。
  assert.doesNotMatch(CODE, /"MEMORY INDEX"/);
  assert.doesNotMatch(CODE, /"INDEX \/ "/);
  assert.doesNotMatch(CODE, /"索引"[^卡]/, "把 INDEX 硬翻成「索引」了");
  assert.match(CODE, /sub: activeTotal \? "在册 " \+ activeTotal \+ " 张" : null/);
  assert.match(CODE, /"这一摞 " \+ list\.length \+ " 张"/);
});
