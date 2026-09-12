// 她 2026-09-12 两件事：
//   ①「宝宝衣柜能不能多加可以生成多几套衣服」
//   ②「还有随身物现在是卡的不能下滑」
//
// ② 不是布局：那一页的滚动容器一直是好的（742 可视 / 2196 内容，滚得动）。
//   病在【进来时跳到她点的那一栏】那一跳上：deps 写的是 [scrollTo, data, gifts]，
//   而 gifts 是 (carryGifts[char.id] || [])——**没收过礼物的角色每渲染一次就是一个新的 []**。
//   于是「进来跳一次」变成了「整页每重画一次就往回弹一次」；主屏那只表 30 秒走一格
//   （setNow）就足够重画整棵树。她往下滑，半分钟内被拽回原处，看上去就是滑不动。
//   实测：手动滑到底 990 → 等到第 30 秒，自己回到 114。
//
// ① 也不是「模型不肯多写」：刷新那条路走 carryEvolveMerge，规矩是
//   「默认原样照抄回来、这一次最多真换掉两件」——**按多少次刷新，衣柜都不会多出一身**。
//   想多几身在界面上原本就没有路。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const screens = R("js/screens.js"), app = R("js/app.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const S = strip(screens), A = strip(app);

// 真跑：衣柜那几支纯函数（照 carry-layers 那一份的抠法）
const F = (() => {
  const head = screens.slice(screens.indexOf("const CLOSET_MAX_OCCASIONS"), screens.indexOf("function carryProbeSpec"));
  const i = screens.indexOf("function closetMoreSpec");
  assert.ok(i > 0, "抠不出 closetMoreSpec");
  const more = screens.slice(i, screens.indexOf("\n}", i) + 2);
  return new Function(head + more + "\nreturn { closetGroups, closetCount, closetRoom, closetMerge, closetMoreSpec };")();
})();

const set = n => ({ name: n, note: n + "的说明" });
const CLOSET = { closet: [
  { occasion: "上朝", sets: [set("绯色官袍"), set("玄色朝服")] },
  { occasion: "在家", sets: [set("灰麻常服")] }
] };

// ── ① 再添几身：只添不换 ─────────────────────────────────────────
test("添进来的是【多出来的】，老的一身都不动", () => {
  const out = F.closetMerge(CLOSET, { closet: [{ occasion: "上朝", sets: [set("石青补服")] }] });
  const g = F.closetGroups(out);
  assert.deepEqual(g.map(x => x.occasion + "/" + x.sets.length), ["上朝/3", "在家/1"]);
  assert.deepEqual(g[0].sets.map(x => x.name), ["绯色官袍", "玄色朝服", "石青补服"], "新的该挂在这一格后面，老的原样在前");
  assert.equal(F.closetCount(out) - F.closetCount(CLOSET), 1);
});

test("场合名对得上就并进那一格，对不上才另开一格", () => {
  const out = F.closetMerge(CLOSET, { closet: [{ occasion: "出门访友", sets: [set("靛蓝直裰")] }] });
  assert.deepEqual(F.closetGroups(out).map(x => x.occasion), ["上朝", "在家", "出门访友"]);
});

test("撞名的不许添——「重写一遍老的」不能算成添了几身", () => {
  const out = F.closetMerge(CLOSET, { closet: [{ occasion: "上朝", sets: [set("绯色官袍（新裁）"), set("玄色朝服")] }] });
  assert.equal(F.closetCount(out), F.closetCount(CLOSET), "改个括号就当成新的一身了");
  // 同一枪里自己重复的那几身也只收一次
  const dup = F.closetMerge(CLOSET, { closet: [{ occasion: "在家", sets: [set("月白中衣"), set("月白中衣")] }] });
  assert.equal(F.closetCount(dup) - F.closetCount(CLOSET), 1);
});

test("一身新的都没有就原样退回去，别把柜子重写一遍", () => {
  const same = F.closetMerge(CLOSET, { closet: [{ occasion: "上朝", sets: [set("绯色官袍")] }] });
  assert.equal(F.closetCount(same), F.closetCount(CLOSET));
  assert.deepEqual(F.closetGroups(F.closetMerge(CLOSET, null)), F.closetGroups(CLOSET));
  assert.deepEqual(F.closetGroups(F.closetMerge(CLOSET, { closet: [] })), F.closetGroups(CLOSET));
});

