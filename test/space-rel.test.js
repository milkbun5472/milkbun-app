// 她 2026-10-16：群友跟闺蜜开了情侣空间、情书当了真 →「做吧」：空间分关系
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
function load() {
  const i = eng.indexOf("const SPACE_RELS = {"), j = eng.indexOf("function buildBundle(", i);
  assert.ok(i > 0 && j > i, "抠不出 SPACE_RELS..coupleStatusLines");
  const g = {}; new Function("g", "takenByOthersLine", eng.slice(i, j).replace(/if \(typeof window[^\n]*\n/, "") + "\ng.lines = coupleStatusLines; g.key = spaceRelKey;")(g, () => "");
  return g;
}
test("闺蜜空间：给模型的那句说清不是恋人；恋人照旧；老存档没写关系算恋人", () => {
  const g = load();
  const b = g.lines({ coupleStatus: "together|12|bestie" }, "她").join("");
  assert.match(b, /不是恋人/); assert.match(b, /闺蜜空间/);
  assert.match(g.lines({ coupleStatus: "together|12|lover" }, "她").join(""), /现在是恋人/);
  assert.match(g.lines({ coupleStatus: "together|12" }, "她").join(""), /现在是恋人/);
  assert.equal(g.key({ status: "together" }), "lover");
});
test("各处 instruction 不再手写「你们是恋人」，都问 relSay", () => {
  assert.equal((app.match(/instruction: "你们是恋人/g) || []).length, 0);
  assert.ok((app.match(/instruction: relSay\(char\)/g) || []).length >= 13);
  assert.match(app, /return "together\|" \+ \(days \|\| ""\) \+ "\|" \+ rk;/);
});

// 她 2026-10-16：「别的关系角色也可以发邀请信」
test("TA 的申请信可以带关系：{rel,text} 落成带 rel 的信，答应了按那层关系开空间", () => {
  assert.match(app, /const _letterRel = _llObj \? spaceRelKey\(_llObj\.rel\) : "lover";/);
  assert.match(app, /kind: "loveletter", rel: _letterRel,/);
  assert.match(app, /beginCouple\(charId, m\.rel\)/);
  assert.match(app, /const rk0 = spaceRelKey\(relOverride \|\| \(couplesRef\.current \|\| \{\}\)\[charId\]\);/);
  assert.match(app, /\\"rel\\":\\"bestie\|friend\|family\\"/);
});
