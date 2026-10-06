const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("TA出的题：揭题草稿认题不认页，交的一定是她写的那道", () => {
  assert.doesNotMatch(src, /revealVal/);
  assert.match(src, /value: revealDraft\.id === e\.id \? revealDraft\.text : ""/);
  assert.match(src, /if \(revealDraft\.id === e\.id && onReveal && onReveal\(e\.id, revealDraft\.text\)\)/);
});
test("「最后一页」落成真页码，新题不抢她正看的那页", () => {
  assert.match(src, /if \(mine\.length && pageIdx > mine\.length - 1\) setPageIdx\(mine\.length - 1\);/);
});
