const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const weekly = fs.readFileSync(path.join(__dirname, "..", "js/weekly.js"), "utf8");

// 她 2026-08-19 报：Codex 加了几种周刊风格，但每种风格写的都是同一件事。
// 换的只是腔调，事件选择仍然是同一份素材上的 argmax。
test("批量生成必须先把事分完再动笔，同一件事只许给一个版面", () => {
  const seg = weekly.slice(weekly.indexOf("async function genMediaBatch"),
    weekly.indexOf("function claimedEvents"));
  assert.match(seg, /先分事，再写稿/);
  assert.match(seg, /\*\*同一件事只许给一个版面\*\*/);
  assert.match(seg, /宁可让某些版少写一篇.*也绝不许两个版报同一件/);
  assert.match(seg, /event/, "每篇要带不带腔调的大白话事件标签");
});

test("提示词只是要求，代码要再硬查一遍并丢掉撞车的后来者", () => {
  const seg = weekly.slice(weekly.indexOf("const rows = d && Array.isArray(d.media)"),
    weekly.indexOf("function claimedEvents"));
  assert.match(seg, /const takenBlocks = new Set\(\), takenEvents = new Set\(\);/);
  assert.match(seg, /if \(k && takenEvents\.has\(k\)\) return;/, "撞车的直接丢掉");
  assert.match(seg, /takenEvents\.add\(k\)/);
  // 归一化：换标点、换空格不算换事件
  const fn = new Function(weekly.slice(weekly.indexOf("function eventKey"),
    weekly.indexOf("\n", weekly.indexOf("function eventKey"))) + "\nreturn eventKey;")();
  assert.equal(fn("早餐做了两份吐司起了争执"), fn("早餐 做了两份吐司，起了争执！"));
  assert.notEqual(fn("吐司之争"), fn("画室夜话"));
});

