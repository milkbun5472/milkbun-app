// 她 2026-09-13（带着截图）：「塔罗这边带回聊天有点问题。第一它不是一张卡，
// 只是聊天记录灌进上下文；第二牌和解析没跟上」。
//
// 截图里那一段就是这么来的：带回聊天只搬了小桌边追问的那几句，
// 前面一句「你们把刚才在塔罗店小桌边围绕这副牌说的话带回了聊天」是个光秃秃的气泡，
// **牌面、逐张解读、收束一个字都没进去**——她看不见牌，他回头聊这副牌时手上也什么都没有。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

// 真跑 tarotShareMsg：桩照【塔罗那头真正存的那几栏】给
// （tarot.js：cards[{name,rev}] / spread[] / reads[{pos,text}] / summary / question）
const mkShare = () => {
  const i = app.indexOf("  const tarotShareMsg = (session, note) => {");
  const j = app.indexOf("  // 塔罗「给角色算一卦」转发给对应角色", i);
  assert.ok(i > 0 && j > i, "抠不出 tarotShareMsg");
  return new Function(app.slice(i, j) + "\nreturn tarotShareMsg;")();
};
const SESSION = {
  question: "这三天的考试我该怎么复习",
  spread: ["此刻的处境", "眼前的阻碍", "给你的指引"],
  cards: [{ name: "宝剑八", rev: false }, { name: "星币七", rev: true }, { name: "节制", rev: false }],
  reads: [{ pos: "此刻的处境", text: "你被自己捆住了。" }, { pos: "眼前的阻碍", text: "在细节上耗太久。" },
    { pos: "给你的指引", text: "分清轻重。" }],
  summary: "抓大放小，先过线。"
};

test("牌和解析跟着一起进上下文：content 里三样都在", () => {
  const msg = mkShare()(SESSION, "小桌边这副牌");
  assert.equal(msg.kind, "tarotshare");
  assert.ok(msg.content.includes("此刻的处境：宝剑八（正位）"), "牌面没进上下文");
  assert.ok(msg.content.includes("眼前的阻碍：星币七（逆位）"), "正逆没跟上");
  assert.ok(msg.content.includes("在细节上耗太久。"), "逐张解读没进上下文");
  assert.ok(msg.content.includes("抓大放小，先过线。"), "收束没进上下文");
  assert.ok(msg.content.includes("这三天的考试我该怎么复习"), "问的是什么也得在");
  assert.ok(msg.content.indexOf("【塔罗 · 小桌边这副牌】") === 0);
});

test("卡面那一格是给她看的：牌、位置、正逆、收束都在 tarot 里", () => {
  const d = mkShare()(SESSION, "我替你算了一卦").tarot;
  assert.equal(d.note, "我替你算了一卦");
  assert.equal(d.q, "这三天的考试我该怎么复习");
  assert.deepEqual(d.cards, [
    { pos: "此刻的处境", name: "宝剑八", rev: false },
    { pos: "眼前的阻碍", name: "星币七", rev: true },
    { pos: "给你的指引", name: "节制", rev: false }]);
  assert.equal(d.summary, "抓大放小，先过线。");
  // 缺栏的旧存档不许炸
  const empty = mkShare()({}, "");
  assert.deepEqual(empty.tarot.cards, []);
  assert.equal(empty.tarot.q, "");
  assert.ok(empty.content.indexOf("【塔罗】") === 0);
});

test("带回聊天：先落这张卡，再落那句话和小桌边那几句", () => {
  const seg = app.slice(app.indexOf("const forwardTarotToChat"), app.indexOf("// ───────── 擂台"));
  assert.match(seg, /const card = tarotShareMsg\(session, "小桌边这副牌"\);/);
  assert.match(seg, /pChat\(chatKey, p => \[\.\.\.p, cardMsg, intro, \.\.\.moved\]\)/, "卡没排在最前面（或者压根没落）");
  // 时刻要错开，不然三样挤在同一毫秒里排序不稳
  assert.match(seg, /ts: movedAt \+ 1, read: false \}/);
  assert.match(seg, /ts: Number\(x\.ts\) \|\| movedAt \+ 2 \+ i/);
  // 「我替你算了一卦」那一路也换成同一张卡，不再是一段光秃秃的文字
  assert.match(seg, /const card0 = tarotShareMsg\(session, "我替你算了一卦"\);/);
  assert.ok(!seg.includes("const shareText ="), "旧的那段纯文字还在，两处又长成两个样子了");
  // ⚠️底下那一枪还在用 summary/cardsTxt/readTxt——改卡的时候别把它们连坐删掉
  assert.match(seg, /const summary = session\.summary \|\| "";/);
  assert.match(seg, /"有人（用户）替你算了一卦塔罗[\s\S]{0,80}牌：" \+ cardsTxt/);
});

