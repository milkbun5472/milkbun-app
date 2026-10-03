const test = require("node:test");
const assert = require("node:assert");
const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
test("phone album photo of her locks her face; both → duo", () => {
  assert.match(app, /const herIn = !!\(profile && profile\.refPhoto\) && \(scene\.indexOf\(uN\) >= 0 \|\| \/她\|你\/\.test\(scene\)\);/);
  assert.match(app, /pRefs = \[char\.refPhoto, profile\.refPhoto\]/);
  assert.match(app, /\{ kind: "other" \}\); pRefs = \[profile\.refPhoto\];/);
  assert.match(app, /const out = await generateSelfieImage\(pFinal, pRefs, \{\}\);/);
});
