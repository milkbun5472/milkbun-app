const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("论坛的提示词带着「论坛里的今天」，照主面具那只钟", () => {
  const i = app.indexOf("const forumNowLine = () =>");
  assert.ok(i > 0);
  assert.match(app.slice(i, i + 600), /vclockMainMap\(Date\.now\(\)\)/);
  const j = app.indexOf("const forumLoreLine = w =>"), body = app.slice(j, app.indexOf("\n  };", j));
  assert.match(body, /if \(!lore && !name\) return forumNowLine\(\);/);
  assert.match(body, /\+ forumNowLine\(\);$/m);
});
