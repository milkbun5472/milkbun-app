const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const s = fs.readFileSync("js/engine.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8");
const f = new Function(s.slice(s.indexOf("function photoDuoSaid"), s.indexOf("function buildPhotoPrompt(")) + ";return photoDuoSaid;")();
test("画面里没提另一个人就不是合照", () => {
  assert.equal(f("他靠在窗边看手机，逆光", "Lisa"), false);
  assert.equal(f("和她在海边的合照", "Lisa"), true);
  assert.equal(f("Lisa 靠在他肩上睡着了", "Lisa"), true);
  assert.equal(f("两个人挤在镜头前", "Lisa"), true);
});
test("单聊、群聊、线下三处都过这道", () => {
  assert.equal((app.match(/typeof photoDuoSaid === "function" && !photoDuoSaid\(/g) || []).length, 3);
});
