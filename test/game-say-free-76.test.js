// 她 2026-10-23：小游戏里陪聊别限一次一个气泡；也不封顶（「有些人就是话多」）；提示词不写条数
const assert = require("node:assert/strict");
const g = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "games.js"), "utf8");
assert.match(g, /const GAME_SAY_FREE = "照你平时说话的样子，想说几句就几句，一句一条；没什么想说的可以不说。";/);
assert.ok(!/GAME_SAY_CAP/.test(g), "又封顶了");
assert.ok(!/\d+\s*[~～到]\s*\d+\s*个此刻最有反应|各说一句 28 字内/.test(g), "大富翁又在定人数、定一句");
assert.ok(!/最多三句|"说一句。"\)/.test(g));
// 五子棋（说话＋落子）、两个棋、俄罗斯方块、你画我猜、大富翁都接了
assert.ok((g.match(/GAME_SAY_FREE/g) || []).length >= 7);
const sayList = new Function(g.match(/function sayList\(v\) \{[^\n]*\}/)[0] + " return sayList;")();
assert.deepEqual(sayList(["a", " ", "b", "c", "d", "e", "f", "g"]), ["a", "b", "c", "d", "e", "f", "g"]);
assert.deepEqual(sayList("一句"), ["一句"]);
console.log("ok");
