const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs"); const vm = require("vm");
const ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const studio = fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8");
const grab = (src, start, end) => { const i = src.indexOf(start); assert.ok(i >= 0, start); const j = src.indexOf(end, i); assert.ok(j > i, end); return src.slice(i, j); };
const wb = grab(ui, "function WorldBook(", "function WorldBookEntryPage(");
const ed = grab(ui, "function WorldBookEntryPage(", "function charWorldsSave(");

test("长按夹名＝选中这一夹：跟长按一条同一个计时，选的就是这一夹列着的那几条", () => {
  assert.match(wb, /const pressFolder = ids => \{[^\n]*setSel\(new Set\(ids\)\)/);
  assert.match(wb, /"data-wk": "lorefolderhead"[^\n]*if \(pressed\.current\)/);
  assert.match(wb, /onTouchStart: \(\) => pressFolder\(ids\)/);
  assert.match(wb, /const ids = items\.map\(e => e\.id\);/);
});

test("多选底栏四个键，停用挪进「更多」；更多里整批改走 bulk → onBulk 那一条存", () => {
  assert.match(wb, /\["更多", \(\) => setMore\("menu"\)\]/);
  assert.match(wb, /if \(k === "off"\) \{ bulk\(\{ enabled: false \}\)/);
  assert.match(wb, /const apply = \(\) => \{ bulk\(loreBulkPatch\(more,/);
  assert.match(wb, /const bulk = patch => \{ if \(onBulk\) onBulk\(selIds\(\), patch\)/);
  // 删除照旧进「最近删除」
  assert.match(wb, /onBulkDelete && onBulkDelete\(selIds\(\)\)/);
  // 写入方：onBulk 和单条 onSave 都落在 saveLore
  assert.match(app, /onBulk: \(ids, patch\) => \{\s*const set = new Set\(ids \|\| \[\]\);\s*saveLore\(/);
  assert.match(app, /onSave: e => saveLore\(/);
});

test("整批改用的是编辑一条那几块控件，不另画一份", () => {
  for (const c of ["LoreWhoPick", "LoreCategoryPick", "LorePriorityPick", "LoreScopePick"]) {
    assert.match(ui, new RegExp("function " + c + "\\("));
    assert.match(ed, new RegExp("h\\(" + c + ","), c + " 编辑页");
    assert.match(wb, new RegExp("h\\(" + c + ","), c + " 多选");
  }
  assert.doesNotMatch(ed, /const toggleChar/);
});

test("loreBulkPatch：给谁/分类/顺序/去处真改到每条上，side 留着", () => {
  const ctx = {};
  vm.runInNewContext(grab(ui, "const LORE_SCOPE_UI = [", "// 每枚章的全名单") + grab(ui, "const loreScopeEnabled =", "const loreScopeNames") +
    grab(ui, "function loreBulkPatch(", "function WorldBook(") + "this.P = loreBulkPatch; this.E = loreScopeEnabled;", ctx);
  // 照 app.js onBulk 写回的样子跑一遍
  const run = (list, ids, patch) => { const s = new Set(ids); return list.map(e => s.has(e.id) ? (typeof patch === "function" ? patch(e) : { ...e, ...patch }) : e); };
  const list = [{ id: "a", charIds: ["c1"], scope: { chat: true, side: "offline", diary: true }, priority: 3, category: "世界观" }, { id: "b", charIds: [], priority: 5 }, { id: "z", charIds: ["c9"] }];
  let out = run(list, ["a", "b"], ctx.P("who", ["c2"]));
  assert.deepEqual(out.map(e => e.charIds), [["c2"], ["c2"], ["c9"]]);
  out = run(out, ["a", "b"], ctx.P("cat", "规则"));
  assert.deepEqual(out.map(e => e.category), ["规则", "规则", undefined]);
  out = run(out, ["a", "b"], ctx.P("prio", 1));
  assert.deepEqual(out.map(e => e.priority), [1, 1, undefined]);
  out = run(out, ["a", "b"], ctx.P("scope", { chat: true, social: true }));
  assert.equal(out[0].scope.side, "offline");
  assert.equal(ctx.E(out[0], "diary"), false); assert.equal(ctx.E(out[1], "social"), true); assert.equal(ctx.E(out[1], "chat"), true);
  out = run(out, ["b"], ctx.P("scope", { diary: true }));
  assert.equal(ctx.E(out[1], "chat"), false);
});

test("新挂点都登记在 theme-studio", () => {
  for (const k of ["lorefolderhead", "loremore", "loremoreopt", "loremoreedit", "loremorego"]) {
    assert.match(wb, new RegExp('"data-wk": "' + k + '"'));
    assert.match(studio, new RegExp('\\["' + k + '"'));
  }
});
