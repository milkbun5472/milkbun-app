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
});

// ⚠️她 2026-09-19：「还有你这轴也太 serious 了吧！有时候心情好也是会问莫名其妙的
//   问题的（人设允许范围内）」——原来那六格全是心事：没底、不痛快、试探、今天不好过。
//   人好好的时候也会开口，而且那时候问出来的东西才是最没防备的。
test("轴上得有人好好的时候那几格", () => {
  const why = app.slice(app.indexOf("const ANON_ME_WHY = ["), app.indexOf("];", app.indexOf("const ANON_ME_WHY = [")));
  const ang = app.slice(app.indexOf("const ANON_ME_ANGLE = ["), app.indexOf("];", app.indexOf("const ANON_ME_ANGLE = [")));
  ["心情不错", "手欠", "好奇"].forEach(k => assert.ok(why.includes(k), "为什么问那根轴上没有轻的那一头：" + k));
  ["跟你俩都没关系的破事", "二选一"].forEach(k => assert.ok(ang.includes(k), "问哪儿那根轴全冲着你俩去：" + k));
  // 轻的格子得占得住一半左右，不然抽到的还是心事
  const light = (why.match(/心情不错|闲着|破事|好奇|手欠/g) || []).length;
  assert.ok(light >= 4, "轻的那一头只有 " + light + " 格，抽十次还是九次心事");
});

// ⚠️「人设允许范围内」是她那句话的后半截，而且是要紧的那半：
//   轴给的是【此刻的心境】，不是让他换一个人。不写的话，抽到「手欠」那一格，
//   一个话少的人会突然变得话痨。
test("轴是心境不是换人，而且明说问句不必句句有深意", () => {
  const seg = ask();
  assert.ok(seg.includes("不是让你换一个人"), "没说清轴只改心境——抽到轻的那格他会变个人");
  assert.ok(seg.includes("话少的人心情好也不会突然话痨"), "没给出反面，它会往「开朗」上演");
  assert.ok(seg.includes("问句不必句句有深意"), "没许他问蠢问题，他还是会每句都端着");
  // 两根轴一起进提示词，而且明说是底子不是可选项
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

// ⚠️她 2026-09-19 截图：出来的是「如果身边有个人……」「这种人到底是……」
//   「觉得对方拿她没办法」——他把自己和她都写成了第三人称的泛指，同一句里
//   「你」和「她」还串着用。病因是我把【匿名】写成了【假装不认识】。
test("匿名只是不署名，不是失忆：得直接问她", () => {
  const seg = ask();
  // ⚠️兜底那一枪里也有同一句话，所以钉主提示词里那个带星号的写法，不然改坏了测不出来
  assert.ok(seg.includes("⚠️**直接问她，用「你」**"), "主提示词里没让他直接问");
  assert.ok(seg.includes("如果身边有个人"), "没点名那种假装泛指的问法——它是最顺手的一种");
  assert.ok(seg.includes("匿名只是不署名，不是失忆"), "没说清匿名到底藏的是什么");
  assert.ok(seg.includes("不许中途把她改口成"), "人称串了没人管");
});

// ⚠️规则只能降概率，代码才保证（这仓库的老规矩）
test("代码兜一道，而且只兜一次", () => {
  const seg = ask();
  assert.ok(/const _vague = t => !\/你\/\.test\(t\) \|\| \/身边有\(个\|一个\)人\|这种人\|有的人\|有个朋友\//.test(seg),
    "没有代码那一道——提示词写得再清楚也只是降概率");
  assert.ok(seg.includes("重写一遍：直接问她"), "兜的那一枪没说清要改什么");
  // 她按次计费：兜不回来就收下，绝不连打三枪
  assert.equal((seg.match(/runProbe\(/g) || []).length, 2, "为一句问话打了超过两枪");
  assert.ok(/catch \(e\) \{\/\* 兜不回来就用原来那句/.test(seg), "兜的那一枪失败会把整轮废掉");
});

// 同一张截图里两条都是「到底是 A，还是 B？」的长对偶句
test("别每句都做成二选一的长句", () => {
  const seg = ask();
  assert.ok(seg.includes("也别每句都做成「到底是 A，还是 B？」"), "没拦那个最顺手的句式");
  assert.ok(seg.includes("干脆就一个词的，都行"), "只禁不给出口，它会缩回更安全的写法");
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
