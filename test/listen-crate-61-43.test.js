// 她 2026-09-03：「大概功能整理好了现在来改设计吧，都还是米白的」
//
// 这个 app 在现实里是什么？播放页早就画着一张真的碟，分栏是唱片架里的分隔卡——
// 那整页就该是【碟和分隔卡待着的那个地方】：一块木台面。
// 原来碟浮在一片米白上，等于把唱机摆在一张白纸上。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const rule = fs.readFileSync(path.join(root, ".claude/rules/mobile-ui-layout.md"), "utf8");
const i = src.indexOf("  // ── 底：一箱唱片的木台面");
assert.ok(i > 0, "抠不出那块木台面");
const CRATE = src.slice(i, src.indexOf("    cvAddSheet,", i));
// ⚠️「不许出现 X」这类断言必须对着【剥掉注释的代码】问：注释里正写着
//   「不挂 backgroundAttachment」「默认那个 #c25a4a」，直接 grep 会把说明当违规抓出来。
const CODE = CRATE.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("底纹铺在外壳上、顶栏透上来（mobile-ui-layout.md §3.5）", () => {
  // 铺在滚动区上的话顶栏那一条还是平色，顶上横一道没盖住的带子
  assert.match(CRATE, /className: "h-full flex flex-col relative", style: crate/, "底纹没铺在最外面那个外壳上");
  assert.match(CRATE, /h\(Head, \{ zh: "一起听", bg: "transparent"/, "顶栏没让底纹透上来");
  // 内容在动，木头不该跟着动
  assert.doesNotMatch(CODE, /backgroundAttachment/, "又挂上 backgroundAttachment 了");
  // 规矩本身还在（这条塌了，上面几条就没有出处了）
  assert.match(rule, /底纹铺在【外壳】上，顶栏透明/);
});

test("主题色拼不出六位色号时退回纯色，不许整层静默消失", () => {
  // 深色/自定义主题下 t.ink 可能不是 #rrggbb，拼 t.ink+"1c" 会拼出废值，
  // 那一整条 background-image 被浏览器丢掉——界面上看着像「这一页没做」。
  assert.match(CRATE, /const hex6 = v => \/\^#\[0-9a-f\]\{6\}\$\/i\.test\(String\(v \|\| ""\)\)/);
  assert.match(CRATE, /!\(hex6\(t\.ink\) && hex6\(t\.accent\)\) \? \{ background: t\.bg \}/,
    "验不过没退回纯色；两个都要验，木头两样颜色都在拼");
});

test("木头的暖来自主题的 accent，不是硬写一个棕色", () => {
  // 拿 t.ink 叠出来的是灰调条纹，那不是木头是瓦楞纸；
  // 硬写棕色则换个冷色主题就成一块外来的板子。
  assert.match(CRATE, /linear-gradient\(180deg," \+ t\.accent \+ "2e/, "没有那层暖底");
  const hard = CODE.match(/#[0-9a-f]{6}/gi) || [];
  assert.deepEqual(hard, [], "木头里写死了颜色：" + hard.join(" "));
  // 木纹得宽窄不齐才像木头，等宽等距那是瓦楞纸
  // 每条纹的【周期】＝那一条里最大的那个 px（前面几个都是 0px/起点）
  const grain = (CODE.match(/repeating-linear-gradient\(90deg[^\n]*/g) || [])
    .map(line => Math.max.apply(null, (line.match(/(\d+)px/g) || ["0px"]).map(x => parseInt(x, 10))));
  assert.ok(grain.length >= 3, "只有 " + grain.length + " 条木纹");
  assert.ok(new Set(grain).size === grain.length,
    "木纹周期撞了（" + grain.join(" / ") + "）——宽窄一齐就是瓦楞纸不是木头");
});

test("「第几首」走 sub 不走 en——走 en 会被「标题不留英文」吃掉", () => {
  // v61.29 起有 zh 时纯拉丁的 en 一律不发。这一处的 en 是【数字】，
  // 于是从那版起「3 / 12」再也没显示过（她还没发现）。数字不是装饰。
  assert.match(CRATE, /sub: nav === "play" && now \? \(idx >= 0 \? idx \+ 1 : 1\) \+ " \/ "/, "又写回 en 了");
  assert.doesNotMatch(CRATE, /en: nav === "play"/, "en 那一路还留着");
});

test("tab 改了名，界面上指路的字也得跟着改", () => {
  // 「曲库」改叫「设置」之后，空状态还写着「去『首页』」就成了指错路——
  // 她照字面去找，那个 tab 根本不叫这个名。⚠️没连账号时它确实还叫「首页」，
  // 所以这两句得跟着连没连账号走，不能一刀切。
  const seg = src.slice(src.indexOf("function ListenTogether("), src.indexOf("// 设置·情侣问答自定义题库"));
  const stale = (seg.match(/"[^"]*去「首页」[^"]*"|"[^"]*去「曲库」[^"]*"/g) || []);
  assert.deepEqual(stale, [], "这几句还在指旧名字：\n  " + stale.join("\n  "));
  assert.equal((seg.match(/\(apiBase && cookie\) \? "设置" : "首页"/g) || []).length, 3,
    "底 tab 的名字 + 两处指路，三处都得跟着连没连账号走");
});
