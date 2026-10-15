// 照片里的「我」跟着他认的那张面具（她 2026-10-16「改吧」）
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js/app.js"), "utf8");
test("photoMe / canShootMe 认 who；单聊、线下、群、照相馆都把人带进去", () => {
  assert.ok(/const meOf = who => !who \? profile : String\(who\)\.indexOf\("g:"\) === 0 \? meOfGroup/.test(app));
  assert.ok(/const photoMe = \(fallbackName, who\) => \{ const P = meOf\(who\);/.test(app));
  assert.ok(/const canShootMe = who => \{ const P = meOf\(who\);/.test(app));
  assert.ok(!/canShootMe\(\)/.test(app), "还有不带人的 canShootMe()");
  assert.ok(!/photoMe\("[^"]*"\)/.test(app), "还有不带人的 photoMe");
  assert.ok(/const profile = meOf\(char && char\.id\);   \/\/ 照片里的我照他认的那张面具/.test(app));
  assert.ok(/const meWho = groupId \? "g:" \+ groupId : char\.id/.test(app));
});
