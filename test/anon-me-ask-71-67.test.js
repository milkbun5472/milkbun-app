// 她 2026-09-19：「我觉得匿名可以按你说的来试试。然后可以指定谁来问，也可以选随机」
//
// ⚠️这条跟隔壁那条【隔离的方向是反的】，所以不能照抄网友出题那一枪：
//   那一枪隔离是为了让出题的人不知道她是谁（第一枪压根不给人设）；
//   角色来问她，他本来就认识她——那不是漏洞，正是这一路好玩的地方。
//   藏起来的只有一样：是谁问的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), comp = P("js/components.js");

const ask = () => {
  const i = app.indexOf("  const askAnonMe = async charId => {"), j = app.indexOf("  const answerAnonMe =", i);
  assert.ok(i > 0 && j > i, "抠不出 askAnonMe");
  return app.slice(i, j);
};

// ⚠️直接让他「出一道题」必然是「你今天开心吗」——掷约束，不掷答案
test("摇轴，不直接要题；每根轴留一格自由", () => {
  assert.match(app, /const ANON_ME_WHY = \[/);
  assert.match(app, /const ANON_ME_ANGLE = \[/);
  const why = app.slice(app.indexOf("const ANON_ME_WHY = ["), app.indexOf("];", app.indexOf("const ANON_ME_WHY = [")));
  const ang = app.slice(app.indexOf("const ANON_ME_ANGLE = ["), app.indexOf("];", app.indexOf("const ANON_ME_ANGLE = [")));
  assert.ok(why.includes("你自己想一个"), "为什么问那根轴没留自由格——代码不是关门，是关一部分门");
  assert.ok(ang.includes("你自己挑一块"), "问哪儿那根轴没留自由格");
  assert.ok((why.match(/\n\s*"/g) || []).length >= 5 && (ang.match(/\n\s*"/g) || []).length >= 5, "轴上的格子太少，组合空间还不如一张表");
  // 两根轴一起进提示词，而且明说是底子不是可选项
  const seg = ask();
  assert.ok(seg.includes("【这一回你为什么想问】") && seg.includes("【这一问冲着哪儿去】"), "轴没发下去");
  assert.ok(seg.includes("不是两个可选项"), "没说清这是底子——说成选项它会挑一个忽略另一个");
});

// ⚠️这一枪【带全套上下文】：他认识她，问题才会具体
test("带全套上下文，不是那种失忆的一枪", () => {
  const seg = ask();
  assert.ok(/runProbe\(apiFor\(char\.id\), ctxFor\(char\)/.test(seg), "没带上下文，问出来的会是路人问句");
  assert.ok(seg.includes("她看不见是你投的"), "没告诉他这是匿名投的");
  assert.ok(seg.includes("别落款"), "他会在问题里签名");
  assert.ok(seg.includes("那是她的事，不是你要控制的"), "让他去控制猜不猜得出，等于让他演");
  // 只问一件事：不然箱子里全是三连问
  assert.ok(seg.includes("只问【一件事】"), "没限一问一件事");
  assert.ok(seg.includes("你已经知道的事拿来问，是在考她"), "他会拿知道答案的事来考她");
});

test("指定谁来问 / 随机，两档都有", () => {
  const seg = ask();
  assert.ok(/const char = charId \? pool\.find\(c => c\.id === charId\) : pool\[Math\.floor\(Math\.random\(\) \* pool\.length\)\];/.test(seg),
    "不传就该随机挑一个");
  assert.ok(comp.includes("onAsk && onAsk()"), "随机那颗没接上");
  assert.ok(comp.includes("onAsk && onAsk(c.id)"), "指定那一路没接上");
  // 随机是主按钮：指定了谁，那一问就少了「猜是谁」那一半
  const i = comp.indexOf('h("button", { onClick: () => onAsk && onAsk(), disabled: busy');
  const j = comp.indexOf('onClick: () => setPick(v => !v)');
  assert.ok(i > 0 && j > i, "随机那颗该排在前面、而且是主按钮");
});

// ⚠️先知道是谁再答＝照着人答，「猜是谁」那一半整个没了
test("翻开只在答完之后给", () => {
  assert.ok(/\(r\.a && !r\.revealed\) \? h\("button", \{ onClick: \(\) => onReveal/.test(comp),
    "没答就能翻开——那就成了照着人答");
  assert.ok(comp.includes("翻开看是谁问的"));
  // 没翻开之前只看得到马甲
  assert.ok(/r\.revealed \? \(\(who && \(who\.remark \|\| who\.name\)\) \|\| "已经不在了的谁"\) \+ " 问的" : \(r\.maskName/.test(comp),
    "没翻开就把人名露出来了");
});

// ⚠️不留痕的话这一问一答只活在这一页里，他永远不知道她答了什么
test("她答完要留下痕迹，走记忆库那条现成的路", () => {
  const i = app.indexOf("  const answerAnonMe = (id, text) => {"), j = app.indexOf("  const revealAnonMe", i);
  const seg = app.slice(i, j);
  assert.ok(seg.includes("addMemEntry({"), "答完没留下任何痕迹");
  assert.ok(/knownBy: \[rec\.charId\]/.test(seg), "knownBy 没限到问的那个人——别人没在场");
  assert.ok(/try \{[\s\S]*addMemEntry/.test(seg), "记不上会连累她这一答");
  assert.ok(!seg.includes("callAI"), "为了留痕又烧一枪——记忆库那条路平时零成本");
});

test("马甲借他自己那张，不为这个再烧一枪", () => {
  const seg = ask();
  assert.ok(/anonRef\.current \|\| \{\}\)\[char\.id\]/.test(seg), "没去拿他已有的马甲");
  assert.ok(seg.includes('"一个陌生人"'), "他还没有马甲时没有占位，那一条会是空的");
});

test("箱子有上限，不会越攒越大", () => {
  assert.match(app, /const ANON_ME_CAP = \d+;/);
  assert.ok(/\.slice\(0, ANON_ME_CAP\)/.test(app), "没截——攒久了这一页会越来越慢");
});
