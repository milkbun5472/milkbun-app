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
  assert.match(app, /return "together\|" \+ \(days \|\| ""\) \+ "\|" \+ rk \+ "\|" \+ String\(cp\.role/);
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
  assert.match(app, /\{ couple: spaceLover\(cp\), have: gachaHave\(char\)( \}|, )/);   // 后面可以再带别的（v75.959 加了 lucky）
  assert.match(app, /const tog = members\.filter\(c => spaceLover\(couples\[c\.id\]\)\)/);
  assert.match(dream, /window\.spaceLover\(cp\)/); assert.match(dj, /window\.spaceLover\(cp\)/);
});

// 她 2026-10-16「可以就这样」：闺蜜 / 挚友 / 家人空间撤掉恋人专属的——婚纱结婚题材、亲密合照姿势、恋爱向的问答题
test("非恋人空间：没有婚纱结婚题材，不抽 ♥ 姿势，问答小本翻不到 love 题", () => {
  const scr = (fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8"));
  assert.match(app, /wedding:  \{ zh: "婚纱照", lover: true,/);
  assert.match(app, /marriage: \{ zh: "结婚登记照", lover: true,/);
  assert.match(app, /const theme = theme0 && theme0\.lover && notLover \? null : theme0;/);
  // v76.776 起小时候的合照也不抽 ♥ 姿势：判据多了一个 younger，并在 notLover 旁边
  assert.match(eng, /const pool = PHOTO_DUO_POSES\.filter\(x => !\(opts\.notLover \|\| younger\) \|\| x\.charAt\(0\) !== "♥"\)/);
  assert.match(scr, /COUPLE_QA_BANK\.filter\(x => !x\.love\)/);
  assert.ok((scr.match(/love: 1, cat:/g) || []).length >= 10);
});

// 她 2026-10-16「本子的 1234 可以做」：黑历史案卷、军师观察簿（闺蜜）、人生选择册（挚友）、报平安簿（家人）
test("空间本子：一张表管四本，按关系各拿各的；TA 接话走 runProbe + relSay；存进 IDB 大仓", () => {
  const scr = (fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8"));
  const i = eng.indexOf("const SPACE_BOOKS = {"), j = eng.indexOf("function spaceBooksFor(", i);
  assert.ok(i > 0 && j > i, "抠不出 SPACE_BOOKS");
  const B = new Function(eng.slice(i, j) + "; return SPACE_BOOKS;")();
  assert.deepEqual(Object.keys(B).map(k => k + ":" + B[k].rel).sort(), ["advisor:bestie", "blackcase:bestie", "choices:friend", "complain:family", "credit:friend", "favor:family", "mouth:bestie", "safe:family"]);
  assert.equal(B.safe.closeKind, "到了"); assert.equal(B.choices.closeKind, "结果");
  assert.match(eng, /"x_coupleSweet", "x_spaceBooks",/);
  assert.match(app, /const spaceBookTa = async \(char, key, id\) =>/);
  assert.match(app, /instruction: relSay\(char\) \+ "。" \+ bk\.taReply/);
  assert.match(scr, /function SpaceBook\(\{ partner, book, entries/);
  assert.match(scr, /sub\.indexOf\("book:"\) === 0/);
});

// 她 2026-10-16「一起」：家人细分（哥哥姐姐弟弟妹妹爸妈……）——手足别演成操心长辈
test("家人细分：role 进关系那句，只说身份、不写怎么当", () => {
  const g = load();
  const b = g.lines({ coupleStatus: "together|5|family|哥哥" }, "她").join("");
  assert.match(b, /你是 她 的哥哥/); assert.match(b, /照你的人设和你们一起过来的经历/);
  // 只给身份不给剧本（她：「这也是八股限制吧，每个兄弟姐妹都不一样」）
  assert.doesNotMatch(b, /互损|护短|操心的长辈|抢东西/);
});

// 她 2026-10-16「每个 ui 都弄好看点，判据是如果在别的 app 成立那就是做坏了」：八本各长各的
test("本子各长各的：卷宗、诉状、批注、对照卡、岔路、签名页、一路的站、账本", () => {
  const scr = (fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8"));
  const i = scr.indexOf("function SpaceBook("), j = scr.indexOf("function CoupleFirstsBook(", i);
  assert.ok(i > 0 && j > i);
  const f = scr.slice(i, j);
  ["blackcase", "complain", "advisor", "mouth", "choices", "credit", "safe", "favor"].forEach(k => assert.match(f, new RegExp('book\\.key === "' + k + '"'), k + " 没有自己的长相"));
});

// 她：「你这只是换了个颜色喂」——四本换的是形状：档案袋点开成卷宗、诉状点开分原告被告席、卡片能翻面、车票带一条路
test("本子长成那样东西：档案袋、庭审两边、翻面卡、车票", () => {
  const scr = (fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8"));
  const i = scr.indexOf("function SpaceBook("), j = scr.indexOf("function CoupleFirstsBook(", i);
  const f = scr.slice(i, j);
  assert.match(f, /"← 合上卷宗"/); assert.match(f, /"原告席 · "/); assert.match(f, /rotateY\(180deg\)/); assert.match(f, /\["出门", "路上", "到了"\]/);
  assert.match(f, /OBJ\[book\.key\] && list\.length \? objView\(\)/);
});

// 她：「但是背景都还是这种纸张」——四本各有自己的布景，不铺那张纸
test("本子布景：木桌、小法庭、软木板、站台", () => {
  const scr = (fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8"));
  const i = scr.indexOf("function SpaceBook("), j = scr.indexOf("function CoupleFirstsBook(", i);
  const f = scr.slice(i, j);
  ["blackcase", "complain", "mouth", "safe"].forEach(k => assert.match(f, new RegExp("    " + k + ": \\{ ink: ")));
  assert.match(f, /style: sc \? sc\.page : cpSkin\(t, "page"\)/);
  assert.match(f, /ink: sc \? sc\.ink : undefined/);
});
// 她 2026-10-16「567 也做了」：门牌 / 东西在谁那儿 / 留灯——事实进 TA 的上下文，留灯过早上六点熄
test("空间门口：spaceDoor 进 coupleStatusLines，x_spaceHome 走 IndexedDB 那一批，SpaceDoor 三块都在", () => {
  const g = load();
  const out = g.lines({ coupleStatus: "together|3|bestie|", spaceDoor: "【留灯】她今晚给你留了灯", char: { id: "c" } }, "她");
  assert.ok(out.includes("【留灯】她今晚给你留了灯"));
  assert.ok(!g.lines({ coupleStatus: "together|3|bestie|", spaceDoor: "x", notRoleplay: true, char: { id: "c" } }, "她").includes("x"));
  assert.match(eng, /"x_spaceBooks", "x_spaceHome",/);
  assert.match(app, /const spaceDoorLine = \(char, uN\) =>/);
  assert.match(app, /const lightLit = x =>/);
  assert.match(app, /if \(pl\.edit === "me"\) throw new Error/);
  const scr = (fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8"));
  const i = scr.indexOf("function SpaceDoor("), j = scr.indexOf("function Us(", i);
  assert.ok(i > 0 && j > i);
  ["usplaque", "usthing", "uslight", "usplaqueta"].forEach(k => assert.ok(scr.slice(i, j).includes('"data-wk": "' + k + '"'), k));
  assert.match(scr, /bestie: \{ days: \["闺蜜盖章", "天"\]/);
});
// 她 2026-10-17：先做了「没换衣服的动作不认新衣服」，她：「我就是不想挡着他换衣服 我只是嫌他该换不换」——撤掉拦截，只留提醒和卡上手改
test("穿着：不在代码里拦他换，提醒他该换就换，状态卡能改穿着", () => {
  assert.match(app, /const putWearing = \(patch, live, value, now\) => putLiveField\(patch, live, "wearing", value, now\);/);
  assert.ok(app.indexOf("WEAR_CHANGE_RE") < 0, "又在拦他换衣服");
  assert.match(app, /这一轮该换就换/);
  assert.match(app, /onSetWearing: roomCard \? null :/);
});