test("柜子本来是空的也添得进去（衣柜是空的那一屏上也有这个按钮）", () => {
  const out = F.closetMerge(null, { closet: [{ occasion: "日常", sets: [set("藏青薄夹克")] }] });
  assert.equal(F.closetCount(out), 1);
  assert.equal(F.closetGroups(out)[0].occasion, "日常");
});

// ⚠️这三道闸要对着【真落盘的那一份】验，不能隔着 closetGroups 看：
//   closetGroups 自己也截，隔着它看，塞多了照样一片绿——而塞进去却显示不出来的那几身，
//   正是最坏的一种（她以为添上了，界面上没有）。
test("添到顶就停下，不许把显示不出来的那几身塞进存档", () => {
  const m = screens.match(/const CLOSET_MAX_OCCASIONS = (\d+), CLOSET_MAX_SETS = (\d+), CLOSET_MAX_TOTAL = (\d+);/);
  const occ = +m[1], per = +m[2], total = +m[3];
  const flood = { closet: Array.from({ length: occ + 4 }, (_, i) => ({
    occasion: "新场合" + i, sets: Array.from({ length: per + 4 }, (_, j) => set("新衣" + i + "_" + j)) })) };
  const raw = F.closetMerge(CLOSET, flood).closet;
  assert.ok(raw.length <= occ, "场合数越界：" + raw.length);
  raw.forEach(x => assert.ok(x.sets.length <= per, "单场合越界：" + x.sets.length));
  assert.ok(raw.reduce((n, x) => n + x.sets.length, 0) <= total, "总数越界");
  // 三道闸各拦各的。上面那一份会先撞上场合数和单场合而停下，总数那道根本没轮到——
  // 三种形状各来一次，才知道是三道闸还是一道闸在干活。
  const wide = { closet: Array.from({ length: occ + 4 }, (_, i) => ({ occasion: "宽" + i, sets: [set("宽衣" + i)] })) };
  assert.ok(F.closetMerge(CLOSET, wide).closet.length <= occ, "场合数那道没单独生效");
  const deep = { closet: [{ occasion: "上朝", sets: Array.from({ length: per + 4 }, (_, i) => set("深衣" + i)) }] };
  assert.ok(F.closetMerge(CLOSET, deep).closet[0].sets.length <= per, "单场合那道没单独生效");
  // 总数那道：柜子已经挂满，再开一个【新场合】——场合数没到顶、那一格也是空的，
  // 这时候还肯收下，就只有总数这一道能拦
  const packed = { closet: Array.from({ length: Math.ceil(total / per) }, (_, i) => ({
    occasion: "满" + i, sets: Array.from({ length: per }, (_, j) => set("满衣" + i + "_" + j)) })) };
  assert.equal(F.closetCount(packed), total, "这份桩没挂满，测不到总数那一道");
  const over = F.closetMerge(packed, { closet: [{ occasion: "还想开一格", sets: [set("再来一身")] }] });
  assert.equal(F.closetCount(over), total, "挂满了还往里塞，多出来的那几身根本显示不出来");
  assert.ok(over.closet.reduce((n, x) => n + x.sets.length, 0) <= total, "存档里塞多了，界面上看不见");
});

// 旧的平清单（没有场合这回事）：一添就把她那几身老衣服丢了，是这条路上最坏的结果
test("旧的那一柜添得进去，老的一身都不会丢", () => {
  const legacy = { items: [set("旧的一件"), set("旧的两件")] };
  const out = F.closetMerge(legacy, { closet: [{ occasion: "日常", sets: [set("藏青薄夹克")] }] });
  const names = F.closetGroups(out).reduce((a, g) => a.concat(g.sets.map(x => x.name)), []);
  assert.deepEqual(names, ["旧的一件", "旧的两件", "藏青薄夹克"], "旧数据被吃掉了：" + JSON.stringify(names));
  assert.equal(F.closetCount(out), 3);
});

