// 她 2026-09-11 三条：
//  ① 请枪手那一页，作者和角色分成两个 tab
//  ② 请作者（往名册里请太太）时给一个输入框：想要什么类型、什么文风、磕哪对
//  ③ 请枪手不只原作者会拒绝——**请的是对家，她自己也可以不接，或者接了不好好写**
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const fic = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic.js"), "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const grab = name => {
  const i = fic.indexOf("function " + name + "(");
  assert.ok(i > 0, "找不到 " + name);
  let d = 0, j = fic.indexOf("{", i);
  for (let k = j; k < fic.length; k++) { if (fic[k] === "{") d++; else if (fic[k] === "}") { d--; if (!d) { j = k + 1; break; } } }
  return fic.slice(i, j);
};
const box = {};
vm.createContext(box);
vm.runInContext(fic.slice(fic.indexOf("  function temperWeight(by)"), fic.indexOf("  // 此刻的热度"))
  + grab("ghostStance") + grab("ghostLazyBlock")
  + "\nconst GHOST_REFUSE_BASE = 0.2, GHOST_REFUSE_TEMPER = 0.3, GHOST_LAZY_UNTIL = 0.75;"
  + "\nthis.M = { ghostStance, ghostLazyBlock, temperWeight };", box);
const M = box.M;
const SOFT = { temper: "", sore: "" };
const HARD = { temper: "x".repeat(90), sore: "y".repeat(90) };

test("① 两叠，不是一排药丸", () => {
  const g = fic.slice(fic.indexOf("function GhostPage(props)"), fic.indexOf("  // ---------- 拿给谁看"));
  assert.match(g, /const \[pane, setPane\] = useState\("pen"\);/);
  assert.match(g, /const rows = pane === "pen" \? \[head\]\.concat\(penRows\) : charRows;/,
    "两叠还混在一张名单里");
  assert.match(g, /pageTab\("pen", "圈里的太太", penRows\.length\), pageTab\("char", "你的人", charRows\.length\)/);
  // ⚠️下面几条只许看 pageTab 这一段：整个 GhostPage 里 minHeight:44 和 on?600:400
  //   在名单那几行也各有一份，拿整页去 match 是永远绿的（改烂了也绿）。
  const tab = g.slice(g.indexOf("const pageTab = function"), g.indexOf("const ghostPicked"));
  assert.ok(tab.length > 200, "没切到 pageTab");
  // 委托单分栏靠的是「翻到哪一页」：选中那张满高、纸色、直接长进底下的名单
  assert.match(tab, /borderBottom: on \? "none" : "1px solid " \+ t\.line/, "选中那张没跟底下的纸连起来，就还是两颗按钮");
  assert.match(tab, /borderRadius: "10px 10px 0 0"/);
  // 选中态不只靠色（tabs-not-plain-pills.md §2）
  assert.match(tab, /padding: on \? "11px 6px 13px" : "14px 6px 10px"/, "高度不变＝只靠色差");
  assert.match(tab, /fontWeight: on \? 600 : 400/);
  assert.match(tab, /minHeight: 44/, "页签点不着");
  // 换一叠就把选中清掉：不然选着太太切到角色，底下那颗键还写着太太的名字
  assert.match(g, /setPane\(key\); props\.onPick\(""\);/);
  // ⚠️没 id 的太太不许跟「照原样」共用一个 key：撞了 key，翻到第二叠时她那行还赖在顶上，
  //   点她等于点了「照原样」——真接笔的是原作者（v66.95 browser smoke 抓到的）
  assert.match(g, /id: a\.id \|\| \("au:" \+ authorName\(a\)\)/, "没 id 的太太跟「照原样」撞 key");
  // 两叠各自的空态
  assert.match(g, /还没有角色。角色接的那一章，原作者照样会在底下说话——但她抢不回去。/);
});

