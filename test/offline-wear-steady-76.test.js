const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
// 群里 2026-11-08：同一场线下出门，一会儿灰外套一会儿黑外套——「过了很久」被当成换衣服的理由
test("线下着装连贯：衣服只在剧情真动到它时才变，不看过了多久", () => {
  assert.doesNotMatch(eng, /除非场景变了、过了很久/);
  assert.match(eng, /这就是这一场里你身上的衣服，颜色、款式、内搭都是这一套，正文里写到衣服也照它。衣服只在剧情里真动到它时才变/);
});
test("换了地方不再把穿着清掉：不逼下一拍现编一身", () => {
  const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
  assert.doesNotMatch(app, /clearWearingOnMove\(/);
});
