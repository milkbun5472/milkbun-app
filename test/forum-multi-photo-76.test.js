const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const s = fs.readFileSync("js/screens.js", "utf8"), ui = fs.readFileSync("js/screens-ui.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8");
const more = new Function(s.slice(s.indexOf("function forumMorePhotos"), s.indexOf("function forumWithPhoto")) + ";return forumMorePhotos;")();
test("第二张起认真图也认字", () => {
  assert.deepEqual(more({ morePhotos: ["海边", { imageRef: "iv_1", desc: "" }, { desc: "" }, null] }), [{ desc: "海边" }, { imageRef: "iv_1", desc: "" }]);
});
test("发帖带上 morePhotos，两种样子都能滑", () => {
  assert.match(app, /const postMyForum = \(board, title, body, photo, as, more\)/);
  assert.match(app, /morePhotos: forumMorePhotos\(\{ morePhotos: more \}\)/);
  assert.match(ui, /cbMore\.map\(photoAttachValue\)\.filter\(Boolean\)/);
  assert.match(ui, /xhsPhotos\(p\),   \/\/ 好几张就左右滑/);
});
