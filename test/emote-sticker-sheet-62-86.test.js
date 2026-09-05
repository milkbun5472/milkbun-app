// 审美审计（AUDIT-AESTHETIC-2026-09-04）还债⑥第一样：表情包。
//
// 审计点名这一页「同一页同时踩英文眉标、基础款药丸两条铁律」，而且外壳还是米白：
//   三条 Archivo 英文眉标（CATEGORIES / SPECIFIC CAST / MATRIX GALLERY / BATCH IMPORT）
//   一排包名药丸（选中就填个 t.ink）
//   底下 Delete Matrix / Import Matrix / CLOSE MATRIX 三颗英文钮，还有 GLOBAL 药丸
// 这一页现实里是【一版一版还没撕的贴纸】，所以底是离型纸、换字典是翻那一版贴纸的角。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const seg = src.slice(src.indexOf("const RELEASE_PAPER = t =>"), src.indexOf("function importEmotesOk("));
const paperSrc = src.slice(src.indexOf("const RELEASE_PAPER = t =>"), src.indexOf("\nconst STICKER_PAPER"));
const RELEASE_PAPER = new Function("return " + paperSrc.replace(/^const RELEASE_PAPER = /, "").replace(/;\s*$/, ""))();

test("底是离型纸，铺在外壳上，顶栏透上来", () => {
  assert.match(seg, /className: "h-full flex flex-col", style: RELEASE_PAPER\(t\)/, "外壳没铺离型纸");
  assert.match(seg, /h\(Head, \{ zh: "表情包",[^\n]*bg: "transparent"/, "顶栏还在刷平色");
  assert.match(seg, /className: "flex-1 min-h-0 overflow-y-auto/, "正文不是唯一那个滚动容器");
  assert.doesNotMatch(seg, /backgroundAttachment/, "内容在动、底不该动");
});

test("t.ink 不是六位色号时整层退回纯色", () => {
  ["rgb(10,10,10)", "black", "#333", "", undefined].forEach(ink => {
    const st = RELEASE_PAPER({ ink: ink, bg: "#f7f3ea" });
    assert.equal(st.background, "#f7f3ea", String(ink) + " 没退回纯色");
  });
});

test("离型纸的三样：四角裁切标记 / 极淡网格 / 蜡光斜反光，最后压主题底色", () => {
  const bg = RELEASE_PAPER({ ink: "#2b2620", bg: "#f7f3ea" }).background;
  // 裁切标记：四个角各一横一竖，八条
  assert.equal((bg.match(/no-repeat/g) || []).length, 8, "裁切标记不是八条");
  ["left 15px top 13px", "right 15px top 13px", "left 15px bottom 13px", "right 15px bottom 13px"]
    .forEach(p => assert.ok(bg.includes(p), "少一个角：" + p));
  assert.match(bg, /\/13px 1px/, "角标缺那条横线");
  assert.match(bg, /\/1px 13px/, "角标缺那条竖线");
  assert.match(bg, /repeating-linear-gradient\(90deg/, "缺网格");
  assert.match(bg, /repeating-linear-gradient\(180deg/, "缺网格");
  assert.match(bg, /linear-gradient\(158deg,rgba\(255,255,255,\.46\)/, "缺蜡光纸那道斜反光");
  // shorthand 多层时底色只能落在最后一层
  assert.ok(/,#f7f3ea$/.test(bg), "主题底色没压在最后一层：" + bg.slice(-40));
});

test("换字典是翻那一版贴纸的角，不是一排药丸", () => {
  // 选中／没选中至少差【三样】：高度、白边、投影——只差一个填色的是基础款
  assert.match(seg, /height: on \? 76 : 62/, "选中那版没有更高");
  assert.match(seg, /border: \(on \? 3 : 1\) \+ "px solid " \+ \(on \? "#fff" : t\.line\)/, "缺 die-cut 白边");
  assert.match(seg, /boxShadow: on \? "0 7px 15px rgba\(0,0,0,\.20\)" : "none"/, "选中那版没翘起来");
  assert.match(seg, /paddingTop: on \? 0 : 10, paddingBottom: on \? 10 : 0/, "没选的那几版没往下缩");
  // 可点区不低于 40px（tabs-not-plain-pills 第 1 条）：最矮的一版 62 + 10
  assert.ok(62 + 10 >= 40);
  assert.doesNotMatch(seg, /borderRadius: 999, border: "1px solid " \+ \(p\.id ===/, "包名药丸还在");
});

test("每张表情是一张贴纸：白描边 + 投影 + 按 id 定死的一点点歪", () => {
  assert.match(seg, /border: "3px solid " \+ \(on \? t\.accent : "#fff"\)/, "贴纸没有 die-cut 白边");
  assert.match(seg, /transform: on \? "none" : "rotate\(" \+ stickerTilt\(em\.id\) \+ "deg\)"/, "挑中那张没被按平");
  const tiltSrc = src.slice(src.indexOf("const stickerTilt ="), src.indexOf("\nfunction EmoteMatrix"));
  const stickerTilt = new Function("qhash", "return (" + tiltSrc.slice(tiltSrc.indexOf("id =>")).replace(/;\s*$/, "") + ")")(
    s => { let x = 0; for (let i = 0; i < s.length; i++) { x = (x * 31 + s.charCodeAt(i)) | 0; } return (x >>> 0).toString(36); });
  // 同一个 id 每次都得是同一个角度，否则滚一下整页贴纸都在抖
  assert.equal(stickerTilt("a3"), stickerTilt("a3"));
  // ⚠️拿【真实形状】的 id 来问，而且要拿【同一版里挨着的那一批】——
  //   自带的那版是 "em_def_" + i（app.js:215），批量导入的是 "em_" + Date.now() + "_" + 随机。
  //   随手编几个短 id 是分得开的，真 id 分不开——那条断言就是白写的（stub-from-the-writer.md）。
  //   同一批 id 的哈希值只在低位上分得开：按首位取的话自带那一版整页歪成同一个角度，
  //   而且不报任何错。所以这里专挑挨着的那六个问。
  assert.match(fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8"), /id: "em_def_" \+ i/, "自带表情的 id 不长这样了，这条断言要跟着改");
  const near = ["em_def_0", "em_def_1", "em_def_2", "em_def_3", "em_def_4", "em_def_5"];
  const angles = new Set(near.map(stickerTilt));
  assert.ok(angles.size >= 3, "同一版里挨着的六张歪成同一个角度，等于没歪：" + [...angles].join(","));
  const far = ["em_1756000000000_12345", "em_1756000000001_54321", "em_1756000000002_98765"];
  assert.ok(new Set(far.map(stickerTilt)).size >= 2);
  [...angles].forEach(a => assert.ok(Math.abs(a) <= 3, "歪过头了：" + a));
});

test("贴纸是白的，贴纸上的字色也得写死——不许跟着 t.ink 走", () => {
  // 深色主题里 t.ink 是浅色，写在白贴纸上就是白底浅字（v59.62 那一课）
  assert.match(src, /const STICKER_PAPER = "#fbf8f0", STICKER_INK = "#2f2a22";/);
  const white = seg.split("\n").filter(l => l.includes("STICKER_PAPER"));
  assert.ok(white.length >= 3, "白贴纸只有 " + white.length + " 处？");
  white.forEach(l => assert.ok(!/color: t\.ink/.test(l), "白贴纸上写了 t.ink：" + l.trim().slice(0, 90)));
  // 开关的把手同理：写死 #fff 的话，深色主题里 t.ink 也是浅的，把手就看不见了
  assert.doesNotMatch(seg, /borderRadius: 999, background: "#fff", transition: "left/, "开关把手还写死 #fff");
  assert.match(seg, /background: t\.bg, transition: "left \.2s"/);
  // 粘贴框原来写死 background:"#fff" 配 color:t.ink——深色主题下打的字自己看不见
  assert.doesNotMatch(seg, /color: t\.ink, background: "#fff"/, "粘贴框还是白底");
});

test("这一页一个英文都不剩", () => {
  // no-english-titles：眉标全换成「这一栏在干嘛」，不是把英文译回来
  ["CATEGORIES", "SPECIFIC CAST", "MATRIX GALLERY", "BATCH IMPORT", "GLOBAL", "Global Access",
    "Delete Matrix", "Import Matrix", "CLOSE MATRIX", "Emote Matrix", "Archivo"]
    .forEach(w => assert.ok(!seg.includes(w), "这一页还留着：" + w));
  ["手里这几版", "这版只给谁用", "这一版上贴着的", "往这版上贴新的"].forEach(zh =>
    assert.ok(seg.includes(zh), "少了这条中文眉标：" + zh));
  ["新开一版", "挑几张", "贴上去", "撕掉这一版"].forEach(zh =>
    assert.ok(seg.includes(zh), "少了这颗中文钮：" + zh));
  // 底下那颗 CLOSE MATRIX 是纯多余的（顶栏已经有返回键），撤掉就删掉，不是留着改文案
  assert.doesNotMatch(seg, /onClick: onBack, className: "w-full/, "底部那颗全宽返回钮还在");
});
