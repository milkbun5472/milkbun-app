const test = require("node:test");
const assert = require("node:assert");
const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
test("letter answer: reply not gated as proactive; answer note reaches history", () => {
  assert.match(app, /if \(opts\.proactive && !opts\.loveLetterAnswer && !autoRefreshOn\("proactive", charId\)\) return null;/);
  assert.match(app, /if \(opts\.proactive && !opts\.loveLetterAnswer && currentlyTogetherWithChar\(charId\)\) return null;/);
  assert.match(app, /const _letterAns = m => m && m\.kind === "system" && \(m\.sub === "letter" \|\| \/\^你答应了/);
  assert.match(app, /kind: "letteranswer", content: "〔" \+ userName\(profile\) \+ " 拆开了你的申请信/);
  assert.match(app, /\{ role: "system", kind: "system", sub: "letter", content: yes \?/);
});
test("letter answer reply skips the 12-minute anti-burst gate", () => {
  assert.match(app, /if \(opts\.proactive && !opts\.promise && !opts\.phoneAs && !opts\.loveLetterAnswer && history\.length\)/);
});
