// 一次选好几份备份（群里 2026-10-28：「导入恢复图片只能一个一个点吗，每恢复一个就要从头再点进去」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");
const app = rd("app.js"), ui = rd("screens-ui.js");
test("选文件那一处能多选，整份名单交给 onImport", () => {
  assert.match(ui, /type: "file", accept: ANY_FILE, multiple: true, className: "hidden", onChange: e => \{\n\s*const fs = e\.target\.files; if \(fs && fs\.length\) onImport\(fs\);/);
});
test("文字那份一定排在图片包前面：它会把图库清掉", () => {
  const i = app.indexOf("const doImportFiles = async files => {"), j = app.indexOf("\n  };", i);
  assert.ok(i > 0 && j > i, "抠不出 doImportFiles");
  const f = app.slice(i, j);
  assert.match(f, /rows\.sort\(\(a, b\) => \(a\.media \? 1 : 0\) - \(b\.media \? 1 : 0\) \|\| a\.part - b\.part\);/);
  assert.match(f, /await doImportText\(rows\[i\]\.text, \{ noReload: true \}\)/, "每一份都要先别重载");
  assert.match(f, /if \(ok\) setTimeout\(\(\) => location\.reload\(\)/, "全部导完才重载一次");
});
test("单份那条路照旧，只是绕到同一个口子", () => {
  assert.match(app, /const doImport = file => doImportFiles\(\[file\]\);/);
  assert.match(app, /const reloadIn = ms => \{ if \(!\(opts && opts\.noReload\)\) setTimeout\(\(\) => location\.reload\(\), ms\); \};/);
  // 导入那一段里只许有【一处】重载，就是 reloadIn 自己；别处再写一处就绕过了 noReload
  const body = app.slice(app.indexOf("const doImportText = async (raw, opts)"), app.indexOf("const doImport = file =>"));
  assert.equal((body.match(/setTimeout\(\(\) => location\.reload\(\)/g) || []).length, 1, "导入里还留着绕过 noReload 的重载");
});
