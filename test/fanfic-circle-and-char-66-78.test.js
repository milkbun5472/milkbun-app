// 她 2026-09-11 的④和「让角色来写」。
//
// ④ ⚠️**不存关系值，存一本流水账**。关系现算。存一个「−20」出来，喂给模型只能变成
//   一句判语；存「你给她代过两次笔，第二次她在评论区阴阳了你一句」，那本身就是料。
//   而且不许长成第二个论坛：只有真发生过一件事才记一笔。
//
// 角色那半 ⚠️立场由代码算（他在不在这对 CP 里、另一方是谁、他跟她和另一方什么关系），
//   但**他会怎么动手不许写成一张表由代码挑**——代码定立场和分寸，怎么捣乱他自己长。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const fic = R("js/fanfic.js"), app = R("js/app.js"), axes = R("js/axes.js"), html = R("index.html");
const Axes = require("../js/axes.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const grab = name => {
  const i = fic.indexOf("function " + name + "(");
  assert.ok(i > 0, "找不到 " + name);
  let d = 0, j = fic.indexOf("{", i);
  for (let k = j; k < fic.length; k++) { if (fic[k] === "{") d++; else if (fic[k] === "}") { d--; if (!d) { j = k + 1; break; } } }
  return fic.slice(i, j);
};
// 流水账那几个纯函数：桩是内存里的一份 list，照源码本身跑
const CIRCLE = fic.slice(fic.indexOf("  const K_CIRCLE ="), fic.indexOf("  // 两位太太是不是嗑同一对"));
const box = { loadJSON: () => [], saveJSON: () => {}, Axes: Axes };
vm.createContext(box);
vm.runInContext(CIRCLE + "\nthis.C = { circleBetween, circleFeud, circleLines, CIRCLE_ZH };", box);
const C = box.C;
const box2 = { Axes: Axes };
vm.createContext(box2);
vm.runInContext(fic.slice(fic.indexOf("  const STANCE = {"), fic.indexOf("  // ── 圈子：谁跟谁有过什么"))
  + "\nthis.S = { STANCE, stanceFor, stanceFacts, WRITER_AXES, rollWriterAxes, charWriterBlock };", box2);
const S = box2.S;
const EV = (a, b, kind, title, say) => ({ a: a, b: b, kind: kind, title: title || "某篇", say: say || "", ts: Date.now() });

test("④ 存的是事件不是分数", () => {
  const src = strip(fic.slice(fic.indexOf("  const K_CIRCLE ="), fic.indexOf("  // ── 太太还坐得住吗")));
  assert.ok(!/relScore|亲密度|好感|score\s*[:=]/.test(src), "存了一个数出来，喂给模型只会变成一句判语");
  assert.match(src, /ts: Date\.now\(\)/);
  assert.match(fic, /CIRCLE_CAP = 300/, "不封顶的话它会一直长");
});

test("④ 两个人之间的账：谁对谁、新的在前", () => {
  const list = [EV("老陈", "青梅", "ghost", "码头"), EV("青梅", "老陈", "grab", "码头"), EV("小林", "别人", "ghost", "另一篇")];
  const rows = C.circleBetween("青梅", "老陈", list);
  assert.equal(rows.length, 2, "把不相干的第三个人也算进来了");
  assert.equal(rows[0].kind, "grab", "新的没排在前面");
  // ⚠️不用 deepEqual：这几个函数跑在 vm 的另一个 realm 里，那边的 [] 跟这边的 [] 原型不同
  assert.equal(C.circleBetween("青梅", "", list).length, 0, "另一方是空的时候不该匹配到谁");
});

test("④ 有过节＝抢过笔或者为对方撂过挑子，代笔本身不算", () => {
  assert.equal(C.circleFeud("青梅", "老陈", [EV("老陈", "青梅", "ghost", "码头")]), false, "代过一次笔就算有过节，那圈子里人人有仇");
  assert.equal(C.circleFeud("青梅", "老陈", [EV("青梅", "老陈", "grab", "码头")]), true);
  assert.equal(C.circleFeud("青梅", "老陈", [EV("青梅", "老陈", "quit", "码头", "我不写了")]), true);
});

test("④ 喂出去的是实情，不是判词", () => {
  const list = [EV("老陈", "青梅", "ghost", "码头"), EV("青梅", "老陈", "quit", "码头", "爱谁写谁写")];
  const mine = C.circleLines("老陈", "青梅", { list: list });
  assert.match(mine, /你给「青梅」的《码头》代过笔/);
  assert.match(mine, /「青梅」撂了挑子不写了（当时说的是「爱谁写谁写」）/);
  assert.match(mine, /这些只是实情，不是判词/, "不写这句它会照着「你们关系差」演");
  assert.ok(!/关系很差|不和|仇/.test(mine));
  // 反过来看是同一件事的另一面
  const hers = C.circleLines("青梅", "老陈", { list: list });
  assert.match(hers, /「老陈」给你的《码头》代过笔/);
  assert.equal(C.circleLines("青梅", "谁也不认识", { list: list }), "", "没打过交道就别发一段空的");
  assert.match(C.circleLines("老陈", "青梅", { list: list, sameCP: true }), /你们嗑的是同一对/);
});

