const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("正打着电话：三处来电出口都先问 onCallNow", () => {
  assert.match(app, /const onCallNow = \(\) => !!\(callRef\.current && !callRef\.current\.endTs\);/);
  assert.match(app, /const callMode = !onCallNow\(\) && parsed\.call/);
  assert.match(app, /const gcm = !onCallNow\(\) && item\.call/);
  assert.match(app, /if \(onCallNow\(\)\) \{ if \(\(callRef\.current\.participants \|\| \[\]\)\.some\(x => x && x\.id === pm\.charId\)\) drop\(\); continue; \}/);
});
