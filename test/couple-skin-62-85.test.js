// 审美审计（AUDIT-AESTHETIC-2026-09-04）还债④第二批：情侣空间那几扇门。
//
// 审计的「乙组」跟档案馆那批同一个形状：部件早就从这一页是什么东西里长出来了
//（布面本子、挂历页、照片、盆栽、登机牌、唱机），**唯独外壳还是 t.bg 平色**——
// 元素合格、外壳裸着。区别是这一片没有现成材质可以复用（档案馆有 dossierDeskBg），
// 所以底得一页一页从【这一页里那样东西本来待在哪儿】长出来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

const skinSrc = src.slice(src.indexOf("const cpSkin = (t, kind) =>"), src.indexOf("\nfunction CoupleQABook("));
const cpSkin = new Function("return " + skinSrc.replace(/^const cpSkin = /, "").replace(/;\s*$/, ""))();
const KINDS = ["page", "wall", "album", "sill", "lining", "velvet", "corridor"];

test("一个 cpSkin 管这一片，不是一页一份 style", () => {
  assert.equal((src.match(/const cpSkin = /g) || []).length, 1);
  assert.equal((src.match(/style: cpSkin\(t, "/g) || []).length, 8,
    "铺到的页数变了：问答小本两页 / 我们的日子 / 合照 / 花房 / 旅行 / 唱片 / 情侣名册，共八处");
  KINDS.forEach(k => assert.ok(src.includes('cpSkin(t, "' + k + '")'), k + " 这一档没人用，等于白写"));
});

test("t.ink 不是六位色号时整层退回纯色，不许拼出废值", () => {
  // 深色/自定义主题里 t.ink 可能是 rgb()/颜色名，拼 + "0c" 会拼出废值，
  // 那一整条 backgroundImage 会被浏览器静默丢掉（mobile-ui-layout §3.5 那一课）
  ["rgb(20,20,20)", "black", "#333", "", undefined].forEach(ink => {
    const st = cpSkin({ ink: ink, bg: "#f7f3ea" }, "page");
    assert.equal(st.background, "#f7f3ea", String(ink) + " 没退回纯色");
    assert.equal(st.backgroundImage, undefined, String(ink) + " 还在拼图层：" + st.backgroundImage);
  });
  const ok = cpSkin({ ink: "#2b2620", bg: "#f7f3ea" }, "page");
  assert.ok(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test("#2b2620" + "0c"));
  assert.match(ok.backgroundImage, /#2b2620/, "六位色号那一支该真的铺出来");
  assert.equal(ok.background, "#f7f3ea", "底色照旧是主题色，纹理只是叠在上面");
});

test("认不出的档次不留半张脸——没有图层就只有纯色", () => {
  const st = cpSkin({ ink: "#2b2620", bg: "#f7f3ea" }, "没这一档");
  assert.equal(st.backgroundImage, "", "拼出个空 backgroundImage 也行，但不能是半截图层");
});

test("七种材质各是各的，不是同一张纹理换个名字", () => {
  const t = { ink: "#2b2620", bg: "#f7f3ea" };
  const imgs = KINDS.map(k => cpSkin(t, k).backgroundImage);
  assert.equal(new Set(imgs).size, KINDS.length, "有两档长得一模一样");
  const of = k => cpSkin(t, k).backgroundImage;
  // 每一档的签名：它凭什么是那样东西，而不是「随便找个纹理」
  assert.match(of("page"), /calc\(50% - 9px\)/, "本子翻开正中该有一道装订缝");
  assert.match(of("wall"), /0 47px/, "挂历墙是一大格一大格，不是纸的细纹");
  assert.match(of("album"), /linear-gradient\(180deg,#2b26201c/, "相册卡纸要整体压暗一档");
  assert.match(of("sill"), /rgba\(255,250,225,\.55\)/, "窗台要有斜进来的那道暖光");
  assert.match(of("lining"), /repeating-linear-gradient\(-45deg/, "行李箱内衬是斜格子，得有两个方向");
  assert.match(of("velvet"), /0 1px/, "绒面是短促的绒毛纹");
  assert.match(of("corridor"), /0 11px/, "走廊墙纸是细竖条，跟屋里那面大格墙分得开");
  // 挂历墙和走廊墙都是「墙」，但一个在屋里一个在走廊，格子宽度必须差得看得出来
  assert.notEqual(of("wall"), of("corridor"));
});

test("底纹铺在外壳上，顶栏透上来——顶上不许横一条没盖住的带子", () => {
  const seg = (name, end) => src.slice(src.indexOf(name), src.indexOf(end, src.indexOf(name)));
  const pages = [
    ["function CoupleQABook({", "\nfunction "],
    ["function CoupleDays({", "\nfunction "],
    ["function CoupleAlbum({", "\nfunction "],
    ["function CoupleGarden({", "\nfunction "],
    ["function CoupleTrip({", "\nfunction "],
    ["function CoupleDiscShelf({", "\nfunction "]
  ];
  pages.forEach(([a, b]) => {
    const s = seg(a, b);
    assert.ok(s.length > 200, a + " 切不出来了");
    const shells = s.match(/style: cpSkin\(t, "\w+"\)/g) || [];
    assert.ok(shells.length >= 1, a + " 的外壳没铺底");
    const heads = s.match(/h\(Head, \{[^\n]*?\}\)/g) || [];
    heads.forEach(hd => assert.match(hd, /bg: "transparent"/, a + " 里有顶栏还在刷平色：" + hd.slice(0, 80)));
  });
  // 情侣名册（Us）自己手写了紧凑标题栏、没走 Head，那条栏本来就没刷背景
  const ci = src.indexOf('style: cpSkin(t, "corridor")');
  assert.ok(ci > 0, "名册那一页的底没了");
  const bar = src.slice(ci, src.indexOf("overflow-y-auto", ci));
  assert.match(bar, /className: "shrink-0 flex items-center px-4 pb-2"/, "名册那条手写的紧凑栏没了");
  assert.doesNotMatch(bar, /background: t\.bg/, "名册顶栏又刷回平色了");
});

test("铺了底的这几页，正文照旧是唯一那个滚动容器", () => {
  // 外壳变成 h-full flex flex-col 之后，正文少写 min-h-0 就会把顶栏挤出屏外
  const idxs = [];
  let k = -1;
  while ((k = src.indexOf('style: cpSkin(t, "', k + 1)) >= 0) idxs.push(k);
  assert.equal(idxs.length, 8);
  idxs.forEach(i => {
    const near = src.slice(i, i + 2000);
    assert.match(near, /className: "flex-1 min-h-0 overflow-y-auto/, "这一处的正文没有 min-h-0：" + src.slice(i, i + 60));
  });
  // 内容在动、底不该动（mobile-ui-layout §3.5）
  assert.doesNotMatch(skinSrc, /backgroundAttachment/);
});
