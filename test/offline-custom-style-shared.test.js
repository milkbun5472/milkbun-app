const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const src = fs.readFileSync(require("node:path").join(__dirname, "../js/components.js"), "utf8");
const start = src.indexOf("function useOfflineCustomStyles(");
const code = src.slice(start, src.indexOf("function OfflineMode(", start));
const clone = x => JSON.parse(JSON.stringify(x));
function fixture() {
  let stored = [], ok = true, selected = "default", cursor = 0;
  const cells = [], notices = [];
  const ctx = {
    useState(init) {
      const i = cursor++;
      if (!(i in cells)) cells[i] = typeof init === "function" ? init() : init;
      return [cells[i], v => { cells[i] = typeof v === "function" ? v(cells[i]) : v; }];
    },
    useRef(init) { const [v] = ctx.useState(() => ({ current: init })); return v; },
    h: (type, props, ...children) => ({ type, props: props || {}, children }),
    loadJSON: key => { assert.equal(key, "x_offlineStyles"); return clone(stored); },
    saveJSON: (key, value) => { assert.equal(key, "x_offlineStyles"); if (ok) stored = clone(value); return ok; },
    readOfflineStyleDocument: file => file.text(),
    toast: message => notices.push(message), alert: message => notices.push(message),
    OFFLINE_STYLES: [{ key: "default", name: "默认", prompt: "" }],
    F_BODY: "body", F_DISPLAY: "display", OfflineStylePromptPreview: () => null,
    requestAppConfirm: () => {}
  };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  const t = { line: "#ccc", ink: "#111", bg: "#fff", bg2: "#eee", fog: "#888", sub: "#333", tint: "#555" };
  return {
    render() { cursor = 0; return ctx.useOfflineCustomStyles(t, selected, key => { selected = key; }); },
    section: editor => ctx.OfflineCustomStyleSection({ t, editor }),
    stored: () => stored, selected: () => selected, fail: () => { ok = false; }, notices
  };
}
function create(f) {
  let e = f.render(); e.setCName2("  我的文风  "); e.setCPrompt("  自己写的提示  ");
  e = f.render(); e.saveCustomStyle(); return f.render();
}
test("新建、编辑沿用真实写入结构，编辑不新增条目", () => {
  const f = fixture(); let e = create(f);
  assert.equal(f.stored().length, 1);
  const row = f.stored()[0];
  assert.deepEqual(Object.keys(row).sort(), ["custom", "key", "name", "prompt"]);
  assert.equal(row.name, "我的文风"); assert.equal(row.custom, true);
  e.editCustomStyle(row.key, "sheet"); e = f.render();
  assert.equal(e.styleSheet, true); assert.equal(e.cPrompt, row.prompt);
  e.setCPrompt("修改后的正文"); e = f.render(); e.saveCustomStyle(); e = f.render();
  assert.equal(f.stored().length, 1); assert.equal(f.stored()[0].key, row.key);
  assert.equal(f.stored()[0].prompt, "修改后的正文");
  assert.equal(e.styleSheet, false); assert.equal(e.editingStyleKey, "");
  e.editCustomStyle(row.key); assert.equal(f.render().custOpen, true);
});
test("写入失败保留草稿，不假装选中或关闭", () => {
  const f = fixture(); let e = f.render();
  e.setCName2("未存"); e.setCPrompt("还在草稿"); e.setStyleSheet(true);
  f.fail(); e = f.render(); e.saveCustomStyle(); e = f.render();
  assert.equal(f.stored().length, 0); assert.equal(f.selected(), "default");
  assert.equal(e.cPrompt, "还在草稿"); assert.equal(e.styleSheet, true);
});
test("删除失败不丢当前预设，成功才恢复默认", () => {
  const f = fixture(); let e = create(f); const key = f.selected();
  f.fail(); e.delCustomStyle(key); e = f.render();
  assert.equal(e.customStyles.length, 1); assert.equal(f.selected(), key);
  const g = fixture(); e = create(g); e.delCustomStyle(g.selected());
  assert.equal(g.render().customStyles.length, 0); assert.equal(g.selected(), "default");
});
test("文件导入成功落库、清空文件框，失败不报成功", async () => {
  for (const success of [true, false]) {
    const f = fixture(), e = f.render();
    if (!success) f.fail();
    const input = e.styleImportControl.children[1];
    const target = { files: [{ name: "文风.md", text: async () => "文件正文" }], value: "selected" };
    await input.props.onChange({ target });
    assert.equal(target.value, "");
    assert.equal(f.stored().length, success ? 1 : 0);
    assert.equal(f.notices.some(n => n.startsWith("已导入文风")), success);
    if (success) assert.deepEqual(f.stored()[0], { key: f.selected(), name: "文风", prompt: "文件正文", custom: true, imported: true });
  }
});
test("单人和群聊的编辑草稿互不串用", () => {
  const a = fixture(), b = fixture();
  a.render().setCPrompt("单人草稿");
  assert.equal(a.render().cPrompt, "单人草稿"); assert.equal(b.render().cPrompt, "");
});
test("设置区保留原层级与编辑按钮回调", () => {
  const f = fixture(); const e = create(f), tree = f.section(e);
  assert.equal(tree.props.className, "pt-5");
  const find = n => !n || typeof n !== "object" ? null : n.type === "button" && n.children.includes("编辑此预设") ? n : n.children.flat(Infinity).map(find).find(Boolean);
  const edit = find(tree); assert.ok(edit); edit.props.onClick();
  assert.equal(f.render().custOpen, true);
});
test("单人/群聊都绑定公共管理器，开局编辑明确打开弹层", () => {
  assert.equal((src.match(/const styleEditor = useOfflineCustomStyles\(t, styleKey, setStyleKey\);/g) || []).length, 2);
  assert.equal((src.match(/editCustomStyle\(curStyle.key, "sheet"\)/g) || []).length, 2);
  assert.equal((src.match(/const importStyleFile = async/g) || []).length, 1);
});
