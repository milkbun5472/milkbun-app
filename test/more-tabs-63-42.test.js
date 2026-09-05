// tabs-not-plain-pills 还债（第二批）：邮件三页 / 随身物分区条 / 日历的「重复」。
//
// 判据：这一组 tab 原样搬到另一个 app 里还成立吗？成立就是写坏了。
// 三处各自照【这一页现实里是什么东西】来：
//   邮件 → 吊挂文件夹的标签舌（梯形、斜肩、不等宽）
//   随身物 → 缝在布上的布标（整页就是布）
//   日历 → 在那一格上画个圈（日历上挑一个的动作就是圈一天）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const phone = read("phone.js"), screens = read("screens.js"), comp = read("components.js");

test("邮件三页＝文件夹的标签舌，跟浏览器那条标签条分得开", () => {
  const seg = phone.slice(phone.indexOf("三页＝吊挂文件夹的标签舌"), phone.indexOf("      null),", phone.indexOf("三页＝吊挂文件夹的标签舌")));
  // 梯形：两侧斜切
  assert.match(seg, /clipPath: "polygon\(9px 0, calc\(100% - 9px\) 0, 100% 100%, 0 100%\)"/, "不是梯形舌");
  // 不等宽：按名字走，不占满一行（浏览器那条是 flex-1 等宽）
  assert.ok(!/flex-1/.test(seg), "又摊成等宽的一行了，那是浏览器那条标签条");
  assert.match(seg, /padding: on \? "10px 16px 9px" : "8px 14px 7px"/, "选中那片没抬起来");
  assert.match(seg, /marginBottom: -1/, "选中那片没压住那条线");
  assert.match(seg, /borderBottom: "1px solid " \+ MAIL_LINE/);
  assert.match(seg, /minHeight: 40/, "可点区不够");
  // 信件区那条 borderTop 得撤掉——不撤的话选中那片压住了上面这条，下面那条还在
  assert.ok(!/background: "#fff", borderTop: "1px solid " \+ MAIL_LINE/.test(phone),
    "信件区还自己画了一条线，选中那片压不住它");
  // 旧那颗白药丸分段一处不留
  assert.ok(!/borderRadius: 9,\s*\n?\s*background: tab === x\.k \? "#fff"/.test(phone));
});

test("随身物分区条＝缝在布上的布标", () => {
  const i = screens.indexOf("分区条不是一排药丸");
  assert.ok(i > 0, "那段注释没了，八成整块被改回去了");
  const seg = screens.slice(i, i + 1500);
  assert.match(seg, /borderRadius: 3/, "还是圆药丸");
  assert.ok(!/borderRadius: 999/.test(seg), "药丸还在");
  // 两端各一道针脚：短虚线，两条
  assert.equal((seg.match(/repeating-linear-gradient\(180deg," \+ carryTint\(x\.key, \.6\)/g) || []).length, 2,
    "针脚不是两道（一道的话看着像分隔线，不像缝上去的）");
  assert.match(seg, /inset 0 1px 0 rgba\(255,255,255,\.5\)/, "上沿那道亮线没了，布标就是平的");
  assert.match(seg, /minHeight: 40/, "可点区不够");
});

test("随身物那两处小标题不再挂一行大写英文", () => {
  // BAG / POCKET / WARDROBE / TRINKETS 是 (x.en||"").toUpperCase() 拼出来的
  assert.ok(!/\(x\.en \|\| ""\)\.toUpperCase\(\)/.test(screens));
  assert.ok(!/\(sec\.en \|\| ""\)\.toUpperCase\(\)/.test(screens));
  // en 字段本身留着——pageSkin 的页脚水印还在用它（word: sec.en）
  assert.match(screens, /word: sec\.en/);
  assert.match(screens, /\{ key: "bag", zh: "包内", en: "Bag"/);
});

test("日历的「重复」＝在那一格上画个圈", () => {
  const i = comp.indexOf("日历上挑一个的动作是【在那一格上画个圈】");
  assert.ok(i > 0, "那段注释没了");
  const seg = comp.slice(i, i + 1200);
  assert.match(seg, /borderRadius: 3, background: "transparent"/, "还是填色药丸");
  assert.ok(!/borderRadius: 999/.test(seg), "药丸还在");
  // 圈：椭圆、歪一点、盖出格子外、不吃点击
  // ⚠️光验圈的样式没用：把 on 改成 false 那些样式照样在源码里躺着，
  //   圈却永远画不出来。得连【什么时候画】一起验。
  assert.match(seg, /\n\s*on \? h\("span", \{ "aria-hidden": "true"/, "圈不跟着选中走了");
  assert.match(seg, /borderRadius: "50%"/, "圈不是椭圆");
  assert.match(seg, /transform: "rotate\(-3\.5deg\)"/, "圈画得太正了，不像手画的");
  assert.match(seg, /left: -5, right: -5, top: -4, bottom: -4/, "圈没盖出格子外");
  assert.match(seg, /pointerEvents: "none"/, "圈会挡住点击");
  assert.match(seg, /minHeight: 40/, "可点区不够");
});

// ── 第三批（v63.42）：匿名箱三个筛选 / 聊天搜索七个筛选 ─────────────────
test("匿名箱三个筛选＝三枚邮戳", () => {
  const i = comp.indexOf("三个筛选＝三枚邮戳");
  assert.ok(i > 0, "那段注释没了，八成整块被改回去了");
  const seg = comp.slice(i, i + 1100);
  assert.match(seg, /borderRadius: 3,/, "还是圆药丸");
  assert.ok(!/borderRadius: 999/.test(seg), "药丸还在");
  // 盖上去的戳：双线边（内描边两层）、盖歪一点；没盖的是空的虚线框
  assert.match(seg, /\(on \? "solid" : "dashed"\)/, "没盖的那两个不是虚线框");
  assert.match(seg, /boxShadow: on \? "inset 0 0 0 1px " \+ A\.bg \+ ", inset 0 0 0 2\.5px " \+ A\.hot : "none"/, "戳没有双线边");
  assert.match(seg, /transform: on \? "rotate\(-2deg\)" : "none"/, "戳盖得太正了");
  assert.match(seg, /background: "transparent"/, "戳不该是填色块");
  assert.match(seg, /minHeight: 40/, "可点区不够");
});

test("聊天搜索七个筛选＝七个小气泡，emoji 图标撤掉", () => {
  const i = comp.indexOf("七个筛选＝七个小气泡");
  assert.ok(i > 0, "那段注释没了");
  const seg = comp.slice(i, i + 1300);
  // 气泡：左下角一个尖
  assert.match(seg, /borderRadius: "11px 11px 11px 3px"/, "不是气泡形状");
  assert.ok(!/borderRadius: 999/.test(seg), "药丸还在");
  assert.match(seg, /minHeight: 40/, "可点区不够");
  // emoji 一个不留（注释里那一串是在说撤掉了什么，不算）
  const code = seg.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(code), "还拿 emoji 当图标：" + code.slice(0, 120));
  ["语音", "图片", "转账", "通话", "位置", "红包"].forEach(z =>
    assert.ok(code.includes('"' + z + '"'), "少了这一档：" + z));
});
