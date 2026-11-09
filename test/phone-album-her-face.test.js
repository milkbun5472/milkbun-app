const test = require("node:test");
const assert = require("node:assert");
const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
test("phone album photo of her locks her face; both → duo", () => {
  assert.match(app, /const albumHerShot = \(char, scene, again\) => \{/);
  assert.match(app, /refs: both \? \[char\.refPhoto, profile\.refPhoto\] : \[profile\.refPhoto\]/);
  assert.match(app, /const her = albumHerShot\(char, scene, again\);/);
  assert.match(app, /const out = await generateSelfieImage\(pFinal, pRefs, faceShot \? \{ minimalPrompt:[^\n]*\} : \{\}\);/);   // TA露脸那种带上保脸备用稿（2026-10-31）
});
test("recognises her by nickname / common pet names; tells her when she has no ref photo", () => {
  assert.match(app, /宝宝\|宝贝\|老婆\|媳妇\|女朋友/);
  assert.match(app, /但你还没传自己的参考照/);
});

test("她自己发来的自拍只画她、按她自己拍的画；「自拍」不再算合照（2026-10-31）", () => {
  assert.match(app, /const herSelf = \/她\(\?:半夜\|刚才\|今天\|昨晚\|早上\|晚上\)\?\(\?:发来\|发给我\|传来\|自拍\)/);
  assert.match(app, /const both = !!char\.refPhoto && !herSelf && \/合照\|我们\|一起\|两个人\|和她\|跟她\|我和\/\.test\(scene\);/);
  assert.match(app, /kind: herSelf \? "selfie" : "other"/);
});
