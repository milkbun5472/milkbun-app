const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("她叫他帮她换她自己的头像：开 myAvatar，换 myChatAvatar；这一轮不问换他自己的", () => {
  const re = new Function(app.match(/const MY_AVATAR_ASK_RE = (\/[^\n]+\/);/)[0].replace("const MY_AVATAR_ASK_RE = ", "return ").replace(/;$/, ""))();
  ["帮我换个头像", "把我的头像换成这张", "给我设成头像吧", "换我的头像"].forEach(t => assert.ok(re.test(t), t));
  ["你换个头像吧", "你的头像好看"].forEach(t => assert.ok(!re.test(t), t));
  assert.match(app, /openCaps\.push\("myAvatar"\)/);
  assert.match(app, /pC\(p => p\.map\(x => x\.id === charId \? \{ \.\.\.x, myChatAvatar: msg\.imageRef \} : x\)\)/);
  assert.match(app, /&& !_myAvatarPick;/);
  assert.ok(app.indexOf("const _myDone") < app.indexOf("const _pairDone"));
});