test("还塞得下几身，数的是【真会显示出来的那些】", () => {
  const total = +screens.match(/CLOSET_MAX_TOTAL = (\d+);/)[1];
  assert.equal(F.closetCount(CLOSET), 3);
  assert.equal(F.closetRoom(CLOSET), total - 3);
  assert.equal(F.closetRoom(null), total);
  // 顶满之后就是 0，不许出负数（那会让「1~-2 身」这种话写进提示词）。
  // ⚠️保证这一点的是 closetGroups 那道截断，不是 closetRoom 自己夹了一次——
  //   所以这一条钉的是那个关系：读出来的数永远不会比天花板大。
  // ⚠️挤在一个场合里是塞不满的——单场合那道闸先拦住它；得铺开好几个场合。
  const per = +screens.match(/CLOSET_MAX_SETS = (\d+),/)[1];
  const occ = +screens.match(/CLOSET_MAX_OCCASIONS = (\d+),/)[1];
  // 存档里挂得比天花板还多（旧存档、或者哪天写入那头漏了一道）：读出来只能是天花板那个数
  const full = { closet: Array.from({ length: occ }, (_, i) => ({
    occasion: "场合" + i, sets: Array.from({ length: per }, (_, j) => set("衣" + i + "_" + j)) })) };
  assert.ok(occ * per > total, "这份桩没超出天花板，测不到截断");
  assert.equal(F.closetCount(full), total, "读出来的数比天花板还大＝总数那道截断没生效");
  assert.equal(F.closetRoom(full), 0);
});

// ── 那一枪要的是【新的】，不是【照抄回来】 ─────────────────────────
test("这一枪只要新添的那几身，不带刷新那一套「原样照抄」", () => {
  const spec = F.closetMoreSpec({ name: "陆衍" }, CLOSET, 9, null, null);
  assert.match(spec.instruction, /只写新添的那几身/);
  assert.match(spec.instruction, /柜子里已经挂着这些/, "不点名列出来，它会把老的重写一遍，一枪白打");
  assert.match(spec.instruction, /绯色官袍、玄色朝服/, "列的得是真挂着的那几身");
  assert.ok(spec.instruction.indexOf("原样照抄回来") < 0, "刷新那套「照抄」跑到这条路上来了");
  assert.ok(spec.instruction.indexOf("最多换掉两件") < 0, "「最多换两件」正是她要的反面");
  assert.match(spec.instruction, /把 note 盖住只看 name/, "name 写成场合名那道判据要跟着走（v61.42）");
});

test("这一次写几身跟着【还塞得下几身】走", () => {
  assert.match(F.closetMoreSpec({ name: "x" }, CLOSET, 9, null, null).instruction, /这一次写 1~5 身/);
  assert.match(F.closetMoreSpec({ name: "x" }, CLOSET, 2, null, null).instruction, /这一次写 1~2 身/, "快满了就少要几身");
  assert.match(F.closetMoreSpec({ name: "x" }, CLOSET, 0, null, null).instruction, /这一次写 1~1 身/, "不许写出「1~0 身」这种话");
});

test("空柜子那一枪不发那段没用的清单", () => {
  const spec = F.closetMoreSpec({ name: "x" }, null, 9, null, null);
  assert.ok(spec.instruction.indexOf("柜子里已经挂着这些") < 0);
});

test("maxTokens 照 施工规则/max-tokens-floor.md 开满", () => {
  assert.equal(F.closetMoreSpec({ name: "x" }, CLOSET, 9, null, null).maxTokens, 65535);
});

// ── 接到界面和 app 上了没有 ────────────────────────────────────
test("衣柜那一栏底下真有这个按钮，空柜子那一屏上也有", () => {
  const i = S.indexOf("const moreBtn = onGenClosetMore ?");
  assert.ok(i > 0, "按钮没了");
  const blk = S.slice(i, i + 900);
  assert.match(blk, /onClick: \(\) => onGenClosetMore\(char\)/);
  assert.match(blk, /disabled: !!busyKey \|\| !!closetBusy/, "正在翻的时候还能再点一次＝白烧一次钱");
  assert.match(blk, /minHeight: 44/, "指头点得到");
  assert.match(blk, /"衣柜是空的", moreBtn/, "空柜子那一屏上没有这个按钮，她就只能干等自动生成");
  assert.match(S, /bay\(g\.sets\.map\(\(it, si\) => hanger\(it, g, gi, si\)\)\)\)\),\n\s*moreBtn\);/, "挂着衣服那一屏上没接上");
});