test("卡面：单聊和群聊两处都认得它，骨架跟同人文那一族一样", () => {
  assert.match(comp, /function TarotShareCard\(\{ m, isU \}\) \{/);
  // 两处渲染器各一条——只接一处的话，另一处就又是一串光秃秃的气泡
  assert.equal((comp.match(/m\.kind === "tarotshare"/g) || []).length, 2, "两个渲染器里没有各接一条");
  assert.match(comp, /h\(TarotShareCard, \{ m: m, isU: m\.role === "user" \}\)/);
  // 同一族：宽度、圆角、卡面挂点跟 FicShareCard 一样（换的是材质，不是骨架）
  const seg = comp.slice(comp.indexOf("function TarotShareCard"), comp.indexOf("function FicShareCard"));
  assert.match(seg, /"data-wk": "card", "data-kind": "tarotshare", style: \{ width: 242, borderRadius: 14/);
  // v68.91：正逆不再靠「（逆位）」三个字说，逆位的牌是【真的倒过来】的
  assert.match(seg, /transform: c\.rev \? "rotate\(180deg\) scale\(1\.02\)" : "scale\(1\.02\)"/, "逆位没倒过来");
  assert.match(seg, /\}, "逆"\) : null\)/, "逆位角上那枚小戳没了");
});

// ── v68.91：把它做成【真的那几张牌】（她 2026-09-16：「做好看点」）─────────
// v67.67 那一版是基础款：米白底、一行眉标、三行灰字列着「过去 · 星星（正位）」。
// 换成读书笔记、换成一张收据照样成立——它没长在「这是一副摊开的牌」这件事上。
// 跟礼物卡那次一模一样的病（那次的解法是：让它真的成为一个盒子）。
test("牌面从 tarot.js 借，别在卡里照着牌库再抄一份", () => {
  const tarot = fs.readFileSync(path.join(root, "js/tarot.js"), "utf8");
  assert.match(tarot, /Tarot\.cardImage = cardImage;/);
  assert.match(tarot, /Tarot\.NIGHT = NIGHT_BASE;/);
  const seg = comp.slice(comp.indexOf("const TAROT_TILT"), comp.indexOf("function FicShareCard"));
  assert.match(seg, /const imgOf = c => \(T && T\.cardImage\) \? T\.cardImage\(c\) : "";/);
  assert.match(seg, /const N = \(T && T\.NIGHT\) \|\|/, "夜色也该借，不另调一套");
  // components.js 比 tarot.js 先加载，所以只能在【画的时候】问它要——不许在模块顶上取
  assert.ok(!/^const\s+\w+\s*=\s*window\.Tarot/m.test(seg), "在模块顶上取 window.Tarot，加载顺序上拿不到");
  assert.ok(seg.indexOf("assets/tarot-rws") < 0, "卡里自己拼了牌图路径，换牌图就得改两处");
});

test("牌库查得到：转发只存了牌名，查不到图这张卡就是空的", () => {
  const tarot = fs.readFileSync(path.join(root, "js/tarot.js"), "utf8");
  const i = tarot.indexOf("  const MAJORS"), j = tarot.indexOf("  const cardLabel =");
  const T = new Function(tarot.slice(i, j) + "\nreturn { cardImage, DECK };")();
  assert.equal(T.DECK.length, 78);
  // 落盘那头存的就是 DECK 里的名字（tarotShareMsg: name: String(c.name)）
  ["星星", "高塔", "圣杯二", "权杖国王", "愚者"].forEach(n =>
    assert.match(T.cardImage({ name: n }), /^assets\/tarot-rws\/.+\.jpg$/, n + " 查不到牌面"));
  // 查不到也不能炸：卡里退回一个 ✦
  assert.equal(T.cardImage({ name: "不存在的牌" }), "");
  const seg = comp.slice(comp.indexOf("const TAROT_TILT"), comp.indexOf("function FicShareCard"));
  assert.match(seg, /imgOf\(c\) \? h\("img"/, "没图的时候没有退路");
  assert.match(seg, /\\u2726/, "退路那个符号没了");
});

test("摊开的样子：牌歪一点、牌位在牌底下、牌多了自己变窄", () => {
  const seg = comp.slice(comp.indexOf("const TAROT_TILT"), comp.indexOf("function FicShareCard"));
  assert.match(comp, /const TAROT_TILT = \[-3\.5, 2\.2, -1\.4, 3, -2\.2, 1\.6\];/, "手摊出来的牌不会排得笔直");
  assert.match(seg, /transform: "rotate\(" \+ \(TAROT_TILT\[k % TAROT_TILT\.length\]\) \+ "deg\)"/);
  // 六张也得塞进这 242
  assert.match(seg, /const cw = cards\.length >= 5 \? 33 : cards\.length === 4 \? 38 : cards\.length === 3 \? 44 : 50;/);
  assert.match(seg, /cards\.slice\(0, 6\)/);
  assert.match(seg, /c\.pos \? h\("div"/, "牌位没写在牌底下");
});
