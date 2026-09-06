// 她 2026-09-06（两张截图）：「同人文那边的生成新文是不是也很长很乱，你做个和装饰一样的
// 分类收放来填吧，还有这个提示也要改改我们的发布入口改了。还有我写了的为啥只能追更！
// 应该换成两个入口一个是我续写一个是请枪手再让模型继续。然后要每一篇文可以单独删除。
// 然后这个写文入口 ui 也修修吧正文部分太小了」——五件事各钉一条。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const fan = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic.js"), "utf8");
const cut = (a, b) => { const i = fan.indexOf(a), j = fan.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return fan.slice(i, j); };

// ── ① 每一篇能单独删 ────────────────────────────────────────────────
test("deleteFic 只删点名那一篇，别的原样留下", () => {
  const seg = cut("    function deleteFic(", "\n    function toggleShelf(");
  const sandbox = { saved: null, fics: [{ id: "a" }, { id: "b" }, { id: "c" }] };
  sandbox.loadFics = () => sandbox.fics;
  sandbox.persistFics = next => { sandbox.saved = next; };
  vm.createContext(sandbox);
  vm.runInContext(seg + "\nthis.deleteFic = deleteFic;", sandbox);
  sandbox.deleteFic("b");
  assert.equal(sandbox.saved.map(f => f.id).join(","), "a,c");
});

