const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "trpg.js"), "utf8");
const { trpgDeskBg, trpgHour } = require("../js/trpg.js");
const grab = (a, b, cap) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return src.slice(i, j);
};
// #rrggbb → 亮度 / 暖冷差（R−B，越大越暖）
const lum = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]; };
const warmth = hex => parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16);

// 她 2026-08-30：「现在这个米白纯背景有点无聊，让它更贴主题一点」
test("桌面不是一层纯色：羊皮纸 + 方格坐标纸 + 压边的灯", () => {
  const bg = trpgDeskBg("夜");
  assert.ok((bg.match(/repeating-linear-gradient/g) || []).length >= 3, "方格纸或纸纹没了");
  assert.match(bg, /repeating-linear-gradient\(0deg/, "横格没了");
  assert.match(bg, /repeating-linear-gradient\(90deg/, "竖格没了");
  assert.ok((bg.match(/radial-gradient/g) || []).length >= 3, "灯和压边没了");
  assert.match(bg, /linear-gradient\(168deg/, "纸底那层没了");
});

// 时辰是守密人真报的（camp.time.part），不是随手挑的滤镜
test("入夜比清晨更沉更冷，黄昏最暖", () => {
  const P = k => trpgHour(k).paper;
  const L = k => P(k).map(lum).reduce((a, b) => a + b) / 3;
  const W = k => P(k).map(warmth).reduce((a, b) => a + b) / 3;
  assert.ok(L("夜") < L("晨"), "夜里那张桌子该比清晨沉：夜 " + L("夜").toFixed(1) + " vs 晨 " + L("晨").toFixed(1));
  assert.ok(L("深夜") < L("夜"), "深夜还该更沉一点");
  assert.ok(W("夜") < W("晨"), "夜里该偏冷");
  assert.ok(W("暮") > W("晨"), "黄昏该是最暖的那一档");
  assert.ok(trpgHour("夜").dark > trpgHour("晨").dark, "越晚桌沿压得越暗");
});

test("认不出的时辰有兜底，不会画出个 undefined", () => {
  ["", null, undefined, "第七夜", "midnight"].forEach(k => {
    const bg = trpgDeskBg(k);
    assert.ok(!/undefined|NaN/.test(bg), String(k) + " 画出了 undefined");
    assert.equal(bg, trpgDeskBg("昼"), "认不出就该退回白天那一档");
  });
});

test("底真的接到界面上了，而且面板跟着一起换", () => {
  assert.match(src, /const deskBg = trpgDeskBg\(camp && camp\.time \? camp\.time\.part : ""\)/, "底没跟着时辰走");
  assert.match(src, /wrap: \{ position: "fixed", inset: 0, zIndex: 60, background: deskBg/, "整屏壳还是纯色");
  assert.match(src, /zIndex: 119, width: "82%", maxWidth: 340, background: deskBg/, "右边那块面板还是纯色");
});

// 桌面有纹理，透明按钮会糊进去
test("不填色的按钮也得垫一层纸", () => {
  const btn = grab("      btn: fill => ({", "      card: {", 700);
  assert.doesNotMatch(btn, /background: fill \? t\.ink : "transparent"/, "按钮又变透明了，在纹理上看不出是个键");
  assert.match(btn, /rgba\(255,255,255,\.6\d\)/);
});

// 她 2026-08-30：「线索和目标那块要不要也做信息分块这样容易看」
test("面板按块分：每块一个图标 + 标题 + 细线 + 正文", () => {
  const sect = grab("    const sect = (icon, title, right, hint, ...kids) =>", "    const imgSrc =", 2200);
  assert.match(sect, /borderBottom: shut \? "none" : "1px solid " \+ t\.line/, "标题和正文之间没有分隔线（收起来时不该留一条悬空的线）");
  assert.match(sect, /fontFamily: F_DISPLAY/, "块标题还是那种灰色小字，跟正文分不开");
  assert.match(sect, /h\.apply\(null, \["div", \{ style: \{ padding: "9px 11px 10px" \} \}\]\.concat\(kids\)\)/,
    "子节点要展开进 createElement，不然 React 会为数组子节点报 key 警告");
});

test("块名和块里的小标题不重复写一遍", () => {
  // ⚠这个数是【切飞了没有】的护栏，不是面板的字数预算：两头的锚点还在时它就该放行。
  // v60.71 给队伍那块加了羁绊，面板长到 23000 出头，原来那个 22000 就把整条测试判红了——
  // 冻的是「块名和小标题不重复」，不是「面板不许再长」。
  const panel = grab("      const panel = panelOpen && h(\"div\", null,", "      // 休团回来", 40000);
  assert.ok(!/S\.lbl[^)]*\}\, "名册"/.test(panel), "名册在块名和块里各写了一遍");
  assert.ok(!/S\.lbl[^)]*\}\, "物品"/.test(panel), "物品那行小标题该删——块名已经叫行囊了");
  assert.ok(!/"线索\(已知事实\)"/.test(panel), "块名已经叫线索了，里面写「已知事实」就够");
  // 一块里装了两样东西的，小标题要留着
  assert.match(panel, /S\.lbl \}, "主线"/);
  assert.match(panel, /"支线" \+ \(fixMode/);
  assert.match(panel, /S\.lbl \}, "已知事实"/);
  assert.match(panel, /S\.lbl \}, "威胁时钟"/);
});

