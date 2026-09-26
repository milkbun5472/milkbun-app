// 她 2026-09-26：「单聊有一个可以选择篇幅自然长度和沉浸长文的，给群聊也加上吧」。
// 按 one-public-mechanism 办：先抽公共的一份，单聊那两处（提示词、界面）也搬过去，
// 不在群那头照着再抄一遍——照抄的话以后改措辞永远只改到一处。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), engine = R("engine.js"), components = R("components.js");

const offlineLengthGuide = (() => {
  const a = engine.indexOf("function offlineLengthGuide(mode)");
  const b = engine.indexOf("function offlineGroupHistory(msgs, userName, clock)", a);
  assert.ok(a > 0 && b > a, "抠不出 offlineLengthGuide");
  return new Function(engine.slice(a, b) + "; return offlineLengthGuide;")();
})();

test("两档说的还是原来那两句", () => {
  assert.match(offlineLengthGuide("immersive"), /^本轮采用【沉浸长文】/);
  assert.match(offlineLengthGuide("natural"), /^本轮采用【自然长度】/);
  assert.equal(offlineLengthGuide(""), offlineLengthGuide("natural"), "没设过＝自然长度");
  assert.equal(offlineLengthGuide(undefined), offlineLengthGuide("natural"));
});

test("单人线下和群线下都问这一份，不许各写各的", () => {
  assert.equal((engine.match(/offlineLengthGuide\(/g) || []).length, 3, "一处定义、两处调用");
  assert.match(engine, /const lenGuide = offlineLengthGuide\(lengthMode\);/, "单人线下没搬过去");
  assert.match(engine, /offlineLengthGuide\(session\.lengthMode === "immersive" \? "immersive" : "natural"\)/, "群线下没接上");
});

test("群线下把设置递给了引擎（存档键和单聊同名）", () => {
  assert.match(app, /lengthMode: osFor\("g_" \+ group\.id\)\.lengthMode \|\| "natural"/);
  assert.match(app, /lengthMode: osFor\(charId\)\.lengthMode \|\| "natural"/, "单聊那处是这条的样板，别动坏了");
});

test("界面也是公共那一段，单聊和群聊各挂一次", () => {
  assert.match(components, /function OfflineLengthModeSection\(\{ value, onChange \}\)/);
  assert.equal((components.match(/h\(OfflineLengthModeSection, \{ value: sLengthMode, onChange: setSLengthMode \}\)/g) || []).length, 2, "单聊、群聊各挂一处");
  assert.match(components, /\{ v: "natural", t: "自然长度" \}, \{ v: "immersive", t: "沉浸长文" \}/);
});

test("群那边存得下、读得回", () => {
  const groupUi = components.slice(components.indexOf("function GroupOfflineMode({"));
  assert.match(groupUi, /const \[sLengthMode, setSLengthMode\] = useState\(os\.lengthMode === "immersive" \? "immersive" : "natural"\)/);
  assert.match(groupUi, /minWords: sMinW, lengthMode: sLengthMode,/, "没写进 onSaveSettings 就是存不下");
});
