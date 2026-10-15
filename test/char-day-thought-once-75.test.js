// TA的一天：手动想一次不再顺手打开自动（她 2026-10-16）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", f), "utf8");
test("看看TA在想什么＝once；没开自动时换一个也只想一次；存的时候不要求开关开着", () => {
  const t = R("js/char-day-thoughts.js"), c = R("js/char-day.js");
  assert.ok(/const refresh=async\(manual=false,once=false\)=>/.test(t));
  assert.ok(/if\(\(!o\.enabled&&!once\)/.test(t));
  assert.ok(/\(!once&&raw\?\.enabled!==true\)/.test(t));
  assert.ok(/refresh:\(\)=>refresh\(true,!options\.enabled\),once:\(\)=>refresh\(true,true\)/.test(t));
  assert.ok(/onClick:\(\)=>thought\.once\(\)/.test(c));
  assert.ok(!/onClick:\(\)=>thought\.setEnabled\(true\)/.test(c));
});
