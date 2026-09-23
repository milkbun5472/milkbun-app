// 她开的吧：存了之后还能编辑（名字/简介/颜色）；颜色一吧一个，不再全是论坛主色
// （她 2026-09-23：「存了吧之后不能编辑了吗」「新开的吧颜色都一样改一改吧」）。
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const sc = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
let store = [];
const box = { loadJSON: () => store, FORUM_SKIN: { accent: "#000", soft: "x" }, FORUM_BOARDS: ["吐槽吧"] };
vm.createContext(box);
const grab = (a, b) => { const i = sc.indexOf(a); assert(i >= 0, a); return sc.slice(i, sc.indexOf(b, i)); };
vm.runInContext(grab("const FORUM_BOARD_SKIN = {", "// ── 她自己开的吧").replace(/const /g, "var ") + grab("function forumCustomBoards()", "// 吧名统一成") + grab("function forumHash(", "\n") + "\n", box);
store = [{ name: "足球吧" }, { name: "猫猫吧" }, { name: "摄影吧", skin: 3 }];
assert.notStrictEqual(String(box.forumBoardSkin("足球吧")), String([box.FORUM_SKIN.accent, box.FORUM_SKIN.soft]), "她开的吧不再落到论坛主色");
assert.strictEqual(String(box.forumBoardSkin("足球吧")), String(box.forumBoardSkin("足球吧")), "同一个吧永远同一个色");
assert.strictEqual(box.forumBoardSkin("摄影吧")[0], box.FORUM_CUSTOM_SKINS[3][0], "挑过的按她挑的");
assert.strictEqual(String(box.forumBoardSkin("吐槽吧")), String(box.FORUM_BOARD_SKIN["吐槽吧"]), "内置的吧不变");
// 编辑：有入口、改名时帖子跟着挪
assert(/editOf: tab/.test(sc), "横杠上要有编辑入口");
assert(/if \(name !== from && onRenameBoard\) onRenameBoard\(from, name\)/.test(sc));
assert(/onRenameBoard: renameForumBoard/.test(app));
assert(/x && x\.board === from \? \{ \.\.\.x, board: to \} : x/.test(app));
console.log("forum-board-edit-color ok");
