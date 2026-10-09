const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("情侣空间封面两枚头像有挂点，分得清他和我", () => {
  assert.match(scr, /const ringed = \(ch, ring, ml, who\) => h\("div", \{ "data-wk": "usavatar", "data-who": who,/);
  assert.match(scr, /"data-wk": "uspair"/);
  assert.match(scr, /ringed\(paChar, ringA, 0, "ta"\)/);
  assert.match(scr, /ringed\(myChar, ringB, -OVER, "me"\)/);
});
