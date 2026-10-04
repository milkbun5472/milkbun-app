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
test("answer row tells him the button IS her answer; don't keep asking", () => {
  assert.match(app, /点了「答应」——这就是她的回答[^"]*别再追问她答不答应/);
});
