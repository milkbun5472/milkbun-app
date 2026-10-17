// 她 2026-10-17 转群里两条许愿：聊天/群聊背景也能面纱＋虚化；自己开的吧能写吧规
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const comp = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
test("单聊、群聊都铺 ChatBgLayer，设置页都有 WallFxRows 并存回 chatBgFx", () => {
  assert.equal((comp.match(/h\(ChatBgLayer, \{/g) || []).length, 2);
  assert.equal((comp.match(/h\(WallFxRows, \{ t, fx: chatBgFx/g) || []).length, 2);
  assert.ok(/chatBg: chatBg, chatBgFx: chatBgFx/.test(comp) && /chatBg,\n\s+chatBgFx,/.test(comp));
  assert.ok(/chatBgFx: settingsFor\(activeChar\.id\)\.chatBgFx/.test(app));
});
test("没调过就跟原来一样直接铺图", () => {
  const a = comp.indexOf("function chatBgFxOn("), b = comp.indexOf("function CoupleInviteCard(");
  const f = new Function("h", comp.slice(a, b) + "; return { chatBgFxOn, chatBgStyle };")(() => null);
  assert.ok(f.chatBgStyle("x.png", null, "#fff").backgroundImage);
  assert.ok(f.chatBgStyle("x.png", { veil: 0, blur: 0 }, "#fff").backgroundImage);
  assert.equal(f.chatBgStyle("x.png", { veil: 10, blur: 0 }, "#fff").backgroundImage, undefined);
});
test("吧规一行一条，最多八条，序号去掉；自带吧照旧读写死那份", () => {
  const a = scr.indexOf("function forumBoardRulesOf("), b = scr.indexOf("function forumBoardAbout(");
  const f = new Function("FORUM_BOARD_RULES", "forumCustomBoards", scr.slice(a, b) + "; return { forumBoardRulesOf, forumRulesFromText };")(
    { "吐槽吧": ["x"] }, () => [{ name: "猫吧", rules: ["别晒狗", "", "图要原创"] }]);
  assert.deepStrictEqual(f.forumRulesFromText("1. 别晒狗\n\n2、图要原创\n" + "a\n".repeat(10)).slice(0, 2), ["别晒狗", "图要原创"]);
  assert.equal(f.forumRulesFromText("a\n".repeat(20)).length, 8);
  assert.deepStrictEqual(f.forumBoardRulesOf("猫吧"), ["别晒狗", "图要原创"]);
  assert.deepStrictEqual(f.forumBoardRulesOf("吐槽吧"), ["x"]);
  assert.deepStrictEqual(f.forumBoardRulesOf("没有吧"), []);
});
