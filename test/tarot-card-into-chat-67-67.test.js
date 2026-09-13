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

test("卡面：单聊和群聊两处都认得它，长相照同人文那张来", () => {
  assert.match(comp, /function TarotShareCard\(\{ m, isU \}\) \{/);
  // 两处渲染器各一条——只接一处的话，另一处就又是一串光秃秃的气泡
  assert.equal((comp.match(/m\.kind === "tarotshare"/g) || []).length, 2, "两个渲染器里没有各接一条");
  assert.match(comp, /h\(TarotShareCard, \{ m: m, isU: m\.role === "user" \}\)/);
  // 同一种东西同一种卡面：宽度、圆角、卡面挂点跟 FicShareCard 一样
  const seg = comp.slice(comp.indexOf("function TarotShareCard"), comp.indexOf("function FicShareCard"));
  assert.match(seg, /"data-wk": "card", style: \{ width: 242, borderRadius: 14/);
  assert.match(seg, /c\.rev \? "（逆位）" : "（正位）"/, "卡面上看不出正逆");
});
