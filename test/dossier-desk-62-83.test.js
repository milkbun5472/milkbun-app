// 审美审计（AUDIT-AESTHETIC-2026-09-04）还债④第一批：档案馆那一族。
//
// 审计的「乙组」：卡片/部件都已经从这一页是什么东西里长出来了（卷宗书脊、印章、
// 亲属卡、关系板），**唯独外壳还是 t.bg 平色**——元素合格、外壳裸着。
// 而这张桌子本来就有：编辑档案那一页（dossierDeskBg）早就铺着它。
// 「同一个 app 两张桌子」（列表页米白、编辑页桌面）是审计原话点名的一处。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

test("桌子只画一次，同族四处共用同一张", () => {
  // 不新发明材质：DESK 就是编辑页那张 dossierDeskBg 包一层
  assert.match(src, /const DESK = accent => \(\{ background: dossierDeskBg\(accent\) \}\);/);
  // v62.99 起第六处：导角色卡那一屏也归档案馆这一族，搬同一张桌子
  assert.equal((src.match(/style: DESK\(/g) || []).length, 6,
    "铺到的页数变了：档案馆列表 / 关系板 / 按条看 / 亲属卡（有卡、无卡两态）/ 导卡，共六处");
  // 编辑页那一处照旧直接用 dossierDeskBg，不改它——这条只是钉住两边是同一张桌子
  assert.match(src, /style: \{ background: dossierDeskBg\(accent\) \}/);
});

test("铺了桌子的那几页，顶栏不许再自己刷一档平色", () => {
  // 铺在外壳上、顶栏还刷平色的话，顶上就横着一条没盖住的带子
  //（.claude/rules/mobile-ui-layout.md §3.5）。亲属卡原来刷的还是【另一档】t.bg2，比没铺更显眼。
  const cast = src.slice(src.indexOf("function Cast({"), src.indexOf("\nfunction ", src.indexOf("function Cast({") + 10));
  assert.match(cast, /style: DESK\(t\.accent \|\| t\.tint\)/, "档案馆列表没铺桌子");
  // ⚠️这里【不能】写 DESK(accent)：accent 是 characters.map 回调里的局部变量，
  //   在外壳这一层是 undefined → ReferenceError → 白屏（第一版就是这么写的）。
  assert.doesNotMatch(cast, /style: DESK\(accent\)/, "外壳用了 map 回调里的局部变量");
  assert.match(cast, /paddingTop: safeTop\(8\), borderBottom: "1px solid " \+ t\.line \} \}/, "档案馆的顶栏还在自己刷 t.bg");
  const kin = src.slice(src.indexOf("function KinshipBill("), src.indexOf("function KinshipBill(") + 3000);
  assert.doesNotMatch(kin, /paddingTop: safeTop\(20\), background: t\.bg2/, "亲属卡的顶栏还在刷另一档平色");
  assert.match(kin, /width: 40, height: 40, marginLeft: -8/, "亲属卡返回键的可点区不够");
});

test("按条看那一页顺手把英文副标题换掉了", () => {
  // en: "Ties · N" 是纯拉丁，v61.29 起 Head 根本不发它——留着只是让人以为还在用
  assert.doesNotMatch(src, /en: "Ties · " \+ mine\.length/, "旧那行英文副标题还在");
  assert.match(src, /sub: mine\.length \+ " 条", bg: "transparent"/);
  assert.doesNotMatch(src, /h\(Head, \{ zh: "亲属卡", en: "Kinship"/, "亲属卡空态那行英文还在");
});
