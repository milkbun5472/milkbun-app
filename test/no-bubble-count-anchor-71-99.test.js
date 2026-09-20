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

// ---- 3. ⚠️同一句话【写在三处】，删一处不算完（她 2026-09-20：「怎么还是这样 3 句，
//     单独开了个房间还是」——上一版只删了 JSON 协议里那个，真正每轮都发的
//     ONLINE_CHAT_RULE_V2 里还躺着一句一模一样的「想说三句就发三条」）----
const rule = eng.slice(eng.indexOf("const ONLINE_CHAT_RULE_V2 = "), eng.indexOf("const OFFLINE_", eng.indexOf("const ONLINE_CHAT_RULE_V2 = ")));
assert.ok(rule.length > 200, "抠不出 ONLINE_CHAT_RULE_V2");
assert.match(rule, /一条消息＝一句话/, "「一条＝一句」这个格式说明丢了");
assert.match(rule, /说了几句就发几条/, "没说清楚句子和气泡的对应关系");
assert.ok(!/想说三句就发三条/.test(rule), "每轮真发的那一份里还留着「想说三句就发三条」");
assert.ok(!/拆成两条发/.test(rule), "「拆成两条」也是个可抄的数字");

// 群私聊那一格同理（它也是一条一个气泡）
const dm = app.slice(app.indexOf("⚠️它是【一个数组，一条一个气泡】"), app.indexOf("它和 text 是两回事"));
assert.ok(dm.length > 50, "抠不出群私聊 dm 那一格");
assert.ok(!/1~3 条/.test(dm), "群私聊那一格还留着「通常 1~3 条」");

// 全库扫一遍：提示词正文里不许再有这一族数字（注释不算，注释是病历）
const promptLines = (eng + "\n" + app).split("\n").filter(l => !l.trim().startsWith("//"));
const bad = promptLines.filter(l => /想说三句|三个元素|连发三条|拆成两条发/.test(l));
assert.strictEqual(bad.length, 0, "提示词正文里又长出了可抄的条数：\n" + bad.join("\n").slice(0, 400));

console.log("✓ 气泡条数：三处写法都不再留可抄的数字，格式说明照旧");
