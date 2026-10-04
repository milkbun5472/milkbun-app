const test = require("node:test");
const assert = require("node:assert");
const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
test("letter answer reply is not a proactive turn (gates would swallow it)", () => {
  assert.match(app, /replyNow\(charId, "", null, \{ loveLetterAnswer: yes \? "yes" : "no" \}\);/);
});
test("letter answer note reaches the model history in place", () => {
  assert.match(app, /const _letterAns = m => m && m\.kind === "system" && \(m\.sub === "letter"/);
  assert.match(app, /: _letterAns\(m\) \? _ansRow\(m\) : m\)/);
  assert.match(app, /\{ role: "system", kind: "system", sub: "letter", content: yes \?/);
});
test("answer row states the fact only, no scripted reading of her reply (2026-10-04: 别写死限定)", () => {
  assert.match(app, /点了「答应」，你们从这一刻起在一起了（这是已经发生的事）/);
  assert.doesNotMatch(app, /别再追问她答不答应/);
});