test("补洞与单版重刷都要拿到已被占掉的事，否则补出来还是那件", () => {
  assert.match(weekly, /async function genMedia\(active, voice, personasBlock, material, empty, avoid, opts\)/);
  assert.match(weekly, /function avoidBlock\(avoid\)/);
  assert.match(weekly, /这些事已经被本期别的版面报道了 · 一件都不许再写/);
  assert.match(weekly, /换个说法、换个角度、只换主角都算重复/);
  // 三个调用点：整期补洞 / 单版重刷 / 手动补版
  assert.match(weekly, /genMedia\(active, v, personasFor\(charsWithMat, userName\), globalText, empty, taken\.slice\(\),/);
  assert.match(weekly, /window\.Weekly\.claimedEvents\(issue\.sections, sec\.id\)/);
  assert.match(weekly, /window\.Weekly\.claimedEvents\(issue\.sections\)/);
  assert.match(weekly, /claimedEvents: claimedEvents/, "要导出给 UI 用");
});

test("翻页的那道书脊边框去掉，翻页动画保留", () => {
  assert.doesNotMatch(weekly, /weekly-page-next:after/, "inset:0 正好落在内容盒上，画成了正文外框");
  assert.doesNotMatch(weekly, /box-shadow:inset 12px 0 18px -20px/);
  assert.match(weekly, /animation:weeklyPageNext \.42s/, "翻页动画本身不动");
  assert.match(weekly, /animation:weeklyPagePrev \.42s/);
});

// v53.83：她提的做法——一个版面选完就留下"用了哪几段"的标记，下一个版面必须避开；
// 并且每期的选材顺序轮换，免得永远同一个版第一个挑走"最有戏"的那块。
const run = () => {
  const grab = name => {
    const i = weekly.indexOf("  function " + name);
    let d = 0, j = weekly.indexOf("{", i), started = false;
    for (; j < weekly.length; j++) {
      if (weekly[j] === "{") { d++; started = true; }
      else if (weekly[j] === "}") { d--; if (started && !d) { j++; break; } }
    }
    return weekly.slice(i, j);
  };
  const src = 'function ymd(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}\n' +
    'const BLOCK_IDS="ABCDEFGHIJKL".split("");const WD=["周日","周一","周二","周三","周四","周五","周六"];\n' +
    grab("weekBlocks") + "\n" + grab("blocksToText") + "\n" + grab("seeded") + "\n" + grab("pickOrder") +
    "\nreturn { weekBlocks, blocksToText, pickOrder };";
  return new Function(src)();
};

test("整周素材按天切块，天数太少就按最长静默再切开", () => {
  const m = run();
  const day = (d, h, n) => Array.from({ length: n }, (_, i) => ({ ts: new Date(2026, 7, d, h, i * 2).getTime(), line: "甲：第" + d + "天第" + i + "句" }));
  // 三天，每天 5 句 → 三块
  const three = m.weekBlocks([].concat(day(10, 9, 5), day(11, 9, 5), day(12, 9, 5)));
  assert.equal(three.length, 3);
  assert.deepEqual(three.map(b => b.id), ["A", "B", "C"]);
  assert.match(three[0].label, /8\/10 周一/);

  // 只有一天但话很多 → 必须再切开，否则三个版面只能抢同一块
  const oneDay = day(10, 9, 12).concat([{ ts: new Date(2026, 7, 10, 22, 0).getTime(), line: "甲：夜里这句离得很远" }],
    day(10, 22, 8).map((r, i) => ({ ts: new Date(2026, 7, 10, 22, 10 + i).getTime(), line: r.line + "夜" })));
  const split = m.weekBlocks(oneDay);
  assert.ok(split.length >= 2, "一整天不能算成一件事，实得 " + split.length + " 块");
  assert.ok(split.some(b => /前半|后半/.test(b.label)), "要按最长静默切开");

  // 空周不报错
  assert.deepEqual(m.weekBlocks([]), []);
});

test("分块渲染带编号，且预算按块平摊不让第一块吃光", () => {
  const m = run();
  const rows = [1, 2, 3].flatMap(d => Array.from({ length: 40 }, (_, i) =>
    ({ ts: new Date(2026, 7, 9 + d, 9, i).getTime(), line: "甲：" + "字".repeat(30) })));
  const blocks = m.weekBlocks(rows);
  const text = m.blocksToText(blocks, 3000);
  blocks.forEach(b => assert.ok(text.indexOf("【素材块 " + b.id + "｜") > -1, b.id + " 要出现在渲染里"));
  assert.ok(text.length <= 3000 + blocks.length * 60, "总量不该超预算太多");
});

test("选材顺序按期轮换，但同一期永远一样（可重出）", () => {
  const m = run();
  const vs = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const key = k => m.pickOrder(vs, k).map(v => v.id).join("");
  assert.equal(key("2026-W33"), key("2026-W33"), "同一期重出必须同序");
  const seen = new Set(["2026-W30", "2026-W31", "2026-W32", "2026-W33", "2026-W34", "2026-W35"].map(key));
  assert.ok(seen.size >= 3, "几期之间要真的换过顺序，实得 " + [...seen].join("/"));
});

test("批量结果按选材顺序消费，被认领的块后来者拿不到", () => {
  const seg = weekly.slice(weekly.indexOf("const takenBlocks = new Set(), takenEvents = new Set();"),
    weekly.indexOf("function pickOrder"));
  assert.match(seg, /const ordered = order\.map/, "必须按【我们定的选材顺序】消费，不是模型的输出顺序");
  assert.match(seg, /if \(known && takenBlocks\.has\(blk\)\) return;/);
  assert.match(seg, /if \(k && takenEvents\.has\(k\)\) return;/, "块内还可能拆出同一件事，再兜一层");
});

test("单版重刷直接看不到被认领的块，而不是只被口头劝阻", () => {
  const seg = weekly.slice(weekly.indexOf("async function genMedia(active, voice"),
    weekly.indexOf("async function genMediaBatch"));
  assert.match(seg, /const free = \(o\.blocks \|\| \[\]\)\.filter/);
  assert.match(seg, /if \(free\.length\) material = blocksToText\(free, 8000\);/, "看不见就写不出来");
  assert.match(seg, /别的版面已经认领走了其余几块/);
  assert.match(weekly, /usedBlocks: window\.Weekly\.claimedBlocks\(issue\.sections, sec\.id\)/);
  assert.match(weekly, /function claimedBlocks\(sections, exceptSecId\)/);
});
