// 她开的吧，角色平时自己发帖也会去（她 2026-10-25「角色不会主动去那边发」）：代码先掷，三成多直接定在她开的某个吧
const test = require("node:test"), assert = require("node:assert/strict");
const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "../js/app.js"), "utf8");
test("有她开的吧时先掷一次，掷中就定在那个吧（匿名去匿名吧那一半不动）", () => {
  assert.match(app, /let fixedBoard = opts && opts\.board \? String\(opts\.board\) : "";/);
  assert.match(app, /if \(!fixedBoard && !forceAnon && myBoardsForPost\.length && Math\.random\(\) < 0\.35\) fixedBoard = myBoardsForPost\[Math\.floor\(Math\.random\(\) \* myBoardsForPost\.length\)\]\.name;/);
  // 定在那个吧时，照她写的「聊什么」那句写
  assert.match(app, /fixedBoard \? "\\n\\n【这一帖发在「" \+ fixedBoard \+ "」】" \+ forumBoardVoice\(fixedBoard\)/);
});
