// 片刻（她 2026-10-15）：双击点赞冒心、评论能发表情、点名字进主页、刷点评论、照片当视频发
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const src = (fs.readFileSync(__dirname + "/../js/shua-core.js", "utf8") + "\n" + fs.readFileSync(__dirname + "/../js/shua.js", "utf8")), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("双击画面点赞（只点亮不取消），点在按钮上不算", () => {
  assert.match(src, /if \(now - tapRef\.current < 300\)/);
  assert.match(src, /if \(!v\.liked\) onLike\(\);/);
  assert.match(src, /closest\("button,a,input,textarea,label"\)\) return;/);
});
test("评论能发表情、认识的人名字点进主页", () => {
  assert.match(src, /h\(StickerPanel, \{ packs: emotePacks, onPick: sendEmo \}\)/);
  assert.match(src, /onSend: \(x, emo\) => comment\(v\.id, x, emo\)/);
  assert.match(src, /onPerson: id => charOf\(id\) \? setPage\(\{ kind: "acct", charId: id, back: page \}\)/);
  assert.match(app, /emotePacks: emotePacksForChar\("__nobody__"\)/);
});
test("刷点评论：不用自己评论，路人一批，有的回楼", () => {
  assert.match(src, /const moreComments = async vid =>/);
  assert.match(src, /"刷点评论"/);
  assert.match(src, /写正好 " \+ n \+ " 条刚刷到这条的陌生网友的评论/);
});
test("发视频能放一张照片当画面", () => {
  assert.match(src, /resizeImageFile\(f, 1280, 0\.86\)/);
  assert.match(src, /\.\.\.\(d\.img \? \{ img: d\.img, photo: true \} : \{\}\)/);
});