test("② 请太太时说得出想要什么，但那段话不许抄进她们的简介", () => {
  assert.match(fic, /async function genAuthors\(active, n, tabs, cpChars, userName, have, want\)/);
  const g = fic.slice(fic.indexOf("async function genAuthors"), fic.indexOf("  // ---- 批量生成"));
  assert.match(g, /【她想请什么样的人】/);
  assert.match(g, /这是\*\*挑人的方向\*\*，不是她们的设定/,
    "不说清的话它会把这段话原样抄进 bio，四个人的简介长成一个样（跟「不许塞内容示范」同一个坑）");
  assert.match(g, /别把这段话抄进任何一位的简介或路数里/);
  assert.match(g, /几位都合这个方向，但各自合的地方不一样/);
  assert.ok(g.indexOf('String(want || "").trim()\n        ? ') > 0 || /want \|\| ""\)\.trim\(\)/.test(g), "空着时还发一段空的");
  // 界面：不另开一层（一行字 + 一颗键，开半窗反而更重）
  // v66.99 起这一格不再常年杵在名册顶上：点了「请人」才掀开（她 2026-09-11）
  assert.match(fic, /placeholder: "写什么类型、什么文风、磕哪对…空着就随缘"/);
  assert.match(fic, /const \[asking, setAsking\] = useState\(false\);/);
  assert.match(fic, /asking \? h\("div", \{ style: \{ border: "1px dashed "/, "稿约条没挂在 asking 上＝又常年杵在那儿");
  assert.match(fic, /busy \? "请人中…" : \(asking \? "算了" : "＋ 请人"\)/, "「请人」那颗键不掀条子");
  assert.match(fic, /refresh\(\); setAsking\(false\);/, "请完不收起来，那张条子会一直挡着名册");
  assert.match(fic, /localStorage\.getItem\("x_ficAuthorWant"\)/, "不记住的话连着请几批同一个方向要重打好几遍");
  assert.match(fic, /window\.Fanfic\.loadAuthors\(\), want\)/, "输入框写了，可根本没递进那一枪");
});

test("③ 对家可以不接：代码掷，而且拒绝那一次连枪都不打", () => {
  // 没过节的时候一次都不会发生
  for (let i = 0; i <= 10; i++) assert.equal(M.ghostStance(false, HARD, i / 10), "", "没过节也使性子");
  // 有过节：三档都掷得到
  const got = {};
  for (let i = 0; i <= 100; i++) got[M.ghostStance(true, SOFT, i / 100) || "ok"] = 1;
  assert.deepEqual(Object.keys(got).sort(), ["lazy", "ok", "refuse"], "三档没都掷到：" + Object.keys(got));
  // 脾气越硬越可能当场回绝
  const r = 0.35;
  assert.equal(M.ghostStance(true, SOFT, r), "lazy");
  assert.equal(M.ghostStance(true, HARD, r), "refuse", "脾气硬的和软的反应一样，那 temper 那一栏又白填了");
  // 有过节也不是每次都使性子——人不是机器
  assert.equal(M.ghostStance(true, HARD, 0.9), "");
  // 掷不出数（undefined / NaN）时不许当成「掷到了 0」——0 那一档是当场回绝
  assert.equal(M.ghostStance(true, HARD, NaN), "");
  assert.equal(M.ghostStance(true, HARD, undefined), "");
  // 拒绝那一次不打枪：掷完直接 return，toast 说清为什么
  const r2 = fic.slice(fic.indexOf("async function addChapter(by, want, hard)"), fic.indexOf("    // 去请她回来"));
  assert.match(r2, /if \(gStance === "refuse"\) \{/);
  // ⚠️同上：整段 addChapter 里 return; 有好几处，只许看回绝那一块
  const rf = r2.slice(r2.indexOf('if (gStance === "refuse") {'), r2.indexOf("const grabbed"));
  assert.ok(rf.length > 80, "没切到回绝那一块");
  assert.match(rf, /kind: "turnDown"/, "她回绝这件事没记进圈子那本流水账");
  assert.match(rf, /不接这篇——她跟「" \+ ownNm \+ "」有过节/, "只说「不接」不说为什么，她会以为是坏了");
  assert.match(rf, /\n        return;\n/, "回绝完还往下走，那这一枪照样打出去了");
  const i0 = r2.indexOf('gStance === "refuse"'), i1 = r2.indexOf("genNextChapter");
  assert.ok(i0 > 0 && i1 > i0, "拒绝那一掷得在打枪之前——不然回绝了还是花了钱");
  // 角色接手不掷这个：他不在圈子里，没有过节可言
  assert.match(r2, /const gStance = byChar \? "" : K\.ghostStance\(feud, by, Math\.random\(\)\)/);
});

test("③ 「不好好写」给的是形状，不是「写得烂」", () => {
  const b = M.ghostLazyBlock("青梅");
  assert.match(b, /你跟「青梅」有过节。这一章是钱的事，不是情分/);
  assert.match(b, /⚠️不是让你写烂文：错别字、故意幼稚、把人物写崩——一个都不许/,
    "不钉死的话模型给的是一段戏仿的烂文，那不好笑，那是侮辱这个人");
  assert.match(b, /该接住的前情细处粗粗带过；她最护着的那一点你偏不碰/);
  assert.match(b, /你自己那套最见功夫的写法今天一点都不亮出来/);
  // 最要紧那一句：不许在正文里跟读者解释自己在敷衍
  assert.match(b, /全篇不许出现任何一句对读者解释你不上心的话/);
  assert.match(b, /\*\*让它从字里透出来。\*\*/);
  // 只有真敷衍那一次才发
  assert.match(fic, /\(ghost && !byChar && opts\.lazy\) \? ghostLazyBlock\(String\(fic\.author \|\| ""\)\.trim\(\)\) : ""/);
  assert.match(fic, /lazy: gStance === "lazy"/);
});

test("③ 圈子那本账认得出「回绝」跟「被请回来没答应」不是一件事", () => {
  assert.match(fic, /turnDown: "不接对方那篇文"/);
  assert.match(fic, /refuse: "被请回来，没答应"/);
  const cl = strip(fic.slice(fic.indexOf("function circleLines(me, other, opts)"), fic.indexOf("  // 两位太太是不是嗑同一对")));
  assert.match(cl, /e\.kind === "turnDown"/, "记了却不往外说，那这笔账等于没记");
});
