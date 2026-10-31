// 群红包自己发的自己也能抢，三秒后角色开抢（2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8"), c = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("自己发的不再挡在外面", () => {
  const a = app.indexOf("const claimRedPacket = "), body = app.slice(a, a + 600);
  assert.doesNotMatch(body, /if \(rp\.byMe\) return "own";/);
  assert.match(c, /const canOpen = !mine && \(rp\.claims \|\| \[\]\)\.length < rp\.count/);
  assert.match(app, /const RP_GRAB_DELAY = 3000;/);
});
