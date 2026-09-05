// 审美审计（AUDIT-AESTHETIC-2026-09-04）还债⑥第三样：钱包两页。
//
// 审计：外壳 t.bg 平色、两页各自手写顶栏，正文是「深色渐变银行卡 + 一堆圆角卡 +
// 流水列表」——所有记账 app 的首页，原样搬走照样成立；还留着 Wallet / RUNNING /
// 流水 · LEDGER 几处英文和 'Archivo' 日期。
//
// 这一页现实里不是一个记账 app，是【翻开一个皮夹】。
// ⚠️记账那一页（ledger.js）已经是账簿纸，那是另一样东西——审计原话点名过
//   「纸上摆错物件：记账是账簿纸，纸上摆的却是银行卡」。这两页不许再撞成账簿。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const seg = src.slice(src.indexOf("const LEATHER = t =>"), src.indexOf("// 表情包字典 Emote Matrix"));
const leatherSrc = src.slice(src.indexOf("const LEATHER = t =>"), src.indexOf("\n// 卡插在卡位里"));
const LEATHER = new Function("return " + leatherSrc.replace(/^const LEATHER = /, "").replace(/;\s*$/, ""))();

test("六层外壳全铺皮革内衬，顶栏透上来，正文是唯一那个滚动容器", () => {
  // 我的钱包 / 亲属卡 / 角色钱包空态 / 花名册 / 生成中 / 单角色详情
  assert.equal((seg.match(/style: LEATHER\(t\)/g) || []).length, 6, "有页没铺");
  assert.equal((seg.match(/bg: "transparent"/g) || []).length, 5, "有顶栏还在刷平色");
  assert.equal((seg.match(/className: "flex-1 min-h-0 overflow-y-auto/g) || []).length, 4);
  assert.ok(!/className: "flex-1 overflow-y-auto/.test(seg), "有正文少了 min-h-0");
  // 两页原来各自手写了一条 20px paddingTop 的顶栏（mobile-ui-layout §1 点名不许）
  assert.ok(!/paddingTop: safeTop\(20\), background: t\.bg2/.test(seg), "手写顶栏还在");
  assert.doesNotMatch(leatherSrc, /backgroundAttachment/);
});

test("t.ink 不是六位色号时整层退回纯色", () => {
  ["rgb(3,3,3)", "navy", "#eee", "", undefined].forEach(ink =>
    assert.equal(LEATHER({ ink: ink, bg: "#f7f3ea" }).background, "#f7f3ea", String(ink) + " 没退回纯色"));
});

test("皮革是细颗粒 + 顺着两条长边的明线缝线 + 四边压暗", () => {
  const bg = LEATHER({ ink: "#2b2620", bg: "#f7f3ea" }).background;
  assert.match(bg, /repeating-linear-gradient\(27deg/, "缺一个方向的颗粒");
  assert.match(bg, /repeating-linear-gradient\(-51deg/, "颗粒只有一个方向");
  // ⚠️缝线必须【竖着】走：外壳把顶栏也包在里面，横着钉要么被顶栏盖住、
  //   要么掉到页尾变成一条莫名其妙的虚线（两种都试过了）
  assert.match(bg, /no-repeat left 11px top 0\/1px 100%/, "左边那道缝线没了");
  assert.match(bg, /no-repeat right 11px top 0\/1px 100%/, "右边那道缝线没了");
  assert.ok(!/top 9px\/100% 1px/.test(bg) && !/bottom 14px\/100% 1px/.test(bg), "缝线又横过来了");
  assert.match(bg, /radial-gradient\(120% 80% at 50% 46%/, "缺四边压暗");
  assert.ok(/,#f7f3ea$/.test(bg), "主题底色没压在最后一层");
});

test("余额是夹层里的一叠钱，不是又一张通用渐变银行卡", () => {
  // v60.45 才把那张「深色渐变 + 白字」的通用卡从这个 app 里拆掉（kinship-card-face-60-45
  // 钉着这条）。改这两页时第一版把它原样搬了回来，是那条测试当场拦下的。
  assert.ok(!/linear-gradient\(135deg,#2f3a42,#171d21\)/.test(seg), "老那张通用渐变卡又回来了");
  assert.ok(!/linear-gradient\(135deg," \+ \(char\.color/.test(seg), "详情页那张渐变卡还在");
  assert.equal((seg.match(/noteStack\(/g) || []).length, 2, "我的钱包和角色钱包都要用这一叠");
  const note = src.slice(src.indexOf("const noteFace ="), src.indexOf("const noteStack ="));
  assert.match(note, /repeating-linear-gradient\(48deg/, "钞票缺防伪细纹");
  assert.match(note, /repeating-linear-gradient\(-48deg/, "防伪纹只有一个方向，那是布不是钞票");
  assert.match(note, /position: "absolute", left: 6, right: 6, top: 6, bottom: 6, border: "1px solid " \+ NOTE_LINE/, "钞票的内框没了");
  // 一叠：后面两张错开一点
  const stack = src.slice(src.indexOf("const noteStack ="), src.indexOf("// 皮夹里的一格隔层"));
  assert.equal((stack.match(/"aria-hidden": "true"/g) || []).length, 2, "叠的不是三张");
  // ⚠️垫在后面的两张必须写在【最上面那张之前】，靠 DOM 顺序压住；
  //   用负 z-index 会被外壳自己的底盖掉（抽卡那一叠踩过这个坑）
  assert.ok(stack.indexOf('"aria-hidden": "true"') < stack.indexOf("noteFace(kids)"), "垫的两张写到上面那张后头去了");
  assert.ok(!/zIndex: -/.test(stack), "用了负 z-index");
});

test("钞票纸色写死，钞票上的字色也一起写死", () => {
  assert.match(src, /const NOTE_PAPER = "#ece4d0", NOTE_INK = "#3c3524", NOTE_FOG = "#8c7f62", NOTE_LINE = "rgba\(90,74,44,\.34\)";/);
  // 深色主题里 t.ink 是浅色，写在浅钞票上就是浅纸浅字（v59.62 那一课）；
  // 反过来写死 #fff 也一样错——这一版之前那张深色卡上就全是写死的白字
  const stacks = seg.split("noteStack(").slice(1).map(x => x.slice(0, 1100));
  assert.equal(stacks.length, 2);
  stacks.forEach(x => {
    assert.ok(/color: NOTE_INK/.test(x) && /color: NOTE_FOG/.test(x), "钞票上没用写死的字色");
    assert.ok(!/color: t\.(ink|fog|sub)\b/.test(x), "钞票上写了主题色");
    assert.ok(!/color: "#fff"|rgba\(255,255,255/.test(x), "钞票上还留着老那张深色卡的白字");
  });
});

test("每块是撕下来的单据、每笔流水是一张小票，两种撕口不一样", () => {
  const slip = src.slice(src.indexOf("const slipSkin ="), src.indexOf("\nfunction MyWallet"));
  const rcpt = src.slice(src.indexOf("const receiptSkin ="), src.indexOf("// 从卷筒上撕下来的一张单据"));
  // 缺口处要真的透出底下的皮革：底色 transparent + 缺口是 transparent
  [slip, rcpt].forEach(x => assert.match(x, /background: "transparent"/, "缺口透不出皮革"));
  assert.equal((slip.match(/radial-gradient\(circle at/g) || []).length, 1, "单据是从卷筒上撕的，只有顶边一排撕口");
  assert.equal((rcpt.match(/radial-gradient\(circle at/g) || []).length, 2, "小票是撕下来的一小条，上下两边都该有撕口");
  assert.match(rcpt, /circle at 4px 100%/, "小票底边那排撕口没了");
  // 圆角卡一处不留：单据和小票都是方角
  assert.ok(!/borderRadius: 16, border: "1px solid " \+ t\.line \} \}, kids\)/.test(seg), "旧那张圆角卡还在");
  assert.equal((seg.match(/slipSkin\(t\)/g) || []).length, 3);
  assert.match(seg, /transform: "rotate\(" \+ tiltById\(e\.id\) \+ "deg\)" \}, receiptSkin\(t\)\)/, "小票一张都不歪");
});

test("花名册是一格一格的隔层，有钱那格露出一张钞票的上缘", () => {
  const pk = src.slice(src.indexOf("// 皮夹里的一格隔层"), src.indexOf("// 一张小票"));
  assert.match(pk, /borderTop: "1px dashed " \+ t\.line/, "隔层上缘那道缝线没了");
  assert.match(pk, /hasMoney \? h\("span"/, "空的那格也露出钱来了");
  // 露的是钞票的上缘：只有半格宽、带钞票自己的边框，不是横贯整行的色带
  assert.match(pk, /width: "44%"/, "又变回横贯整行的色带了");
  assert.match(pk, /border: "1px solid " \+ NOTE_LINE, borderBottom: "none"/);
  assert.match(seg, /pocketRow\(t, open,/);
  assert.ok(!/borderBottom: "1px solid " \+ t\.line \} \},\s*\n\s*h\(Avatar, \{ character: c, size: 50/.test(seg), "旧那条分割线行还在");
});

test("这两页的英文清干净了", () => {
  // 只问【会显示出来的字】：MyWallet / CharWallet 是函数名，不是页面上的字
  const shown = seg.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  ['en: "Wallet', '"RUNNING"', '"流水 · LEDGER"', "'Archivo',sans-serif", 'Wallet · 选择角色'].forEach(w =>
    assert.ok(!shown.includes(w), "还留着：" + w));
  assert.match(seg, /"夹层里的小票"/, "「流水 · LEDGER」该换成说得清的中文");
  assert.match(seg, /zh: char\.remark \|\| char\.name, sub: "钱包"/);
});
