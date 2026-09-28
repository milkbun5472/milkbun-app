// 小游戏名单写明性别（群里报 2026-09-28：真心话大冒险把女角色写成了男人）
const fs = require("fs"), assert = require("assert"), vm = require("vm");
const sb = {}; sb.window = sb; vm.runInNewContext(fs.readFileSync(__dirname + "/../js/character-pronoun.js", "utf8"), sb);
const g = sb.CharacterPronoun.genderNote;
assert.strictEqual(g({ gender: "女" }), "（女）"); assert.strictEqual(g({ gender: "male" }), "（男）");
assert.strictEqual(g({ gender: "" }), ""); assert.strictEqual(g({ gender: "TA" }), "");
const games = fs.readFileSync(__dirname + "/../js/games.js", "utf8");
assert.ok(/return \(forUi \? "" : gNote\(p\)\)/.test(games), "真心话每处喂人设都带性别");
assert.ok(/"■ "\+p\.name\+gNote\(p\)\+"｜人设："/.test(games), "另一处名单也带");
assert.ok(/tdDesc\(detail, 0, true\)/.test(games), "界面卡片不显示这个标注");
console.log("games-gender-note ok");
