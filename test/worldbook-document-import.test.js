const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8");
const start = src.indexOf("  const importDocument = async e => {", src.indexOf("function WorldBookEntryPage("));
const end = src.indexOf("\n  };", start);
assert.ok(start > 0 && end > start);
const body = src.slice(start, end + 5);
function fixture(reader = async file => file.text(), initial = null) {
  let draft = initial, error = "", busy = false;
  const lock = { current: false };
  const run = new Function("importLock", "setImporting", "setImportError", "setF", "readOfflineStyleDocument",
    body + "\nreturn importDocument;")(lock, x => { busy = x; }, x => { error = x; }, x => { draft = x(draft); }, reader);
  const input = file => ({ target: { files: file ? [file] : [], value: "selected" } });
  return { run, input, state: () => ({ draft, error, busy }) };
}
test("TXT 与 DOCX 经公共解析器进入草稿，不自动保存", async () => {
  for (const name of ["城邦.txt", "城邦.DOCX"]) {
    let parsed;
    const f = fixture(async file => { parsed = file; return "第一段\n第二段"; });
    const file = { name, size: 100 }, e = f.input(file);
    await f.run(e);
    assert.equal(parsed, file); assert.equal(e.target.value, "");
    assert.deepEqual(f.state(), { draft: { title: "城邦", payload: "第一段\n第二段" }, error: "", busy: false });
    assert.doesNotMatch(body, /onSave\(|saveJSON\(/);
  }
});
test("空文档、损坏文档、类型和大小错误都不生成词条", async () => {
  for (const [file, reader, message] of [
    [{ name: "a.txt" }, async () => " \n", /没有可导入/],
    [{ name: "a.docx" }, async () => { throw Error("不是有效的 DOCX 文件"); }, /不是有效/],
    [{ name: "a.exe" }, async () => { throw Error("不能读"); }, /请选择/],
    [{ name: "a.txt", size: 21 * 1024 * 1024 }, async () => "x", /超过 20 MB/]
  ]) {
    const f = fixture(reader); await f.run(f.input(file));
    assert.equal(f.state().draft, null); assert.equal(f.state().busy, false); assert.match(f.state().error, message);
  }
});
test("读取期间重复选择只解析一次，结束后可再选同一个文件", async () => {
  let resolve, calls = 0;
  const f = fixture(() => { calls++; return new Promise(r => { resolve = r; }); });
  const file = { name: "a.txt" }, first = f.run(f.input(file));
  await f.run(f.input(file)); assert.equal(calls, 1); assert.equal(f.state().busy, true);
  resolve("正文"); await first;
  const next = f.run(f.input(file)); assert.equal(calls, 2); resolve("新版"); await next;
  assert.equal(f.state().draft.payload, "新版");
});
test("取消文件选择不改变草稿或状态", async () => {
  const f = fixture(); await f.run(f.input(null));
  assert.deepEqual(f.state(), { draft: null, error: "", busy: false });
});
test("导入草稿完整传入现有编辑页，保留角色与去向确认", () => {
  assert.match(body, /setF\(current => \(\{ \.\.\.current, title:/);
  assert.match(src, /importError && h\("div", \{ role: "alert"/);
  assert.match(src, /onChange: importDocument/);
  assert.match(src, /scope: \{ chat: true, subjects: false/);
});
test("导入只更新标题正文，保留已经选择的角色、关键词与去向", async () => {
  const initial = { charIds: ["c1"], scope: { chat: false, study: true }, keyword: "城邦", alwaysOn: false, category: "地点" };
  const f = fixture(async () => "新正文", initial);
  await f.run(f.input({ name: "新标题.txt" }));
  assert.deepEqual(f.state().draft, { ...initial, title: "新标题", payload: "新正文" });
});
test("目录不摆导入入口，新建页通过公共顶栏右侧导入，旧词条仍能删除", () => {
  const a = src.indexOf("function WorldBook("), b = src.indexOf("function WorldBookEntryPage(", a);
  const list = src.slice(a,b), page = src.slice(b,src.indexOf("\nfunction ",b+1));
  assert.doesNotMatch(list, /importDocument|importRef|导入文件/);
  assert.match(page, /h\(Head, \{ zh: isNew \? "新建设定"/);
  assert.match(page, /right: isNew \? h\("button"/);
  assert.match(page, /importing \? "读取中" : "导入"/);
  assert.match(page, /onDelete \? h\("button", \{ onClick: onDelete/);
  assert.match(page, /minWidth: 40, minHeight: 40/);
});
