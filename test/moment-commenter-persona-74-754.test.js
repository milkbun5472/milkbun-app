// 朋友圈里来评论的人各自带上自己的人设（她 2026-10-05：「朋友圈评论的不会看评论的人的语气吧，就看人设」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");

test("只有一份：评论人人设按在场人数分预算，跟群聊同一把尺", () => {
  assert.equal((app.match(/const commenterPersonaBlock = list => \{/g) || []).length, 1);
  assert.match(app, /groupPersonaBudget\(xs\.length\)/);
});
test("三处都接上：角色发圈的评论、她发圈的反应、刷更多评论", () => {
  assert.match(app, /\+ \(peerChars\.length \? "\\n\\n" \+ commenterPersonaBlock\(peerChars\.slice\(0, 6\)\) : ""\),/);
  assert.match(app, /\}\)\.join\("\\n"\) \+ "\\n\\n" \+ commenterPersonaBlock\(canSee\);/);
  assert.match(app, /const peersSeg = commenterPersonaBlock\(rosterChars\.filter\(c => c\.id !== primary\.id\)\);/);
  assert.doesNotMatch(app, /人设\[" \+ String\(c\.persona \|\| ""\)\.slice\(0, 70\)/, "70 字那一刀不许留");
});
