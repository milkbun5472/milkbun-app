// 「Ta 眼里」不许拿她自己的设定充数（她 2026-09-04 报）
//
// 她原话：「新角色这块都是第一个填然后都是直接抄我的人设润色一下😅」
// 两个症状，两个不同的病根：
//
// ① 只有第一块有字 —— seedSpec 那份示例【自己示范了「person 有字、其余九块全 null」】。
//    示例会被逐字照抄，**连填法也会**（.claude/rules/prompt-no-content-samples.md）。
// ② 那一块是人设的润色版 —— 新角色手上除了她写的设定本来就没有别的材料，
//    「你从相处里看出了什么」只能靠复述人设来答。
//
// 所以两手：提示词加围栏（降概率）+ 建卡门槛从 10 条抬到 30 条（代码才保证）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const gaze = fs.readFileSync(path.join(root, "js/gaze.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const mkG = () => {
  const store = {};
  const ctx = { console, Math, Date, JSON, String, Number, Object, Array, RegExp,
    React: { useState: () => [null, () => {}] },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx); vm.runInContext(gaze, ctx);
  return ctx.Gaze;
};

test("那条围栏两路共用，只写一份", () => {
  assert.equal((gaze.match(/const NOT_PROFILE = uName =>/g) || []).length, 1, "围栏抄成了两份");
  assert.equal((gaze.match(/NOT_PROFILE\(uName\)/g) || []).length, 2, "两路里有一路没挂上");
  const G = mkG();
  assert.match(G.spec("Lisa"), /绝不许复述她的设定/, "每轮那一路没挂");
  assert.match(G.seedSpec("Lisa"), /绝不许复述她的设定/, "建卡那一次没挂");
  // 围栏要说清「凭什么算写过」：能落回具体的事，落不回就填 null
  assert.match(G.seedSpec("Lisa"), /每一句都得能落回某一次具体的对话、某件真发生过的事/);
  assert.match(G.seedSpec("Lisa"), /填 null 比编一句漂亮话强/);
});

test("⚠️建卡那份示例不许再示范「填一块、其余全 null」", () => {
  const G = mkG();
  const spec = G.seedSpec("Lisa");
  // 旧那份是 {"person":"…","soft":null,...} —— 模型连这个填法一起照抄
  assert.ok(spec.indexOf('"soft":null') < 0 && spec.indexOf('"what":null') < 0,
    "示例里还留着 null，等于在示范「这一块不用填」");
  assert.ok(spec.indexOf('"person":"…"') < 0, "还留着那个省略号占位");
  // 十栏都得出现，而且每一栏写的是【说明】不是样例内容
  ["person", "soft", "like", "recent", "unread", "what", "how", "marks", "elephant", "want"]
    .forEach(k => assert.ok(spec.indexOf('"' + k + '":"') > 0, k + " 这一栏没了或还是 null"));
  assert.match(spec, /别照着下面这份的样子来,它只是在说明每一栏是什么/, "没说清那是说明不是样例");
  assert.match(spec, /十块都要过一遍/, "没让它十块都想一遍——那就还是只填第一块");
});

test("说明被原样抄回来的，代码这一道要挡住", () => {
  // 「规则降概率，代码才保证」：提示词说了别照抄，这儿再兜一道。
  const G = mkG();
  assert.equal(G.seed("c1", { me: { person: "她是个什么样的人" } }), 0, "把说明抄回来也算写了");
  assert.equal(G.seed("c1", { me: { person: "她的软肋和雷区" } }), 0, "别的块的说明也不该收");
  assert.equal(G.seed("c1", { us: { want: "我担心的、我想要的" } }), 0, "带顿号的那几条没挡住");
  // 真内容照收
  assert.equal(G.seed("c1", { me: { person: "她说要早睡，结果又熬到两点在改那个配色。" } }), 1);
});

test("门槛抬到 30 条：材料不够就先不建卡", () => {
  // 十条≈五个来回，那时候除了她写的设定本来就没有别的材料。
  // 这是【代码保证】那一半；她想早点看，状态卡页那个手动按钮照旧随时能按。
  assert.match(app, /const GAZE_AUTOSEED_MSGS = 30;/, "门槛没抬");
  assert.match(app, /只会是人设复读/, "没写清为什么抬——下一个人会给它调回去");
  assert.match(app, /if \(msgs\.length \+ \(Number\(extra\) \|\| 0\) < GAZE_AUTOSEED_MSGS\) return/, "门槛没生效");
  // 手动那一路【不受】这道门槛管（她自己按的，材料够不够她说了算）
  assert.match(app, /const seedGazeFor = async \(char, auto\) => \{/);
  const seg = app.slice(app.indexOf("const seedGazeFor = async (char, auto)"), app.indexOf("const seedGazeFor = async (char, auto)") + 700);
  assert.ok(seg.indexOf("GAZE_AUTOSEED_MSGS") < 0, "手动按钮也被那道门槛挡住了");
});