test("删除口子只接到【我发布的】那一页，feed 的卡片一个字不动", () => {
  const mine = cut("  function MinePublished(", "  // CP 预设管理（独立页）");
  assert.match(mine, /props\.onDelete \?/, "我发布的这一页要有删除口");
  assert.match(mine, /requestAppConfirm\(/, "删之前必须确认——删了找不回来");
  assert.match(mine, /minHeight: 40/, "点得着：不低于 40px（tabs-not-plain-pills.md §2）");
  // 传下来那一路：FanficApp → Mine → MinePublished
  assert.match(fan, /onDeleteFic: deleteFic/, "FanficApp 要把 deleteFic 传下去");
  assert.match(fan, /onDelete: props\.onDeleteFic/, "Mine 要把它接给 MinePublished");
  // feed 的卡片自己不许长出删除键：那是别人的文
  const card = cut("  function FicCard(", "  // ---------- 掀开封面");
  assert.ok(!/删掉这一篇/.test(card), "FicCard 自己不许有删除键");
});

// ── ② 空状态那句话跟着新入口改 ──────────────────────────────────────
test("我发布的空状态指的是【自己写一篇】，不再是已经没有的老入口", () => {
  const mine = cut("  function MinePublished(", "  // CP 预设管理（独立页）");
  const m = mine.match(/h\(Empty, \{ text: "还没发布过", sub: "([^"]+)"/);
  assert.ok(m, "空状态那一行还在");
  assert.match(m[1], /自己写一篇/, "要指向现在真有的那个入口");
  assert.ok(!/齿轮/.test(m[1]), "别再指齿轮——那是 feed 那一页的生成键");
});

// ── ③ 两个续写入口：我自己写 / 请枪手 ──────────────────────────────
test("阅读页是两个入口，不是只剩一根追更", () => {
  const reader = cut("  function Reader(", "  // ---------- 转发选人 sheet");
  assert.match(reader, /"我来写下一章"/);
  assert.match(reader, /"请枪手接着写"/);
  assert.ok(!/＋ 追更下一章/.test(reader), "老那根独苗要删掉，不是留着说它错了");
});

test("我自己写的那一章接在最后、标 byMe，并且跳到新那章", () => {
  const seg = cut("    function saveMyChapter(", "\n    async function loadReviews(");
  const fic = { id: "f1", chapters: [{ content: "第一章" }] };
  const sandbox = { toasts: [], jumped: null, cleared: 0, closed: 0 };
  sandbox.myChap = "  我写的下一章  ";
  sandbox.f = fic;
  sandbox.props = { onUpdate: (id, fn) => { assert.equal(id, "f1"); fn(fic); }, toast: s => sandbox.toasts.push(s) };
  sandbox.setMyChap = v => { if (v === "") sandbox.cleared++; };
  sandbox.setMyWrite = v => { if (v === false) sandbox.closed++; };
  sandbox.setChapIdx = i => { sandbox.jumped = i; };
  vm.createContext(sandbox);
  vm.runInContext(seg + "\nthis.saveMyChapter = saveMyChapter;", sandbox);
  sandbox.saveMyChapter();
  assert.equal(fic.chapters.length, 2);
  assert.equal(fic.chapters[1].content, "我写的下一章", "前后空白要去掉");
  assert.equal(fic.chapters[1].byMe, true, "标上是她自己写的");
  assert.equal(sandbox.jumped, 1, "写完跳到新那一章");
  assert.equal(sandbox.cleared, 1);
  assert.equal(sandbox.closed, 1);
});

test("一个字没写就按保存：不许塞一章空的进去", () => {
  const seg = cut("    function saveMyChapter(", "\n    async function loadReviews(");
  const fic = { id: "f1", chapters: [{ content: "第一章" }] };
  const sandbox = { toasts: [] };
  sandbox.myChap = "   ";
  sandbox.f = fic;
  sandbox.props = { onUpdate: () => { throw new Error("空的不该写进去"); }, toast: s => sandbox.toasts.push(s) };
  sandbox.setMyChap = () => {}; sandbox.setMyWrite = () => {}; sandbox.setChapIdx = () => {};
  vm.createContext(sandbox);
  vm.runInContext(seg + "\nthis.saveMyChapter = saveMyChapter;", sandbox);
  sandbox.saveMyChapter();
  assert.equal(fic.chapters.length, 1);
  assert.equal(sandbox.toasts.length, 1, "要说一声，不能默默不动");
});

// ── ④ 写文那一页：正文格吃掉整块剩余高度 ───────────────────────────
test("自己写一篇：正文格是 flex-1 撑开的，不是写死几行", () => {
  const seg = cut("  function Publish(", "  // ---------- 我的页 hub");
  const ta = seg.slice(seg.indexOf("h(\"textarea\""));
  assert.match(ta, /flex-1 min-h-0/, "正文格要吃掉剩下那块高度");
  assert.match(ta, /minHeight: 200/, "键盘弹起来时也别塌成一条缝");
  assert.ok(!/rows: 12/.test(seg), "rows 写死就不会跟着屏幕长——已经换掉了");
  // 外壳得是列向 flex，否则 flex-1 撑不开
  assert.match(seg, /flex-1 min-h-0 flex flex-col/, "外壳要是列向 flex");
});

// ── ⑤ 生成配置：四格收放 ───────────────────────────────────────────
// ⚠️这一条是照【第一版真踩到的坑】写的：sec(id,title,summary,body) 只收一个 body，
//   而四格里三格都是好几段并排——结果滑杆和每篇的梗那三个框一个都没渲染出来。
test("sec 把后面所有段落全渲染出来，不是只渲染第一段", () => {
  const seg = cut("    function sec(id, title, summary)", "\n    return h(");
  const sandbox = { secOpen: "n", t: { ink: "#000", line: "#ccc", bg2: "#fff", fog: "#999" }, F_BODY: "f" };
  sandbox.setSecOpen = v => { sandbox.secOpen = v; };
  sandbox.h = function (tag, props) { return { tag: tag, props: props, kids: Array.prototype.slice.call(arguments, 2) }; };
  vm.createContext(sandbox);
  vm.runInContext(seg + "\nthis.sec = sec;", sandbox);
  const node = sandbox.sec("n", "写几篇", "3 篇", "甲", "乙", "丙");
  const body = node.kids[1];
  assert.ok(body, "展开的那一格要有正文");
  assert.deepEqual(body.kids, ["甲", "乙", "丙"], "三段都要在——只留第一段就是第一版那个 bug");
  // 没展开的那一格不渲染正文
  sandbox.secOpen = "cp";
  assert.equal(sandbox.sec("n", "写几篇", "3 篇", "甲", "乙").kids[1], null);
});

test("四格都在，一次只开一格，每格标题上带着它现在是什么", () => {
  const gen = cut("  function GenSheet(", "  // ---------- 新建/编辑自定义世界观 tab");
  // ⚠️不能只问「源码里出现过 cpSummary() 没有」——它就定义在同一段里，
  //   摘要那一栏改成空字符串照样能过。要问的是【它有没有真的当第三个参数传进去】。
  const calls = [];
  gen.replace(/sec\("([a-z]+)", "([^"]+)", ([^,]+),/g, (_, id, title, summary) => { calls.push({ id, title, summary: summary.trim() }); return ""; });
  assert.equal(calls.length, 4, "生成配置应该正好四格，现在是 " + calls.length);
  assert.deepEqual(calls.map(c => c.id), ["n", "cp", "style", "by"]);
  assert.deepEqual(calls.map(c => c.title), ["写几篇 · 每篇写什么", "谁和谁", "什么味道", "谁来写"]);
  // 收起来也看得见自己填了什么，否则等于把设置藏起来
  assert.match(calls[0].summary, /briefN/, "第一格的摘要要说清写了几篇梗");
  assert.equal(calls[1].summary, "cpSummary()");
  assert.equal(calls[2].summary, "styleSummary()");
  assert.equal(calls[3].summary, "authorSummary()");
  assert.match(gen, /const \[secOpen, setSecOpen\] = useState\("n"\)/, "默认开第一格");
  assert.match(gen, /setSecOpen\(on \? "" : id\)/, "一次只开一格");
  assert.match(gen, /minHeight: 48/, "格子标题栏点得着");
});

test("掀起来那块穿的是父页那张纸，不是米白（no-half-sheet.md 的 skin 那一节）", () => {
  const gen = cut("  function GenSheet(", "  // ---------- 新建/编辑自定义世界观 tab");
  const shell = gen.slice(gen.indexOf("rounded-t-3xl"), gen.indexOf("rounded-t-3xl") + 220);
  assert.match(shell, /pageSkin\("paper"/, "父页铺的是 paper，这块也得是");
});

// ⚠️摘要不能只查源码里"提过"那个函数名——它就定义在同一段里，改成一句死话照样能过。
//   这三条把它们真跑起来，看填的东西变了摘要跟不跟着变。
test("三格的摘要都跟着填进去的东西变，不是一句死话", () => {
  const run = (name, endMark, ctx) => {
    const seg = cut("    function " + name + "()", "    function " + endMark);
    // ⚠️直接拿 ctx 当上下文，别 Object.assign 复制一份——
    //   复制的话后面改 ctx.includeMe 沙箱里看不见，这条就成了空转。
    vm.createContext(ctx);
    vm.runInContext(seg + "\nthis.f = " + name + ";", ctx);
    return ctx.f;
  };
  // 谁和谁
  const cpCtx = { characters: [], props: { userName: "我" }, includeMe: false,
    cpLabel: cc => cc.join(" × "), chosenCP: () => cpCtx.picked, twoRealChars: () => cpCtx.picked.length === 2, picked: [] };
  const cpSummary = run("cpSummary", "styleSummary", cpCtx);
  assert.equal(cpSummary(), "还没挑");
  cpCtx.picked = ["甲", "乙"];
  assert.equal(cpSummary(), "甲 × 乙");
  cpCtx.includeMe = true;
  assert.equal(cpSummary(), "甲 × 乙 · 带上我");

  // 什么味道
  const stCtx = { styles: [{ id: "a", name: "甲风" }, { id: "b", name: "乙风" }, { id: "c", name: "丙风" }], styleIds: [] };
  const styleSummary = run("styleSummary", "authorSummary", stCtx);
  assert.equal(styleSummary(), "不限");
  stCtx.styleIds = ["a", "b"];
  assert.equal(styleSummary(), "甲风、乙风");
  stCtx.styleIds = ["a", "b", "c"];
  assert.equal(styleSummary(), "甲风、乙风 等 3 种", "多了就折起来，别把标题栏撑爆");

  // 谁来写
  const auCtx = { authors: [{ id: "p1", name: "笔名甲" }], byId: "" };
  const authorSummary = run("authorSummary", "sec", auCtx);
  assert.equal(authorSummary(), "随缘");
  auCtx.byId = "p1";
  assert.equal(authorSummary(), "笔名甲");
});