test("prop 一路传到底（漏一处就是个点不动的按钮）", () => {
  assert.match(S, /function CarrySection\(\{[^}]*onGenClosetMore, closetBusy,/, "CarrySection 没收");
  assert.match(S, /onTogglePin, onPeek, onGen, onGenClosetMore, closetBusy, onGenGiftThought, onBack\n\s*\}\)\)\)\)\);/, "CarryAll 没往下传");
  assert.match(S, /const \{ char, data, gifts, busyKey, giftBusy, carryPins[^}]*onGenClosetMore, closetBusy,/, "CarryAll 没收");
  assert.match(S, /char, data, gifts, busyKey, giftBusy, closetBusy, carryPins,/, "Carry 没往 CarryAll 传");
  assert.match(A, /onGenClosetMore: genClosetMore,/, "app 没接上");
  assert.match(A, /closetBusy: !!gen\.closetMore,/, "转圈那一下没接上");
});

test("添了几身要真数出来再说话——回执是个承诺", () => {
  const i = A.indexOf("const genClosetMore = async char => {");
  assert.ok(i > 0, "genClosetMore 没了");
  const blk = A.slice(i, i + 1500);
  assert.match(blk, /closetMoreSpec\(char, known, room, carryMaterialFor\(char\.id\), other\)/);
  assert.match(blk, /closetMerge\(known, carryDedupe\("outfit", d, other\)\)/, "跨栏避重那一道也得走（同一件东西只能待在一个地方）");
  assert.match(blk, /const add = closetCount\(merged\) - closetCount\(known\);/, "没数就报数");
  assert.match(blk, /if \(add <= 0\) \{ toast\("这次没添出新的，再试一次"\); return; \}/, "一身没添还说「多了 0 身」");
  assert.ok(blk.indexOf("saveCarrySection") > blk.indexOf("if (add <= 0)"), "白写一次也落盘了");
  assert.match(blk, /if \(!room\) \{ toast\("衣柜已经挂满了"\); return; \}/, "满了还打一枪＝白花一次钱");
  // 刷新那条路一个字都不许动：它管的是「换」，不是「添」
  assert.match(A, /carryEvolveMerge\(key, known, carryDedupe\(key, d, other\), pins\)/);
});

test("随身物这几枪走哪条线路只写一处（判断的和真拿去调的得是同一个）", () => {
  assert.match(A, /const carryApi = \(\) => bgActive \|\| active;/);
  assert.equal((A.match(/runProbe\(carryApi\(\)/g) || []).length, 3, "三枪都得走它");
  const i = A.indexOf("const carryApi = () => bgActive || active;");
  const seg = A.slice(i, i + 6000);
  assert.ok(seg.indexOf("runProbe(bgActive,") < 0, "还有一处直接拿 bgActive 去调：那条线路被删掉时她会看到一句英文报错");
});

// ── ② 滑不下去那一道 ────────────────────────────────────────────
test("滚到某一栏只有一处写法（进来那一跳和点布标是同一件事）", () => {
  assert.match(S, /const goSec = key => \{/);
  assert.equal((S.match(/sc\.scrollTop = Math\.max\(0, el\.offsetTop - 8\);/g) || []).length, 1, "又各写了一遍");
  assert.match(S, /onClick: \(\) => \{ taken\.current = true; goSec\(x\.key\); \}/, "点布标也该算她自己动的手");
});

test("她自己滑过一次，这一页就归她了——不许再往回拽", () => {
  const i = S.indexOf("const ownTs = useRef(0);");
  assert.ok(i > 0, "那两个闸没了");
  const blk = S.slice(i, i + 520);
  assert.match(blk, /const taken = useRef\(false\);/);
  assert.match(blk, /if \(!scrollTo \|\| taken\.current\) return;/, "整个 effect 得先问她动没动过手");
  assert.match(blk, /const go = \(\) => \{ if \(!taken\.current\) goSec\(scrollTo\); \};/,
    "那两个 setTimeout 是已经排好的，进门那一下拦不住它们");
  // scroll 事件那一头：自己刚滚那一下不能算成她动的手
  assert.match(S, /onScroll: \(\) => \{ if \(Date\.now\(\) - ownTs\.current > 400\) taken\.current = true; \}/);
  assert.match(S, /ownTs\.current = Date\.now\(\);\n\s*sc\.scrollTop = /, "自己滚之前没记时刻，第一跳就会被当成她滑的");
});

test("内容晚到那一下还得跳（四栏一次生成要十几秒）", () => {
  assert.match(S, /\}, \[scrollTo, data, gifts\]\);/, "deps 砍成 [scrollTo] 的话，生成完内容一铺开，她就落在半空中");
  const i = screens.indexOf("const ownTs = useRef(0)");
  const doc = screens.slice(Math.max(0, i - 1500), i);
  assert.match(doc, /每渲染一次就是一个新的 \[\]/, "病根要留在代码里，别让下一个人又把 taken 那道闸删了");
  assert.match(doc, /她自己滑过一次/);
});

