const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const core = fs.readFileSync(__dirname + "/../js/shua-core.js", "utf8"), shua = fs.readFileSync(__dirname + "/../js/shua.js", "utf8"),
  live = fs.readFileSync(__dirname + "/../js/live.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("片刻：路人视频、直播路人主播都读「公开世界」那份世界书，跟今日热门同一份（群友 2026-10-26）", () => {
  assert.match(app, /const shuaWorldHint = \(\) => String\(loreForContext\("social", \[\], ""\) \|\| ""\)\.slice\(0, 3000\);/);
  assert.match(app, /const liveProps = \{\n\s*worldHint: shuaWorldHint,/);
  assert.match(app, /worldHint: shuaWorldHint,\n/);
  assert.match(core, /function npcSystem\(uName, persona, n, skin, hot, regs, world(, nowTs)?\) \{\n\s*return AC\(\) \+ CB\(\) \+ worldLine\(world\)/);
  assert.match(shua, /regsText\(\), props\.worldHint \? props\.worldHint\(\) : ""[,)]/);
  assert.match(live, /function strangerSystem\(n, hot, date, kinds, world\)/);
  assert.match(live, /kinds, props\.worldHint \? props\.worldHint\(\) : ""\)/);
  const wl = new Function(core.slice(core.indexOf("  function worldLine"), core.indexOf("\n", core.indexOf("  function worldLine"))) + "; return worldLine;")();
  assert.equal(wl(""), ""); assert.match(wl("武侠江湖"), /【这个世界】\n武侠江湖/);
});
