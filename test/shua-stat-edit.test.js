const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const s = fs.readFileSync(__dirname + "/../js/shua.js", "utf8");
test("片刻「我」页获赞、粉丝能自己改，按号分开记，清空回到算出来的", () => {
  assert.match(s, /const acctKey = onCp \? "cp:" \+ cpId : onAlt \? "alt" : "main";/);
  assert.match(s, /\[ov\.likes != null \? ov\.likes : calcLikes, "获赞", "likes"\]/);
  assert.match(s, /if \(!t\) delete mine2\[k\];/);
  assert.match(s, /"data-wk": "shuastat"/);
});