// ── 顺手修的一件：刷新时补回来的那几身，原来一律倒进第一格 ──────────────
// 衣柜攒大之后这事才显眼：刷一次，他的朝服挂到「在家」那一格去了。
// 「一次最多真换掉两件」那道闸是对的，补回来的位置一直是错的。
const EV = (() => {
  const head = screens.slice(screens.indexOf("const CLOSET_MAX_OCCASIONS"), screens.indexOf("function carryProbeSpec"));
  return new Function(head + "\nreturn { carryEvolveMerge, closetGroups };")();
})();

test("刷新时补回来的那几身，回的是它原来挂的那一格", () => {
  const old = { closet: [
    { occasion: "上朝", sets: [set("绯色官袍"), set("玄色朝服"), set("石青补服"), set("赭黄常朝服")] },
    { occasion: "在家", sets: [set("灰麻常服"), set("月白中衣")] }
  ] };
  // 模型这一回把上朝那格删得只剩一身。丢三身、一次最多真换掉两身 → 有一身要补回来，
  // 补回来的【位置】才是这一条要看的东西
  const fresh = { closet: [{ occasion: "在家", sets: [set("灰麻常服"), set("月白中衣")] }, { occasion: "上朝", sets: [set("绯色官袍")] }] };
  const g = EV.closetGroups(EV.carryEvolveMerge("outfit", old, fresh, []));
  const back = g.find(x => x.sets.some(it => /玄色朝服|石青补服|赭黄常朝服/.test(it.name)));
  assert.ok(back, "一身都没补回来，「最多换两件」那道闸自己坏了：" + JSON.stringify(g.map(x => x.occasion + "/" + x.sets.length)));
  assert.equal(back.occasion, "上朝", "朝服被倒进别人那一格了：" + JSON.stringify(g.map(x => x.occasion + "/" + x.sets.map(y => y.name).join("+"))));
  // ⚠️也不许另开一格同名的：界面上会并排出现两根「上朝」的杆
  const occs = g.map(x => x.occasion);
  assert.equal(new Set(occs).size, occs.length, "同一个场合开了两格：" + JSON.stringify(occs));
});

test("那一格整个被删掉时，连格子一起补回来——不许把衣服倒进别人那一格", () => {
  const old = { closet: [
    { occasion: "上朝", sets: [set("绯色官袍")] },
    { occasion: "在家", sets: [set("灰麻常服"), set("月白中衣"), set("藕荷短衫")] }
  ] };
  // 上朝那一格被整个删了，在家删掉两身：gone 三身、最多换两身 → 上朝那一身要回来
  const fresh = { closet: [{ occasion: "在家", sets: [set("灰麻常服")] }] };
  const g = EV.closetGroups(EV.carryEvolveMerge("outfit", old, fresh, []));
  const home = g.find(x => x.sets.some(it => it.name === "绯色官袍"));
  assert.ok(home, "补回来的那一身不见了：" + JSON.stringify(g));
  assert.equal(home.occasion, "上朝", "官袍挂到「在家」那一格去了：" + JSON.stringify(g.map(x => x.occasion + "/" + x.sets.map(y => y.name).join("+"))));
});

test("钉住的那几身也回自己那一格", () => {
  const old = { closet: [
    { occasion: "日常", sets: [set("藏青薄夹克")] },
    { occasion: "上朝", sets: [set("绯色官袍")] }
  ] };
  const g = EV.closetGroups(EV.carryEvolveMerge("outfit", old, { closet: [{ occasion: "日常", sets: [set("藏青薄夹克")] }] }, ["绯色官袍"]));
  const home = g.find(x => x.sets.some(it => it.name === "绯色官袍"));
  assert.equal(home && home.occasion, "上朝", "钉住的那一身被倒进「日常」了");
});
