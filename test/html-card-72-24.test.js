// 世界书卡片：模型吐一整块 HTML，画成卡而不是把尖括号念一遍（她 2026-09-20 提）
//
// 这份测试盯三样东西，每一样都是真出过事的形状：
//   ① 认得准——句子里夹个尖括号不算卡片，半截标签不算卡片。
//   ② 【沙盒不许破】：allow-scripts 给、allow-same-origin 不许给。两个一起给等于没沙盒，
//      那段 HTML 就能读 localStorage 里的 API key。这条是这个功能的全部安全性所在。
//   ③ 行内引用那几处不许出卡片（「某某：一句话」那种行会被撑烂）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// 认卡片那一层住在 engine.js（拆气泡的流水线在那儿，比 UI 低一层）
const load = () => {
  const a = eng.indexOf("const HTML_CARD_MIN = ");
  const b = eng.indexOf("function splitLongBubble(", a);
  assert.ok(a > 0 && b > a, "抠不出 htmlCardOf 那一段");
  const src = eng.slice(a, b) + "\nreturn { htmlCardOf, splitCardsAndLines };";
  return new Function(src)();
};
const { htmlCardOf, splitCardsAndLines } = load();
// 画卡那两个还在 components.js
const loadUI = () => {
  const a = comp.indexOf("// 卡片自己报身高");
  const b = comp.indexOf("function TransText(", a);
  assert.ok(a > 0 && b > a, "抠不出 HtmlCard 那一段");
  const src = "const htmlCardOf = () => null;" + comp.slice(a, b) + "\nreturn { htmlCardDoc, HTML_CARD_BOOT };";
  return new Function(src)();
};
const { htmlCardDoc } = loadUI();

// 桩照【真的会喂进来的东西】写：这是她拿来的那份世界书模板里的高考成绩单卡，
// 原样保留单行、内联 style、onclick 和尾巴上的 <style>（施工规则/stub-from-the-writer.md）
const REAL_CARD = '<div id="gaokao-report-container" style="max-width: 400px; margin: 10px auto;'
  + ' background-color: #d9f3f0; border-radius: 20px;"><div style="padding: 20px; text-align: center;">'
  + '<div style="font-size: 24px;">高考成绩通知单</div></div><div style="padding: 0 25px 20px;">'
  + '<div style="font-size: 60px;">687</div>'
  + '<button onclick="const p=document.getElementById(\'secret-demand\');'
  + 'p.style.display=p.style.display===\'none\'?\'block\':\'none\';">查看回信</button>'
  + '<div id="secret-demand" style="display:none;">要求同城大学</div></div></div>'
  + '<style>@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }</style>';

test("认得出真世界书卡片", () => {
  assert.equal(htmlCardOf(REAL_CARD), REAL_CARD.trim());
  assert.ok(htmlCardOf("<!DOCTYPE html><html><body><div>" + "x".repeat(90) + "</div></body></html>"));
});

test("句子里夹尖括号、半截标签，都不当卡片", () => {
  assert.equal(htmlCardOf("我今天<3你"), null);
  assert.equal(htmlCardOf("<哭>"), null);
  // 长，但根本不是以元素起头——是一句普通的话
  assert.equal(htmlCardOf("他说 a<b 的时候我就知道要出事了，" + "然后果然出事了。".repeat(8)), null);
  // 以 <div 起头但没有任何闭合标签：半截输出，画出来是坏的
  assert.equal(htmlCardOf('<div style="' + "x".repeat(120) + '"'), null);
  assert.equal(htmlCardOf(""), null);
  assert.equal(htmlCardOf(null), null);
});

test("⚠️沙盒：allow-scripts 给，allow-same-origin 绝不许给", () => {
  const i = comp.indexOf("function HtmlCard(");
  const j = comp.indexOf("function TransText(", i);
  assert.ok(i > 0 && j > i, "抠不出 HtmlCard");
  const body = comp.slice(i, j);
  // 只看这个属性【写了什么值】，不扫整段正文——注释里提到这个词是合法的
  const sb = body.match(/sandbox:\s*"([^"]*)"/);
  assert.ok(sb, "HtmlCard 没写 sandbox");
  assert.equal(sb[1], "allow-scripts", "给了 allow-same-origin＝沙盒等于没有，卡片能读 localStorage");
});

