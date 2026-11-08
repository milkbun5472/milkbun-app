const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// 群里 2026-11-08：开吧时定楼主正文字数区间、每次刷新出几条
test("forumBoardGenOf：读吧上存的分寸，区间倒着填会摆正，条数封顶 10", () => {
  const src = read("js/screens.js");
  const body = src.slice(src.indexOf("function forumBoardGenOf("), src.indexOf("function forumBoardAbout("));
  let boards = [];
  const f = new Function("forumCustomBoards", body + "; return forumBoardGenOf;")(() => boards);
  boards = [{ name: "甲吧", lenMin: "300", lenMax: "100", batch: "20" }];
  assert.deepEqual(f("甲吧"), { lenMin: 100, lenMax: 300, batch: 10 });
  assert.deepEqual(f("没有的吧"), { lenMin: 0, lenMax: 0, batch: 0 });
});
test("刷新新帖照这个吧的分寸写；开吧页存下这三格", () => {
  const app = read("js/app.js"), ui = read("js/screens-ui.js");
  assert.match(app, /const _gen = typeof forumBoardGenOf === "function" \? forumBoardGenOf\(board\)/);
  assert.match(app, /" 生成 " \+ _gN \+ " 条不同网友刚发的新主帖/);
  assert.match(app, /body（楼主正文" \+ _gLen \+ "）/);
  assert.match(ui, /lore: lore \}, gen/);
  assert.match(ui, /createdAt: Date\.now\(\) \}, gen/);
  assert.match(ui, /"data-wk": "foboardgen"/);
});
