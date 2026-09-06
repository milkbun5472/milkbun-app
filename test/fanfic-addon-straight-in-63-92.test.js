// 加笔：进去就改文（她 2026-09-05：「那个加笔玩法改一下，去掉那个选身份和记忆，
// 就直接进去改文。然后现在还是会生成一个作者简介，但是在生成作者的时候已经有了」）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const fic = fs.readFileSync(__dirname + "/../js/fanfic.js", "utf8");

test("那一屏整个没了：view 只剩 list | pick | thread", () => {
  const app = fic.slice(fic.indexOf("  function RPApp(props) {"), fic.indexOf("  // 书脊：这一版书被你改成什么样"));
  assert.match(app, /const \[view, setView\] = useState\("list"\); \/\/ list \| pick \| thread/);
  assert.doesNotMatch(fic, /view === "setup"/, "撤东西要删干净，别留半条线");
  // 那一屏上的三样选择、以及它们的 state，一样都不许留着
  //（RP_KNOWS 那几档留在库里只为老存档读得出，见它上面那段注释——所以只看这一屏）
  ["你穿成谁", "你带着什么进去", "从哪儿进去", "setLandings", "setAuthorCard", "setKnow(", "setMode("]
    .forEach(x => assert.equal(app.indexOf(x), -1, "还留着：" + x));
});

test("挑一篇＝直接开一局，中间不再有第二枪", () => {
  const app = fic.slice(fic.indexOf("  function RPApp(props) {"), fic.indexOf("  // 书脊：这一版书被你改成什么样"));
  assert.ok(app.length > 800, "抠不出 RPApp");
  // 两个入口（列表里点一篇 / 从作者主页点「加笔」带一篇进来）都走同一个 startSession，
  // 不许各写一份——一层写在两处，第二处迟早跟不上。
  assert.equal((app.match(/startSession\(f\)/g) || []).length, 2, "两个入口没有合到一处");
  assert.match(app, /function startSession\(fic\) \{/);
  // 从原文第一段起读，不再有落点
  assert.match(app, /paraIdx: 0, voided: \[\]/);
  assert.doesNotMatch(app, /rpFindPara/, "还在按落点找起始段");
  // 开一局不花钱：这一步一次模型调用都没有
  assert.doesNotMatch(app.slice(app.indexOf("function startSession(")), /await window\.Fanfic\.gen/);
});

test("老存档还读得出来：没有 landing 的那几局不许炸", () => {
  // ⚠️新局压根没有 session.landing 这一栏，直接 .label 会整条链当场炸
  assert.doesNotMatch(fic, /session\.landing\.label/, "还有地方直接摸 landing.label");
  const f = fic.slice(fic.indexOf("  function rpStartLine(session) {"), fic.indexOf("  function rpAnchorLine("));
  assert.match(f, /if \(ld && ld\.label\)/, "老存档那一支没了");
  assert.match(f, /从这篇文的开头起/, "新局那一支没了");
  // 三处（开场 / 每一拍 / 收尾）都走这一个，不许各拼各的
  assert.equal((fic.match(/\n      rpStartLine\(session\) \+/g) || []).length, 3);
  // 存档行也不许直接摸那几栏
  assert.match(fic, /\(s\.landing && s\.landing\.label\) \|\| ""/);
});

// ── 顺手抓出来的三个（她 2026-09-05：「你再看看有没有别的bug」）──────────
test("原文第一段立刻摆上，不等骨架那一枪", () => {
  const st = fic.slice(fic.indexOf("    async function start() {"), fic.indexOf("    // 往下读一段原文"));
  assert.ok(st.length > 300, "抠不出 start()");
  // ① 摆原文那一步在【调用之前】，而且不看 props.active
  const putIdx = st.indexOf('ss.transcript = paras[i0] ? [{ who: "src"');
  const callIdx = st.indexOf("await window.Fanfic.genRPStart(");
  assert.ok(putIdx > 0 && callIdx > putIdx, "原文还压在那一枪后面：那一枪失败＝整页空白");
  assert.ok(st.indexOf('if (!props.active) return;') > putIdx, "没配 API 就一个字都读不到");
  assert.match(st, /if \(\(ss\.transcript \|\| \[\]\)\.length\) return ss;/, "重进一次会把读过的段落抹掉");
  // ② 那一枪回来只补骨架，不再重写 transcript
  assert.match(st, /props\.onUpdate\(function \(ss\) \{ ss\.beats = r\.beats \|\| \[\]; ss\.updatedAt = Date\.now\(\); return ss; \}\);/);
  // ③ 那一枪失败过的局，下次打开补抽（存下来的空数组不算失败）
  assert.match(fic, /if \(trans\.length === 0 \|\| !s\.beats\) start\(\);/);
});

test("作者页那个字数是真的——章节存的那一栏叫 content", () => {
  // ⚠️施工规则/stub-from-the-writer.md：照着【写存档的那段】认字段名。
  const w = fic.match(/chapters: \[\{ content: x\.body, endHook: x\.endHook/);
  assert.ok(w, "写入方改了字段名，读的那头得跟上");
  assert.doesNotMatch(fic, /words \+= String\(\(c && c\.body\) \|\| ""\)\.length/, "又在数一个不存在的栏");
  assert.doesNotMatch(fic, /n2 \+ String\(\(c && c\.body\) \|\| ""\)\.length/, "目录那一行也在数不存在的栏");
  const stt = fic.slice(fic.indexOf("  function authorStats(name, fics) {"), fic.indexOf("  // 正字计数"));
  assert.match(stt, /words \+= ficWords\(f\);/);
});

test("authorStats / authorFace 各只有一份", () => {
  ["function authorStats(", "function authorFace(", "function authorSeal("].forEach(function (f) {
    assert.equal(fic.split(f).length - 1, 1, "重复定义了：" + f + "（后一份会静默盖掉前一份）");
  });
});