test("⚠️CSP 把出网掐死：读不到东西，也送不出去", () => {
  const doc = htmlCardDoc("<div>hi</div>", "tok1");
  assert.match(doc, /default-src 'none'/);
  assert.match(doc, /Content-Security-Policy/);
  // 按钮要能按，所以脚本和样式放行；但图片只许 data:/blob:，不许外链信标
  assert.match(doc, /script-src 'unsafe-inline'/);
  assert.match(doc, /img-src data: blob:/);
  assert.ok(!/connect-src/.test(doc) || !/connect-src [^;"]*https/.test(doc), "不许放行外部 connect");
});

test("卡片自己报身高，且只认自己那张的 token", () => {
  const doc = htmlCardDoc("<div>hi</div>", "tokA");
  assert.match(doc, /wkCard:"tokA"/);
  assert.ok(doc.indexOf("postMessage") > 0);
});

test("行内引用那几处传了 inline，不出卡片", () => {
  const i = comp.indexOf("function TransText({ text, isU, zhReady, ink, inline })");
  assert.ok(i > 0, "TransText 没收 inline");
  const head = comp.slice(i, i + 700);
  assert.match(head, /inline \? null : /);
  // 光算出 _card 不算数，得真的画出去（这条是变异测出来补的：删掉这一行原来全绿）
  assert.match(head, /return h\(HtmlCard, \{ html: _card \}\)/);
  // 线下引用那两行 + 查手机摘录：三处都得标上
  const quoted = comp.match(/h\(TransText, \{ text: l\.content[^)]*inline: true \}\)/g) || [];
  assert.equal(quoted.length, 2, "线下引用那两处没标 inline");
  assert.match(phone, /h\(TransText, \{ text: s, ink: "currentColor", inline: true \}\)/);
});

// ⚠️真机抓到的：高度自己往上爬 258→260→262…（2026-09-20）
// 病根是量错了对象＋加了余量：body 的 scrollHeight 至少等于视口高＝iframe 高，
// 而 iframe 高是我们刚设的，于是「设高→量到更高→再设更高」。
// 所以这两条一起钉死：量 wk-wrap（内容层），且一个像素余量都不许加。
test("量的是内容层 wk-wrap，不是 body/documentElement", () => {
  const i = comp.indexOf("const HTML_CARD_BOOT = ");
  const j = comp.indexOf("const HTML_CARD_CSP = ", i);
  assert.ok(i > 0 && j > i, "抠不出 HTML_CARD_BOOT");
  const boot = comp.slice(i, j);
  assert.match(boot, /getElementById\("wk-wrap"\)/);
  assert.ok(!/scrollHeight/.test(boot), "又去量 body/documentElement 了＝爬升回路会回来");
  // 内容得真的被 wk-wrap 包起来，而且它要 flow-root 才收得住子元素的 margin
  const doc = htmlCardDoc("<div>hi</div>", "t");
  assert.match(doc, /<div id="wk-wrap">/);
  assert.match(doc, /#wk-wrap\{display:flow-root\}/);
});

test("报回来的高度原样用，不许加余量", () => {
  const i = comp.indexOf("function HtmlCard(");
  const j = comp.indexOf("function TransText(", i);
  const body = comp.slice(i, j);
  const m = body.match(/setHgt\(([^)]*)\)/);
  assert.ok(m, "没有 setHgt");
  assert.equal(m[1].trim(), "n", "加了余量＝下一轮会被原样量回来，高度一路爬");
  // 量到 0（面板隐藏、还没布局）时不许塌成 0 高
  assert.match(body, /n > 0 && n < 6000/);
});

test("不许挂常驻定时器：一屏十张卡就是十个永动机", () => {
  const i = comp.indexOf("const HTML_CARD_BOOT = ");
  const j = comp.indexOf("const HTML_CARD_CSP = ", i);
  const boot = comp.slice(i, j);
  assert.ok(!/setInterval/.test(boot), "卡片里挂了 setInterval");
  assert.match(boot, /ResizeObserver/);
});

// ⚠️她 2026-09-20 真机报「不行啊」：卡片被切成十几个气泡，头一个气泡只有「<!」。
// 那一刀是 splitLongBubble 按「！」断句断的——而在它之前还有一刀按换行拆。
// 所以「整块 HTML 算一条」必须做在【按换行拆之前】，而且两条流水线（单聊/群聊）都要接。
const CARD_ML = '<!DOCTYPE html>\n<html lang="zh">\n<body>\n'
  + '<div id="gaokao-report-container" style="max-width:400px">\n'
  + '<div style="font-size:24px">高考成绩通知单</div>\n<div style="font-size:60px">687</div>\n'
  + '</div>\n</body>\n</html>';

test("整块 HTML 不许被换行拆开", () => {
  const out = splitCardsAndLines(CARD_ML);
  assert.equal(out.length, 1, "卡片被拆成了 " + out.length + " 条");
  assert.ok(out[0].indexOf("<!DOCTYPE html>") === 0 && out[0].indexOf("687") > 0);
});

test("整块 HTML 不许被句末标点拆开（<! 那一刀）", () => {
  const i = eng.indexOf("function splitLongBubble(");
  const j = eng.indexOf("const LONG = ", i);
  assert.ok(i > 0 && j > i, "抠不出 splitLongBubble 开头");
  // 认卡片那一步必须排在 bubbleProtectQuote 那一串【之前】，否则已经被改过了
  const head = eng.slice(i, j);
  assert.match(head, /const _card = htmlCardOf\(s\);/);
  assert.ok(head.indexOf("htmlCardOf") < head.indexOf("bubbleProtectQuote"), "认卡片排到清洗后面去了");
});

test("话在前、卡在后：两边都不丢", () => {
  const out = splitCardsAndLines('好的，这是你的成绩单：' + CARD_ML.replace(/\n/g, ""));
  assert.equal(out.length, 2);
  assert.equal(out[0], "好的，这是你的成绩单：");
  assert.ok(out[1].indexOf("<!DOCTYPE html>") === 0);
});

test("普通消息照常按换行拆，一条没少", () => {
  assert.deepEqual(splitCardsAndLines("第一句\n第二句\n\n第三句"), ["第一句", "第二句", "第三句"]);
  assert.deepEqual(splitCardsAndLines(""), []);
});

test("单聊和群聊两条流水线都接上了（四处一样喂）", () => {
  // 单聊：按换行还原那一步走公共的
  assert.match(app, /splitCardsAndLines\(w\)/);
  // 群聊：进 splitBubbles 之前先认一次
  assert.match(app, /const _gCard = typeof htmlCardOf === "function" \? htmlCardOf\(item\.text\) : null;/);
  // 双语那一刀按「|」劈，HTML 里正好有竖线——两条线都得放行卡片
  assert.equal((app.match(/htmlCardOf\((w|x)\)\) return acc\.concat\(\[\1\]\)/g) || []).length, 2);
});
