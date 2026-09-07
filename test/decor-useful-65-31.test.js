const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

test("五款相框只从新建库退役，旧桌面仍保留画法", () => {
  for (const id of ["locket2", "window4", "drawer4", "news4", "receipt2"]) {
    assert.match(src, new RegExp(id + ": 1"));
    assert.match(src, new RegExp('frame === "' + id + '"'));
  }
  assert.match(src, /function homePhotoFramePickable\(\)/);
});

test("自由拼图允许一至六张并提供四种排法", () => {
  for (const id of ["freeSide", "freeRows", "freeStack", "freeScatter"]) assert.match(src, new RegExp('id: "' + id + '"'));
  assert.match(src, /need: 6/);
  assert.match(src, /var filled = srcs\.map/);
  assert.match(src, /filter\(function \(x\) \{ return !!x\.src; \}\)/);
});

test("实用装饰有不同默认占格并使用对应编辑控件", () => {
  for (const id of ["countdown", "anniversary", "rotate", "shortcut", "spacer"]) assert.match(src, new RegExp('id: "' + id + '"'));
  assert.match(src, /if \(it\.which === "countdown"\) return \[2, 1\]/);
  assert.match(src, /if \(it\.which === "anniversary"\) return \[3, 1\]/);
  assert.match(src, /if \(it\.which === "spacer"\) return \[1, 1\]/);
  assert.match(src, /type: "date"/);
  assert.match(src, /每天自动换一行/);
  assert.match(src, /onOpenApp\(it\.decor\.detail \|\| "memo"\)/);
});
