const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const rule = fs.readFileSync(path.join(root, ".claude/rules/four-surfaces-same-context.md"), "utf8");

// 她 2026-08-24 立的规矩：单人线上 / 单人线下 / 群聊线上 / 群聊线下，
// 喂给模型的东西默认必须一样；差异必须是显式的、写着理由的。
//
// 起因：群里裴照川开始说霸总话，同群的双胞胎完全正常。查下来不是禁令的问题——
// 群聊把人设砍到 200 字（单聊全文），而且压根不走 buildBundle，
// 印象卡/心情/好感度一层都没有。他在群里只剩「一个古代王爷」这个标签。

test("规矩写在 .claude/rules 里，不是只活在某一次对话里", () => {
  assert.match(rule, /单人线上 \/ 单人线下 \/ 群聊线上 \/ 群聊线下，喂给模型的东西默认必须一样/);
  assert.match(rule, /截断对谁伤害大，取决于截断之后剩下的标签有多刻板/);
  // 合法差异要列清楚，否则这条规矩会被拿去做蠢事
  assert.match(rule, /言秋/);
  assert.match(rule, /封闭群/);
  assert.match(rule, /小剧场 \/ 同人文/);
  assert.match(rule, /人设不许再用固定字数截断/);
});

const B = (() => {
  const g = n => { const i = engine.indexOf(n); return engine.slice(i, engine.indexOf("\n}\n", i) + 2); };
  return new Function("const GROUP_PERSONA_BUDGET = 9000;" + g("function groupPersonaBudget(")
    + g("function groupPersonaText(") + "\nreturn { groupPersonaBudget, groupPersonaText };")();
})();

test("人设按在场人数分预算，小群直接给全文", () => {
  assert.equal(B.groupPersonaBudget(2), 4500);
  assert.equal(B.groupPersonaBudget(3), 3000);
  assert.ok(B.groupPersonaBudget(30) >= 400, "人再多也得有个地板");
  // 两三个人的群，两千字的人设一个字不砍
  const p = "甲".repeat(2000);
  assert.equal(B.groupPersonaText(p, B.groupPersonaBudget(3)), p);
  // 超了才截，而且要说明是被截的
  const long = "乙".repeat(5000);
  const cut = B.groupPersonaText(long, B.groupPersonaBudget(3));
  assert.ok(cut.length < long.length);
  assert.match(cut, /〔人设过长，按在场人数分到的额度截断〕$/);
  assert.equal(B.groupPersonaText("", 3000), "（暂无设定）");
});

test("四处旧的固定截断一个都不许留着", () => {
  ["(c.persona || \"\").slice(0, 200)", "(c.persona || \"\").slice(0, 220)"].forEach(x =>
    assert.ok(app.indexOf(x) < 0, "app.js 还留着 " + x));
  ["(c.persona || \"（暂无设定）\").slice(0, 260)", "(c.persona || \"（暂无设定）\").slice(0, 200)"].forEach(x =>
    assert.ok(engine.indexOf(x) < 0, "engine.js 还留着 " + x));
  // 四处都改走同一个函数
  assert.equal((app.match(/groupPersonaText\(c\.persona/g) || []).length, 2, "线上群 + 投票");
  assert.equal((engine.match(/groupPersonaText\(c\.persona/g) || []).length, 2, "群线下 + 群 OOC");
});

test("群聊线上补上心情/好感/印象卡", () => {
  assert.match(app, /const mdSeg = md\.label \? "\\n〔此刻心情〕" \+ md\.label/);
  assert.match(app, /const afSeg = "\\n〔对 " \+ \(profile\.name \|\| "用户"\) \+ " 的好感〕"/);
  // 心情要走平复逻辑，别把三天前那阵气当成此刻
  assert.match(app, /window\.MoodLabel\.settle\(\(moods\[c\.id\] \|\| \{\}\)\.label, \(moods\[c\.id\] \|\| \{\}\)\.ts, Date\.now\(\)\)/);
  // 印象卡属于「发生过什么」，只在开了记忆互通时给，而且要落在本人那一段
  assert.match(app, /const gz = window\.Gaze && !settingsFor\(c\.id\)\.engineerEyes \? window\.Gaze\.text\(c\.id, profile\.name \|\| "用户"\) : "";/);
  assert.match(app, /印象卡跟长期记忆同一档/);
});

test("群聊线下也补上，同样的分档", () => {
  assert.match(app, /memberMood: \(\(\) => \{/);
  assert.match(app, /memberAff: \(\(\) => \{/);
  assert.match(app, /memberGaze: \(\(\) => \{/);
  assert.match(app, /if \(!gsFor\(group\.id\)\.memoryInterop \|\| !window\.Gaze\) return m;/, "封闭群不给印象卡");
  assert.match(engine, /\(ctx\.memberMood && ctx\.memberMood\[c\.id\]\) \? "\\n〔此刻心情〕"/);
  assert.match(engine, /\(ctx\.memberAff && ctx\.memberAff\[c\.id\] != null\)/);
  assert.match(engine, /\(ctx\.memberGaze && ctx\.memberGaze\[c\.id\]\) \? "\\n〔以下只有 " \+ c\.name \+ " 本人知道，别的成员并不知情〕/);
});

test("封闭群仍然只封「发生过什么」，不封「这个人是谁」", () => {
  // 心情/好感不看 memoryInterop——它们是人物本身
  const i = app.indexOf("memberMood: (() => {");
  const j = app.indexOf("memberGaze: (() => {");
  assert.ok(app.slice(i, j).indexOf("memoryInterop") < 0, "心情/好感不该被封闭群挡掉");
  assert.match(app, /它们是【这个人此刻是谁】、\n    \/\/ 不是【你们之间发生过什么】，所以封闭群照给/);
  assert.match(rule, /「这个人是谁」类的（人设全文、长出来的自我、心情、好感度）照常给/);
});
