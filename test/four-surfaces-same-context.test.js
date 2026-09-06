const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
// 规则原文只从这一处拿（路径写在 test/_rules.js 那一行，搬家改一处就够）
const { ruleText } = require("./_rules.js");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const rule = ruleText("four-surfaces-same-context");

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
  return new Function("const GROUP_PERSONA_BUDGET = 30000, GROUP_PERSONA_EACH_MAX = 6000;" + g("function groupPersonaBudget(")
    + g("function groupPersonaText(") + "\nreturn { groupPersonaBudget, groupPersonaText };")();
})();

test("人设按在场人数分预算，小群直接给全文", () => {
  assert.equal(B.groupPersonaBudget(3), 6000);
  assert.ok(B.groupPersonaBudget(40) >= 1500, "人再多也得有个地板");
  // 两三个人的群，两千字的人设一个字不砍
  const p = "甲".repeat(2000);
  assert.equal(B.groupPersonaText(p, B.groupPersonaBudget(3)), p);
  // 超了才截，而且要说明是被截的
  const long = "乙".repeat(9000);
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
  // v56.03 起每处群人设都多一条 NPC 分支（配角走 NPC_PERSONA_CAP 小额度）

  // v60.27 起【通话】是第五处（她 2026-09-02：「语音视频没喂八股禁令进去」）——
  // 那之前这一层在通话里一处都没有，见 施工规则/four-surfaces-same-context.md。
  // v60.31：群通话也分出了配角那一支（配角不吃「此刻」那几层），所以是 5 处
  assert.equal((app.match(/groupPersonaText\(c\.persona/g) || []).length, 5,
    "线上群（真角色+配角） + 投票 + 群通话（真角色+配角）");
  assert.equal((engine.match(/groupPersonaText\(c\.persona/g) || []).length, 3, "群线下（真角色+配角） + 群 OOC");
});

test("群聊线上补上心情/好感/印象卡", () => {
  // ⚠️v60.31 起这几段抽成了共用的 groupNowSegs（群聊和群通话同一份），别再冻在 replyGroup 里那几行上
  const now = app.slice(app.indexOf("const groupNowSegs ="), app.indexOf("const memberPrivLines ="));
  assert.ok(now.length > 200, "找不到 groupNowSegs");
  assert.match(now, /mdSeg: md\.label \? "\\n〔此刻心情〕" \+ md\.label/);
  assert.match(now, /afSeg: "\\n〔对 " \+ userName\(profile\) \+ " 的好感〕"/);
  // 心情要走平复逻辑，别把三天前那阵气当成此刻
  assert.match(now, /window\.MoodLabel\.settle\(\(moods\[c\.id\] \|\| \{\}\)\.label, \(moods\[c\.id\] \|\| \{\}\)\.ts, Date\.now\(\)\)/);
  // 群聊那一处真的用了这一份（不是各写各的）
  assert.match(app, /const _now = groupNowSegs\(c, \{ interop: gs\.memoryInterop \}\);/);
  // 印象卡属于「发生过什么」，只在开了记忆互通时给，而且要落在本人那一段
  assert.match(app, /const gz = window\.Gaze && !settingsFor\(c\.id\)\.engineerEyes \? window\.Gaze\.text\(c\.id, userName\(profile\)\) : "";/);
  assert.match(app, /印象卡跟长期记忆同一档/);
});

test("群聊线下也补上，同样的分档", () => {
  assert.match(app, /memberMood: \(\(\) => \{/);
  assert.match(app, /memberAff: \(\(\) => \{/);
  assert.match(app, /memberGaze: \(\(\) => \{/);
  assert.match(app, /      if \(!window\.Gaze\) return m;/, "读一律给：封闭群也拿得到印象卡");
  assert.match(engine, /\(ctx\.memberMood && ctx\.memberMood\[c\.id\]\) \? "\\n〔此刻心情〕"/);
  assert.match(engine, /\(ctx\.memberAff && ctx\.memberAff\[c\.id\] != null\)/);
  assert.match(engine, /\(ctx\.memberGaze && ctx\.memberGaze\[c\.id\]\) \? "\\n〔以下只有 " \+ c\.name \+ " 本人知道，别的成员并不知情〕/);
});

test("封闭群的读侧一个都不许挡", () => {
  const i = app.indexOf("memberMood: (() => {");
  const j = app.indexOf("memberGaze: (() => {");
  assert.ok(app.slice(i, j).indexOf("memoryInterop") < 0, "心情/好感不该被封闭群挡掉");
  const k = app.indexOf("memberGaze: (() => {");
  assert.ok(app.slice(k, k + 400).indexOf("memoryInterop") < 0, "印象卡现在也读一律给");
});

// —— 「封闭群线上线下也要做个区分，长出来的自我、记忆库这些要只进不出，
//     封闭群不应该影响主要世界」（她 2026-08-24）——
// 以前 memoryInterop 一个开关同时管两个方向，关掉就是「不进也不出」，
// 于是封闭群里所有人都退化成一张标签。现在拆开：读一律给，写一律封死。

test("规矩里把「只进不出」写清楚了", () => {
  assert.match(rule, /封闭群.*＝只进不出/);
  assert.match(rule, /读一律给/);
  assert.match(rule, /写一律封死/);
  assert.match(rule, /闭群是平行沙盒，读主线、不写主线/);
  assert.match(rule, /先问一句「封闭群里发生这件事，该不该影响主线」。默认答案是不该/);
});

test("读：封闭群照样拿得到记忆库/印象卡", () => {
  // 线上群那一大块不再挂在 memoryInterop 上
  assert.ok(app.indexOf("      if (gs.memoryInterop) {\n        if (typeof primeQueryVec") < 0, "旧的读闸不许留着");
  assert.match(app, /【读】一律给（记忆库、长期记忆、印象卡、长出来的自我）/);
  // 群线下的两处读闸也开了
  assert.match(app, /const groupOfflineMemSplit = group => \{\n(?:.*\n)*?    if \(!group\) return null;/);
  assert.match(app, /      if \(!window\.Gaze\) return m;/);
});

test("写：封闭群一个字都不回流主线", () => {
  // 记忆库
  assert.match(app, /if \(gsFor\(groupId\)\.memoryInterop\) \{ \/\/ 只有互通群进全局记忆库/);
  assert.match(app, /if \(!gsFor\(groupId\)\.memoryInterop\) return; \/\/ 记忆分区/);
  // 群线下的好感/心情/状态卡——以前一道闸都没有
  assert.match(app, /const gOffSealed = groupClosed\(group\.id\);/);
  // v56.03 起同一行还多挡了 NPC（配角没有心情/好感），闭群那道闸原样还在
  assert.match(app, /if \(!gOffSealed && !_bNpc && b\.senderId && typeof b\.affinityDelta === "number"\) bumpAff/);
  assert.match(app, /if \(!gOffSealed && !_bNpc && b\.senderId && b\.mood && b\.mood\.label\) setMoodFor/);
  assert.match(app, /if \(!gOffSealed && b\.senderId && \(gOffThought \|\| \(b\.mood && b\.mood\.label\)\)\)/);
  // 动态计数器：线上线下都要堵
  assert.match(app, /if \(!groupClosed\(groupId\)\) _gspoke\.forEach/, "群聊线上");
  assert.match(app, /if \(!groupClosed\(group\.id\)\) _spoke\.forEach/, "群线下");
  // 钱包
  assert.match(app, /if \(!groupClosed\(groupId\)\) adjustCharBalance/);
});

test("实时私聊窗口仍归互通群，别和 preJoin 叠加", () => {
  // ⚠️v60.31 起取法抽成 memberPrivLines（群聊和群通话共用），门槛仍在调用处
  assert.match(app, /const priv = gs\.memoryInterop \? memberPrivLines\(c, gs\.privateCtxN\) : ""/);
  assert.match(app, /const memberPrivLines = \(c, n\) => \(Number\(n\) > 0/, "条数为 0 就不该给");
  assert.match(app, /const offBeats = gs\.memoryInterop && gs\.privateCtxN > 0/);
  // 带时间戳的那一份：她那句「在家等他」正是靠它才接得上
  assert.match(app, /memberPrivLines = \(c, n\) =>[\s\S]{0,400}fmtStampAI\(m\.ts\)/);
  assert.match(app, /if \(gs\.preJoinN > 0 && !gs\.memoryInterop\)/, "闭群走 preJoin");
  assert.match(app, /否则同一段私聊会进两遍/);
});

test("人设额度放宽到她的实际长度：每人 4500+ 不该被砍", () => {
  assert.equal(B.groupPersonaBudget(3), 6000);
  assert.equal(B.groupPersonaBudget(5), 6000);
  assert.equal(B.groupPersonaBudget(10), 3000);
  assert.ok(B.groupPersonaBudget(40) >= 1500, "地板");
  const p = "甲".repeat(4500);
  assert.equal(B.groupPersonaText(p, B.groupPersonaBudget(5)), p, "五人以内一个字不砍");
  assert.match(engine, /她的人设每个都 4500\+/);
});
