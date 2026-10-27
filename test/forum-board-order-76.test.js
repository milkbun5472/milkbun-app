const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const s = fs.readFileSync("js/screens.js", "utf8"), ui = fs.readFileSync("js/screens-ui.js", "utf8");
const store = {};
const fns = new Function("loadJSON", "FORUM_BOARDS", s.slice(s.indexOf("function forumCustomBoards"), s.indexOf("function forumBoardsShown")) + s.slice(s.indexOf("function forumBoardsShown"), s.indexOf("\n", s.indexOf("function forumBoardsShown"))) + ";return { forumBoardsAll, forumBoardsShown };")(k => store[k], ["吐槽吧", "日常吧", "匿名吧"]);
test("排过的在前，新开的接后面；藏起来的只不在顶上那排", () => {
  store.x_forumBoards = [{ name: "猫吧" }];
  store.x_forumBoardOrder = { order: ["猫吧", "匿名吧", "已删吧"], hidden: ["日常吧"] };
  assert.deepEqual(fns.forumBoardsAll(), ["猫吧", "匿名吧", "吐槽吧", "日常吧"]);
  assert.deepEqual(fns.forumBoardsShown(), ["猫吧", "匿名吧", "吐槽吧"]);
});
test("两排 tab 用 Shown，排序页挂在论坛页", () => {
  assert.match(ui, /\[\.\.\.forumBoardsShown\(\), "关注", "收藏"\]/);
  assert.match(ui, /concat\(forumBoardsShown\(\)\.map\(b => \[b, forumTag\(b\)\]\)\)/);
  assert.match(ui, /saveJSON\("x_forumBoardOrder"/);
  assert.match(ui, /"data-wk": "forumpage"[^\n]*\n    boardSortPage,/);
});
