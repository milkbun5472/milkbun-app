const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const g = fs.readFileSync("js/games.js", "utf8"), list = fs.readFileSync("js/games-list.js", "utf8"), idx = fs.readFileSync("index.html", "utf8");
test("斗兽棋挂进小游戏柜", () => {
  assert.match(list, /key: "jungle", emoji: "🦁", zh: "斗兽棋"/);
  assert.match(g, /if \(session\.game\.key === "jungle" && window\.JungleCore\) return h\(JungleGame, engineProps\);/);
  assert.match(g, /const C = window\.JungleCore, KEY = "jungle", ZH = "斗兽棋";/);
  assert.match(idx, /data-lazy="games" data-src="js\/jungle-core\.js\?v=/);
  assert.match(g, /jungle:    \{ paper:/);
  assert.match(g, /\["chess", "xiangqi", "go", "jungle"\]\.indexOf\(game\.key\) >= 0 && !spectate \? h\("div", \{ "data-wk": "boardteach"/);
});
