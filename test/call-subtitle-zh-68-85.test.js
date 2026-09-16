// 她 2026-09-16：「如果开了流式通话，对面说日语的话，翻译也会显示在字幕上吗」
// ——原来【不会】。
//
// 双语那一层在通话里本来就有：callBilingualLines 把 zh 挂在这一句上，
// 不流式的那条路（气泡列表）一直在显示它（TransText 的 zhReady）。
// 偏偏中间那块流式字幕只取了 line.text —— 又是一层写在两处、第二处没跟上。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// 把 CallSubtitle 抠出来，在桩里真跑一遍（正则断言拦不住「渲染时才炸」那一类）
function renderSubtitle(line, opts) {
  const i = comp.indexOf("function CallSubtitle(");
  const src = comp.slice(i, comp.indexOf("\nfunction CallScreen(", i));
  let idx = 0;
  const env = {
    h: (type, props, ...kids) => ({ type, props: props || {}, kids }),
    useState: init => [typeof init === "function" ? init() : init, () => {}],
    useEffect: () => {}, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    F_BODY: "B", F_DISPLAY: "D"
  };
  // n 从 0 起跳（useState 桩不跑 effect），所以单独喂一个进度进去
  const names = Object.keys(env);
  const body = src.replace("const [n, setN] = useState(0);", "const n = __N;")
    .replace("function CallSubtitle(", "function CallSubtitle(__N, ") + "\nreturn CallSubtitle;";
  const fn = new Function(...names, body)(...names.map(k => env[k]));
  return fn((opts && opts.n) == null ? String((line && line.text) || "").length : opts.n,
    { line, onPhoto: false, actions: [] });
}
const flat = node => {
  const out = [];
  (function walk(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    out.push(n); walk(n.kids);
  })(node);
  return out;
};
const zhRow = node => flat(node).find(x => x.props && x.props["data-call-subtitle-zh"]);

test("外语那一句，中译也上字幕", () => {
  const node = renderSubtitle({ text: "もう寝た？", zh: "睡了吗？" });
  const row = zhRow(node);
  assert.ok(row, "流式字幕没有中译那一行");
  assert.equal(String(row.kids), "睡了吗？");
});

test("说中文的那几条不该多出一行空的", () => {
  assert.equal(zhRow(renderSubtitle({ text: "睡了吗", zh: "" })), undefined);
  assert.equal(zhRow(renderSubtitle({ text: "睡了吗" })), undefined);
  // 没人说话的时候整块照旧留着位子（v67.46 那个「输入框跑到屏幕中间」的老病）
  const empty = renderSubtitle({ text: "", zh: "睡了吗？" });
  assert.ok(flat(empty).some(x => x.props && x.props["data-call-subtitle"]), "这块地方不能整个消失");
  assert.equal(zhRow(empty), undefined, "原文还没出来就先摆中文，等于剧透");
});

test("中译跟原文同一个进度铺：不许一眼读完中文就不用听了", () => {
  const line = { text: "もう寝た？おやすみ", zh: "睡了吗？晚安" };   // 9 : 6
  const third = renderSubtitle(line, { n: 3 });
  assert.equal(String(zhRow(third).kids), "睡了", "进度没跟着原文走（原文走了 3/9，中译就该走 2/6）");
  assert.equal(String(zhRow(renderSubtitle(line, { n: 9 })).kids), "睡了吗？晚安");
});

test("喂进来那一句得带上 zh，而且只有这一个口子", () => {
  assert.match(app, /pushMsg\(\{ role: "char", senderId: char\.id, senderName: char\.name, content: ln\.speech, zh: ln\.zh \}\)/,
    "流式那条路落气泡时没带 zh");
  assert.match(comp, /setSubLine\(\{ text: m\.content, zh: m\.zh \|\| "", ms: abuf\.duration \* 1000/);
  assert.equal((comp.match(/setSubLine\(\{ text:/g) || []).length, 1, "喂字幕只该有这一处");
  // 不流式那条路本来就在显示中译——两边现在说的是同一件事
  assert.match(comp, /h\(TransText, \{ text: m\.content, isU, zhReady: m\.zh/);
});