test("④ 有过节的枪手，热度涨得更凶——③和④在这儿接上", () => {
  assert.match(fic, /\* \(o\.feud \? 1\.6 : 1\)/);
  const r = fic.slice(fic.indexOf("async function addChapter(by, want, hard)"), fic.indexOf("    // 去请她回来"));
  assert.match(r, /const feud = !!\(byNmRaw && ownNm && K\.circleFeud\(ownNm, byNmRaw\)\)/);
  assert.match(r, /feud: feud/);
  // 挑人页上要看得见，不然她永远不知道自己点了个火药桶
  assert.match(fic, /她跟「" \+ own \+ "」有过节/);
});

test("④ 只有真发生过一件事才记一笔，不生成日常", () => {
  const r = fic.slice(fic.indexOf("async function addChapter(by, want, hard)"), fic.indexOf("    // 「让他接着写」"));
  assert.match(r, /K\.circlePush\(\{ a: ownNm, b: byNmRaw, kind: "grab"/);
  assert.match(r, /K\.circlePush\(\{ a: byNmRaw, b: ownNm, kind: "ghost"/);
  assert.match(r, /if \(quitting && ownNm\) K\.circlePush\(\{ a: ownNm, b: byNmRaw, kind: "quit"/);
  assert.match(r, /kind: r\.ok \? "back" : "refuse"/);
  assert.ok(strip(fic).indexOf("setInterval") < 0 && !/circlePush\(\{[^}]*kind: "chat"/.test(fic), "它开始自己生成日常了＝第二个论坛");
  // 角色接手不进圈子：他不是圈里的人
  assert.match(r, /if \(ownNm && byNmRaw && !byChar\)/);
});

test("角色来写：立场是算出来的，五种都要分得开", () => {
  const c = { id: "c1", name: "顾朝" };
  assert.equal(S.stanceFor(c, { cp: ["c1", "me"] }, {}).kind, S.STANCE.SELF_USER);
  assert.equal(S.stanceFor(c, { cp: ["c1", "c2"] }, {}).kind, S.STANCE.SELF_OTHER);
  assert.equal(S.stanceFor(c, { cp: ["me", "c2"] }, {}).kind, S.STANCE.JEALOUS);
  assert.equal(S.stanceFor(c, { cp: ["c2", "c3"] }, { rels: { c2: "发小" } }).kind, S.STANCE.TIED);
  assert.equal(S.stanceFor(c, { cp: ["c2", "c3"] }, {}).kind, S.STANCE.OUTSIDER);
  assert.equal(S.stanceFor(c, { cp: [] }, {}).kind, S.STANCE.OUTSIDER);
  // 另一方要指得出来，不然「你和 X」那句话说不出口
  assert.equal(S.stanceFor(c, { cp: ["me", "c2"] }, {}).other, "c2");
});

test("角色来写：给事实和状态，不给数字", () => {
  const c = { id: "c1", name: "顾朝" };
  const nameOf = id => ({ c2: "沈屿白" })[id] || id;
  const t1 = S.stanceFacts(c, { cp: ["me", "c2"] }, { aff: 78, couple: "together", days: 120, rels: { c2: "室友" } },
    S.stanceFor(c, { cp: ["me", "c2"] }, { rels: { c2: "室友" } }), nameOf, "小美");
  assert.match(t1, /这篇写的是【她和「沈屿白」】，你不在里面/);
  assert.match(t1, /你和她在一起了，120 天了/);
  assert.match(t1, /你和「沈屿白」：室友/);
  assert.ok(t1.indexOf("78") < 0, "好感度数字递进去了——他写出来的会是一份报告");
  assert.match(t1, /\*\*你写的时候会不会往自己想要的方向偏、偏多少，你自己清楚\*\*/);
  assert.match(t1, /你本来就无所谓的，那就真的无所谓/, "不给这个出口的话，无所谓的角色也会被演成醋坛子");
  const t2 = S.stanceFacts(c, { cp: ["c1", "me"] }, { aff: 30 }, S.stanceFor(c, { cp: ["c1", "me"] }, {}), nameOf, "小美");
  assert.match(t2, /这篇写的就是【你和她】/);
  assert.match(t2, /你和她还没那么熟/);
});

test("角色来写：掷的是「他不会什么」，不是「写得烂」", () => {
  // 第一条轴上必须留着「他是真的会写」——不是每个角色都写得差
  const craft = S.WRITER_AXES.filter(a => a.key === "craft")[0];
  assert.ok(craft.opts.some(o => /真的会写/.test(o)), "全是毛病＝人设里真会写的人也被写成半吊子");
  craft.opts.forEach(o => assert.ok(!/错别字|文笔差|很烂|水平低/.test(o), "掷到了「写得烂」这种词：" + o));
  const blk = S.charWriterBlock({ id: "c1", name: "顾朝" }, { cp: ["c1", "me"] }, {}, S.rollWriterAxes("c1", "f1", 2), id => id, "小美");
  assert.match(blk, /不许错别字、不许故意幼稚、不许写成戏仿/);
  assert.match(blk, /\*\*他是认真在写的，只是他不是干这行的。\*\*/);
  assert.match(blk, /话少的人写坏的方式，和话痨的不一样/, "不说这句，毛病就跟人设脱钩了");
  assert.match(blk, /你就是他本人在写，不是「一位作者在模仿他」/);
  assert.match(blk, /正文里不许出现他对读者的解释、吐槽或者旁白/);
  // 掷得稳：同一个人同一章问两次一样
  assert.deepEqual(S.rollWriterAxes("c1", "f1", 2), S.rollWriterAxes("c1", "f1", 2));
  assert.notDeepEqual(S.rollWriterAxes("c1", "f1", 2), S.rollWriterAxes("c1", "f1", 3));
  // 两条轴都留得出「你自己想一个」
  let free = 0;
  for (let i = 0; i < 200; i++) S.rollWriterAxes("c" + i, "f1", 1).rows.forEach(r => { if (r.opt === Axes.FREE) free++; });
  assert.ok(free > 0, "「你自己想一个」那一格从来没掷到过＝代码把门关死了");
});

test("角色来写：接到界面上了，而且写完这件事会留下", () => {
  assert.match(fic, /name: \(c\.remark \|\| c\.name\) \+ "（你的人）"/);
  assert.match(fic, /self_user: "这篇写的就是他和你", self_other: "这篇把他跟别人配了"/, "那一行得写他跟这篇什么关系，不是一句空话");
  assert.match(fic, /byChar: byChar,/);
  assert.match(fic, /writerAxes: byChar \? K\.rollWriterAxes\(byChar\.id, f\.id, \(f\.chapters \|\| \[\]\)\.length\) : null/);
  assert.match(fic, /if \(byChar\) ch\.byCharId = byChar\.id;/);
  // ⚠️v66.79 改口：写完**不自动回流**。她 2026-09-11：「有时候我也只是想测试一下，
  //   但是不想让他们记得」——「不记」事后能补，「记了」得手动去删，
  //   默认值不该选不可逆的那一边。撤掉就是删掉，不是在后面挂说明。
  assert.ok(fic.indexOf("onCharWrote") < 0 && app.indexOf("onCharWrote") < 0, "自动往主线记忆库写那一条又长回来了");
  assert.match(fic, /ch\.byCharId \? "记进房间" : "拿给他看"/, "她按一下才发生的那颗键没了");
  assert.match(app, /onFileChapter: \(charId, card, pick, meta\) => \{/);
  assert.match(app, /addMemEntry\(\{[\s\S]{0,200}charIds: \[charId\], source: "fanfic"/);
  // relOf 只给状态不给数字这件事，是在 app 那头就定的
  assert.match(app, /relOf: charId => \{/);
  assert.match(app, /只给【状态】不给数字/);
});

test("掷轴搬去公共那一层了，而且旧的那处也搬了", () => {
  assert.match(axes, /root\.Axes = api/);
  assert.match(axes, /h \^= h >>> 16; h = Math\.imul\(h, 2246822507\)/, "种子的收尾三步要跟着搬过来");
  // 电台那一处不许留一份自己的
  const radio = R("js/radio.js");
  assert.ok(radio.indexOf("let h = 2166136261") < 0, "电台还留着一份自己的哈希——改一处必然漏一处");
  assert.match(radio, /Axes\.roll\(AXES, parts, \{ allFree: 0\.08/, "电台没搬过来（只开公共的、旧的留在原地是最坏的那一种）");
  assert.match(radio, /Axes\.seed01\.apply\(null, arguments\)/);
  // 同人文这一处用的也是它
  assert.match(fic, /Axes\.roll\(WRITER_AXES, parts,/);
  assert.match(fic, /Axes\.text\(rolled, \{/);
  // 加载顺序：公共的要在用它的两家前面
  // ⚠️先确认它真被加载了：indexOf 找不到会返回 -1，而 -1 比谁都小，那条顺序断言就成了摆设
  assert.ok(html.indexOf("js/axes.js?v=") > 0, "index.html 里没加载 js/axes.js");
  assert.ok(html.indexOf("js/axes.js") < html.indexOf("js/radio.js"));
  assert.ok(html.indexOf("js/axes.js") < html.indexOf("js/fanfic.js"));
});
