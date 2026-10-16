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

// 「改成闺蜜空间就不会当成情侣了吧」——查出来群聊、梦、抽卡、他俩关系那句还在按恋人走，一并接上
test("恋人向的地方只认恋人空间：群聊那句、梦、抽卡、旁观关系都问 spaceLover", () => {
  const dream = fs.readFileSync(path.join(__dirname, "..", "js", "dream.js"), "utf8");
  const dj = fs.readFileSync(path.join(__dirname, "..", "js", "dreamjournal.js"), "utf8");
  assert.match(eng, /function spaceLover\(cp\) \{ return !!\(cp && cp\.status === "together" && spaceRelKey\(cp\) === "lover"\); \}/);
  assert.match(app, /if \(cp\.status === "together" && !spaceLover\(cp\)\) return spaceRelLine\(/);
  assert.match(app, /\{ couple: spaceLover\(cp\), have: gachaHave\(char\) \}/);
  assert.match(app, /const tog = members\.filter\(c => spaceLover\(couples\[c\.id\]\)\)/);
  assert.match(dream, /window\.spaceLover\(cp\)/); assert.match(dj, /window\.spaceLover\(cp\)/);
});

// 她 2026-10-16「可以就这样」：闺蜜 / 挚友 / 家人空间撤掉恋人专属的——婚纱结婚题材、亲密合照姿势、恋爱向的问答题
test("非恋人空间：没有婚纱结婚题材，不抽 ♥ 姿势，问答小本翻不到 love 题", () => {
  const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
  assert.match(app, /wedding:  \{ zh: "婚纱照", lover: true,/);
  assert.match(app, /marriage: \{ zh: "结婚登记照", lover: true,/);
  assert.match(app, /const theme = theme0 && theme0\.lover && notLover \? null : theme0;/);
  assert.match(eng, /const pool = PHOTO_DUO_POSES\.filter\(x => !opts\.notLover \|\| x\.charAt\(0\) !== "♥"\)/);
  assert.match(scr, /COUPLE_QA_BANK\.filter\(x => !x\.love\)/);
  assert.ok((scr.match(/love: 1, cat:/g) || []).length >= 10);
});

// 她 2026-10-16「本子的 1234 可以做」：黑历史案卷、军师观察簿（闺蜜）、人生选择册（挚友）、报平安簿（家人）
test("空间本子：一张表管四本，按关系各拿各的；TA 接话走 runProbe + relSay；存进 IDB 大仓", () => {
  const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
  const i = eng.indexOf("const SPACE_BOOKS = {"), j = eng.indexOf("function spaceBooksFor(", i);
  assert.ok(i > 0 && j > i, "抠不出 SPACE_BOOKS");
  const B = new Function(eng.slice(i, j) + "; return SPACE_BOOKS;")();
  assert.deepEqual(Object.keys(B).map(k => k + ":" + B[k].rel).sort(), ["advisor:bestie", "blackcase:bestie", "choices:friend", "safe:family"]);
  assert.equal(B.safe.closeKind, "到了"); assert.equal(B.choices.closeKind, "结果");
  assert.match(eng, /"x_coupleSweet", "x_spaceBooks",/);
  assert.match(app, /const spaceBookTa = async \(char, key, id\) =>/);
  assert.match(app, /instruction: relSay\(char\) \+ "。" \+ bk\.taReply/);
  assert.match(scr, /function SpaceBook\(\{ partner, book, entries/);
  assert.match(scr, /sub\.indexOf\("book:"\) === 0/);
});
