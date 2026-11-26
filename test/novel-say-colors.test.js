// 整段小说每个人台词不同颜色（群里 2026-11-24「还是显示不出来」）：角色没设颜色、或撞色，也要分得开
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const c = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const cut = (a, b) => c.slice(c.indexOf(a), c.indexOf(b, c.indexOf(a)));
const src = cut("function offSpeakerAt(", "function offBody(");
const { offNovelPeople, offSpeakerAt } = new Function(src + "\nreturn { offNovelPeople, offSpeakerAt };")();

test("没设颜色、撞了色的人各拿一个不一样的", () => {
  const ps = offNovelPeople([{ name: "陆衍" }, { name: "沈屿", color: "#c25a4a" }, { name: "周", color: "#c25a4a" }], { name: "我" }, "#c25a4a");
  const cols = ps.map(p => p.color.toLowerCase());
  assert.strictEqual(new Set(cols).size, cols.length, cols.join(","));
  assert.strictEqual(ps[ps.length - 1].color, "#c25a4a", "我还是主题色");
});

test("认得出是谁说的：前面最近的名字，没有就看后面紧跟的", () => {
  const ps = offNovelPeople([{ name: "陆衍" }, { name: "沈屿" }], null, "");
  const t = "陆衍靠在门边。「你来了。」\n「嗯。」沈屿说。";
  const a = t.indexOf("「你来了"), b = t.indexOf("「嗯");
  assert.strictEqual(offSpeakerAt(t, a, a + 6, ps).names[0], "陆衍");
  assert.strictEqual(offSpeakerAt(t, b, b + 4, ps).names[0], "沈屿");
});

test("整段小说那张卡走这一处", () => {
  assert.match(c, /isNovel && cast\.length \? offNovelPeople\(cast\.map\(o => o\.c\), meChar, t\.accent\) : null/);
});
