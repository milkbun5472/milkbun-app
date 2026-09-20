// 不挂聊天例句世界书的话，大家默认都是三个气泡（她 2026-09-20 报）。
//
// 病根：word 那一格的【格式说明】里写着「想说三句就给三个元素」。本意是讲格式
// （一个元素＝一条气泡），可整段里唯一一个数字就是那个「三」——模型顺着抓最具体的
// 那一个，于是它变成了默认长度。
// 真正管条数的那句（ONLINE_CHAT_RULE_V2）写的是「一轮说几条没有固定格式」——
// 抽象的说法打不过一个具体的数字。挂了聊天例句就变多，正是因为例句比那个数字更具体。
//
// 这就是 施工规则/prompt-no-content-samples.md 那条：留格式示范，删内容示范。
// 判据——这个例子被逐字照抄，是对的还是错的？「三句三个元素」被照抄成默认长度就是错的。
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { ruleText } = require("./_rules.js");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const eng = fs.readFileSync(path.join(root, "js", "engine.js"), "utf8");

// 规则原文还在（搬了家这条就得跟着改，路径只写在 _rules.js 一处）
assert.match(ruleText("prompt-no-content-samples"), /删掉【内容示范】，保留【格式示范】/);

// ---- 1. 单聊 word 那一格：格式照旧说清楚，但不留可抄的数字 ----
const i = app.indexOf("word: string[]，角色实际发送的消息。");
assert.ok(i > 0, "app.js 里抠不出 word 那一格的说明");
const wordSpec = app.slice(i, i + 400);
assert.match(wordSpec, /【一个元素＝一句话】/, "「一个元素＝一条气泡」这个格式说明丢了——那是这一格真正要讲的事");
assert.match(wordSpec, /说了几句就给几个元素/, "没说清楚元素和句子的对应关系");
assert.ok(!/三句|三个元素/.test(wordSpec), "又把「三」写回 word 那一格了——它会变成默认气泡数");
assert.match(wordSpec, /别把几句话用逗号缝进同一个元素/, "「别缝在一起」这条还得留着");

// ---- 2. 群聊那一份同病同治（four-surfaces：一层写在两处，第二处要跟上）----
const g = eng.indexOf("const GROUP_MULTI_BUBBLE = ");
assert.ok(g > 0, "engine.js 里抠不出 GROUP_MULTI_BUBBLE");
const groupSpec = eng.slice(g, eng.indexOf("const ONLINE_CHAT_RULE_V2", g));
assert.ok(!/连发三条/.test(groupSpec), "群聊那句还留着「一个人连发三条」");
assert.match(groupSpec, /一个人连着发好几条/, "「一个人可以连发」这件事不能跟着数字一起删掉");

// ---- 3. 真正管长度的那句还在，而且仍然是【由这个人决定】----
assert.match(eng, /一轮说几条、总共说多长，没有固定格式/, "管条数的那句没了");
assert.match(eng, /话多的人连发几条、絮絮叨叨、主动分享和追问/, "「话多是常态不是毛病」这半句没了");

console.log("✓ 气泡条数：格式照旧说清楚，提示词里不再留一个可抄的数字");
