const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("她能用小号发帖：角色认不出、她自己帖子里回楼也是小号", () => {
  assert.ok(/const postMyForum = \(board, title, body, photo, as\) =>/.test(app));
  assert.ok(/\.\.\.\(altB \? \{ alt: true \} : \{\}\)/.test(app));
  assert.ok(/const meOwn = post\.authorType === "me" && !post\.anon && !post\.alt/.test(app), "楼里的角色不把小号当成她");
  assert.ok(/const myPub = p => p\.authorType === "me" && !p\.anon && !p\.alt/.test(app), "小号帖不进角色知道的那份");
  assert.ok(/post\.alt && post\.authorType === "me"\) \? post\.authorName/.test(app), "她在小号帖里回楼还是小号");
  assert.ok(/onPostMine\(cbBoard, cbTitle\.trim\(\), cbBody\.trim\(\), photoAttachValue\(cbPhoto\), cbAs\)/.test(scr));
  assert.ok(/altName: emAlt\.trim\(\)/.test(scr) && /altName: \(fm && fm\.altName\)/.test(app));
});
test("小号是一个能切的号：回楼、私信都跟着；小号帖没人自动来回；小号私信不进聊天", () => {
  assert.ok(/const usingAlt = post =>/.test(app) && /forumMe\.using === "alt"/.test(app));
  assert.ok(/if \(altB\) \{ setForumComments\(prev => \{ const n = \{ \.\.\.prev, \[rec\.id\]: \[\] \}/.test(app), "小号帖不排队、打开也不现编");
  assert.ok(/t\.charId === char\.id && !t\.alt\);   \/\/ 小号那条线不进来/.test(app));
  assert.ok(/if \(pmChar && th\.alt\)/.test(app), "小号私信角色：他当陌生人");
  assert.ok(/onEditMe\(\{ using: onAlt \? "main" : "alt" \}\)/.test(scr));
});
test("回楼用哪个号只看现在切的号，小号帖底下切了大号就用大号（2026-10-07 群友）", () => {
  const fs2 = require("fs");
  const a2 = fs2.readFileSync(__dirname + "/../js/app.js", "utf8");
  assert.match(a2, /const usingAlt = post => !\(post && \(post\.board === "匿名吧" \|\| post\.anon\)\) && forumMe\.using === "alt";/);
});