// ── 每一块都能收起来（她 2026-08-30：「每一个都做可缩放吧，除了旅程队伍默认收起来」）──
test("八块都能收放，默认摊开的只有旅程和队伍", () => {
  const names = (src.match(/sect\("[^"]*", "([^"]+)"/g) || []).map(x => x.slice(x.lastIndexOf('", "') + 4, -1));
  assert.deepEqual(names.sort(), ["名册", "压力", "队伍", "线索", "行囊", "旅程", "目标", "骰子账", "欧非榜"].sort());
  const def = src.match(/const PANEL_OPEN_BY_DEFAULT = \[([^\]]*)\]/);
  assert.ok(def, "默认开哪几块没有一处登记");
  assert.deepEqual(def[1].split(",").map(x => x.trim().replace(/"/g, "")), ["旅程", "队伍"]);
  const sect = grab("    const sect = (icon, title, right, hint, ...kids) =>", "    const imgSrc =", 2200);
  assert.match(sect, /const shut = panelShut\[title\] != null \? !!panelShut\[title\] : PANEL_OPEN_BY_DEFAULT\.indexOf\(title\) < 0;/);
  assert.match(sect, /shut \? null : h\.apply/, "收起来了还把正文画出来");
  assert.match(sect, /onClick: \(\) => togglePanelSect\(title\)/, "表头点不动");
  assert.match(sect, /right \? h\("span", \{ onClick: e => e\.stopPropagation\(\) \}/, "表头上的按钮会连带把这一块收起来");
});

test("收起来时表头还看得见个数，不用为了瞄一眼再展开", () => {
  const panel = grab('      const panel = panelOpen && h("div", null,', "      // 休团回来", 26000);
  ["camp.clues.length + \" 条\"", "\" 件\"", "camp.npcs.length + \" 人\"", "camp.party.length + \" 人"].forEach(frag =>
    assert.ok(panel.includes(frag) || src.includes(frag), "少了一处摘要：" + frag));
});

test("收放记在存档里，下次打开还是这个样子", () => {
  const tog = grab("    const togglePanelSect = title =>", "    const [busy, setBusy]", 700);
  assert.match(tog, /lsWrite\("x_trpgPanelShut", n, /, "收放没存盘，或者绕开了统一的写盘口子");
});

// 她 2026-08-30：「行囊那栏现在只是用标点符号隔开，改成一列下来」
test("行囊一件一行，不再用顿号串起来", () => {
  const panel = grab('      const panel = panelOpen && h("div", null,', "      // 休团回来", 26000);
  assert.ok(!/itemsFix\(camp\.items\)\.map\(fmtItem\)\.join\("、"\)/.test(panel), "又串回一行了");
  assert.match(panel, /itemsFix\(camp\.items\)\.map\(\(it, i\) => h\("div"/, "没有逐件成行");
  assert.match(panel, /it\.n > 1 \? h\("span"/, "数量没单独拎出来");
  assert.match(panel, /it\.holder && it\.holder !== "队伍"/, "持有人没单独拎出来");
});

test("骰子账也成了一块，自己那个开关删干净了", () => {
  assert.match(src, /sect\("🎲", "骰子账", null, rolls\.length \+ " 次"/);
  assert.ok(!/diceOpen/.test(src), "旧的 diceOpen 还留着，两套开关会打架");
});

// ── 主页那两种卡（她：「框也还是有点无聊，做点有创意的」）──
test("战役卡：骰面上刻着第几章、底下一排章节点、落幕盖个戳", () => {
  const card = grab("    const campCard = c => {", "    // ---- 组建队伍", 6000);
  assert.match(card, /viewBox: "0 0 40 44"/, "那枚二十面骰没了");
  assert.match(card, /fontSize: 17, fontWeight: 600, color: seal \} \}, String\(cur\)\)/, "骰面上没刻章数");
  assert.match(card, /c\.stages\.map\(\(st, i\) => \{/, "章节点没了");
  assert.match(card, /const passed = st\.done \|\| c\.ended;/);
  assert.match(card, /transform: "rotate\(-11deg\)"[\s\S]{0,200}"落幕"/, "落幕那枚戳没了");
  // 封面从整张背景挪成右边贴的一张相片——原来那层厚渐变把图盖掉了大半
  assert.match(card, /inset: "0 0 0 auto", width: "58%"/, "封面又铺回整张背景了");
  assert.ok(!/minHeight: 96/.test(card), "旧的封面铺法还留着");
});

test("小分队卡：五项属性画成五根柱子，还带表头", () => {
  const sb = grab("    const statBars = (stats, col) =>", "    const plusSheet", 4000);
  assert.match(sb, /STATS\.map\(\(\[k, zh\]\) => h\("span"/, "柱子不是按 STATS 生成的");
  assert.match(sb, /height: Math\.max\(3, Math\.round\(\(\(stats \|\| \{\}\)\[k\] \|\| 0\) \/ 90 \* 18\)\)/, "柱子高度没按属性值来");
  assert.match(sb, /fontSize: 7\.5, color: t\.fog \} \}, zh\[0\]\)/, "五根柱子没有表头，认不出哪根是哪项");
  assert.ok(!/STATS\.map\(\(\[k, zh\]\) => zh \+ \(v\.stats \|\| \{\}\)\[k\]\)\.join\(" "\)/.test(sb), "旧的那串数字还堆在那儿");
});
