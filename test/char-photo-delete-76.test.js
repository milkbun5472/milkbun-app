// 「TA 们拍的照片」能删：看大图删一张、多选删一批（2026-11-01）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
const a = ui.indexOf("function CharPhotoAlbum("), blk = ui.slice(a, ui.indexOf("function LocalPhotoLibrary(", a));
test("删一张和删一批走同一个 delKeys，连原图一起删，先问一句", () => {
  assert.match(blk, /const delKeys = ks =>/);
  assert.match(blk, /await idbImgDel\(k\); await idbImgDel\(k \+ "_raw"\)/);
  assert.match(blk, /onClick: \(\) => delKeys\(\[item\.key\]\)/);
  assert.match(blk, /onClick: \(\) => delKeys\(Array\.from\(pick\)\)/);
});
test("多选：右上「多选」，格子点了是勾，有全选", () => {
  assert.match(blk, /"data-wk": "charphotopick"/);
  assert.match(blk, /onClick: \(\) => pick \? setPick\(/);
  assert.match(blk, /"全不选" : "全选"/);
});
test("本机照片库也能多选移出", () => {
  const b = ui.indexOf("function LocalPhotoLibrary("), lb = ui.slice(b, b + 9000);
  assert.match(lb, /"data-wk": "localphotopick"/);
  assert.match(lb, /const dropMany = ks =>/);
  assert.match(lb, /await idbAlbumDel\(k\)/);
});
test("两个照片栏多选都能「存 N 张」，走 saveImgsBatch", () => {
  assert.match(ui, /async function savePickedImgs\(refs, name, toast, keepLeft\)/);
  assert.match(ui, /"data-wk": "charphotosavemany"/);
  assert.match(ui, /"data-wk": "localphotosavemany"/);
});
