// 装修工单最后那一行：我的衣柜 / 钱包 / 世界书 / 去处 各自的【子页】。
//
// 落地页早就做过了，进去一层才是重灾区——这是 2026-09-05 那次扫出来的规律，
// 这一轮按同一条路把四处的里层逐个点开：
//   · 我的衣柜  —— 没有子页，加一身是页内展开的表单，木纹是全的。对的。
//   · 钱包      —— 首页 / 亲属卡汇总 / 一张卡的账单 / 角色钱包，四层全在 LEATHER 上。对的。
//   · 去处      —— 三张纸页 + 两张压暗的照片底（区域、物件），对的。
//   · 世界书    —— ❌ 词条编辑是【米白半窗】，落在活页夹上。这一轮改的就是它。
//
// 顺路在同一次扫描里揪出来的三处同病（都是「深子页还是米白」）：
//   · 情书设置（整页米白 + 自己手写的顶栏）
//   · 日记目录（兄弟几页都在纸上，只有它是米白）
//   · 日记 / 随身物 的空状态（一个角色都没有时掉回米白）
// 前两处钉在 kept-shelf-62-44 / last-nine-skins-62-99 里（那两张单子本来就管那两族），
// 这个文件钉世界书和日记这两处。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
// ⚠️只切这一个组件：往后一路切到文件末尾的话，别处几十个 Sheet 都会算进来，
//   「还在走半窗」那条就永远红（第一版就是这么写错的）。
const page = (() => {
  const i = src.indexOf("function WorldBookEntryPage(");
  const j = src.indexOf("\nfunction ", i + 1);
  assert.ok(i > 0 && j > i);
  return src.slice(i, j);
})();

test("世界书词条编辑：半窗改成整页", () => {
  // 「撤掉东西要删除」——不是留着 Sheet 再在旁边说它不好
  assert.equal(page.indexOf("h(Sheet,"), -1, "还在走半窗");
  assert.equal(src.indexOf("WorldBookEntrySheet"), -1, "旧名字还留着");
  assert.match(page, /className: "absolute inset-0 z-50 h-full flex flex-col", style: binderSkin\(t\)/,
    "不是整页，或者底不是那本活页夹");
  // 盖在目录上、不是替掉它：目录还挂着，退出来滚动位置才在（mobile-ui-layout §3）
  assert.match(src, /editing && h\(WorldBookEntryPage, \{/, "改成了替换渲染，目录会被卸载");
  // 顶栏走公共 Head 并透上来，正文自己一个滚动容器
  assert.match(page, /h\(Head, \{ zh: isNew \? "新建设定" : "编辑设定"[^\n]*bg: "transparent"/);
  assert.match(page, /className: "flex-1 min-h-0 overflow-y-auto px-5"/);
  // 删除键从原来那条自写标题栏挪进 Head 的右格，没丢
  assert.match(page, /right: onDelete \? h\("button", \{ onClick: onDelete/);
});

test("底换了，压在上面的那张汇总卡也得跟着换", () => {
  // 那张卡原来躺在 t.bg2 的半窗上，所以 t.bg 是对比色；
  // 现在底是活页夹（基色就是 t.bg），照抄过来它会跟底融成一片，只剩一条边。
  const card = page.slice(page.indexOf('"这条会怎么送出去"') - 260, page.indexOf('"这条会怎么送出去"'));
  assert.match(card, /background: t\.bg2, border: "1px solid " \+ t\.line/, "汇总卡还站在跟底一样的色上");
});

test("binderSkin 在拼不出色号的主题下退回纯色，不留半张废皮", () => {
  const body = src.slice(src.indexOf("const binderSkin = t =>"), src.indexOf("const letterSkin ="));
  assert.match(body, /if \(!_hex6\(t\)\) return \{ background: t\.bg \};/);
});

test("日记：目录页和空状态都站在纸上", () => {
  const diary = src.slice(src.indexOf("  // ---- 目录定位：角色列表"));
  assert.match(diary.slice(0, 600), /style: pageSkin\("paper", t, \{ corner: false, strength: \.7 \}\)/, "目录页还是米白");
  assert.match(diary.slice(0, 600), /zh: "目录", sub: "记录对象", bg: "transparent"/, "目录页顶栏还在刷平色");
  assert.match(src, /if \(!authors\.length\) return h\("div", \{ className: "h-full flex flex-col", style: pageSkin\("paper", t, \{ corner: false, strength: \.7 \}\) \},\s*\n\s*h\(Head, \{ zh: "日记", bg: "transparent", onBack \}\)/,
    "一个角色都没有时那一屏还是米白");
});
