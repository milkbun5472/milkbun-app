const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => path.join(__dirname, "..", "js", f);
const engine = fs.readFileSync(R("engine.js"), "utf8");
const app = fs.readFileSync(R("app.js"), "utf8");
const comp = fs.readFileSync(R("components.js"), "utf8");

const grab = name => {
  const i = engine.indexOf("function " + name);
  assert.ok(i >= 0, name + " 没了");
  return engine.slice(i, engine.indexOf("\n}\n", i) + 3);
};
const { splitBilingual, bilingualKey, bilingualRule } =
  new Function(grab("splitBilingual") + grab("bilingualKey") + grab("bilingualRule") +
    "\nreturn { splitBilingual, bilingualKey, bilingualRule };")();

// 她 2026-08-26：「让模型生成时额外生成翻译」。免费接口把
// 「傘さすか迷うレベルで湿気すごい」翻成「您可能会迷失在雨伞中」，说这句话的人自己译不会。
test("「原文 | 中文」劈得开", () => {
  assert.deepEqual(splitBilingual("こっちは朝から小雨 | 这边从早上就在下小雨"),
    { text: "こっちは朝から小雨", zh: "这边从早上就在下小雨" });
  assert.deepEqual(splitBilingual("Hello | 你好"), { text: "Hello", zh: "你好" });
  assert.deepEqual(splitBilingual("Привет|你好"), { text: "Привет", zh: "你好" });
});

// 守卫宁可漏、不可错劈：一条正常消息被劈成两半是【看得见的】损坏。
test("带竖线的正常中文消息一根汗毛都不许动", () => {
  ["价格 3|5 元", "我5点|6点都行", "3|5", "今天天气不错"]
    .forEach(x => assert.equal(splitBilingual(x), null, x + " 不该被当成双语"));
});

test("形状不对的一律不认", () => {
  ["a|b|c", "|译文", "原文|", "same|same", "日本語 | japanese"]
    .forEach(x => assert.equal(splitBilingual(x), null, x + " 不该被当成双语"));
});

// 中译要挂在拆出来的最后一泡上，所以 key 得跟 stripTypingPeriod 削完的样子对得上
test("句尾那个句号被削掉之后，还找得回中译", () => {
  assert.equal(bilingualKey("寒いね。"), bilingualKey("寒いね"));
  assert.equal(bilingualKey("It's cold."), bilingualKey("It's cold"));
});

// mingruis-miya 把翻译规则发两遍：系统里一段硬性规则，每轮末尾再补一句短的
//（AGPL，只读了它的提示词编排、没取用代码）。一条规则只声明一次，模型隔几轮就忘——
// 这正是规则文件里 v55.95 那条教训的反面。
test("每轮再提醒一次，单聊和群聊都要有", () => {
  const grab2 = name => {
    const i = engine.indexOf("function " + name);
    assert.ok(i >= 0, name + " 没了");
    return engine.slice(i, engine.indexOf("\n}\n", i) + 3);
  };
  const turnHint = new Function(grab2("bilingualTurnHint") + "\nreturn bilingualTurnHint;")();
  assert.match(turnHint(""), /本轮·双语/);
  assert.match(turnHint("阿屿"), /「阿屿」/, "群里要点名");
  [turnHint(""), turnHint("阿屿")].forEach(x => {
    assert.match(x, /原文 \| 中文/, "格式要带上");
    assert.match(x, /一根竖线都别加/, "中文那些条的边界也要带上");
  });
  // 短句只负责提醒，别把整段规则又抄一遍——那会把每轮的上下文撑肥
  assert.ok(turnHint("").length < 90, "这一句要短，现在 " + turnHint("").length + " 字");
});

test("提醒真的挂进了每轮那一串，不是声明完没人用", () => {
  assert.match(appCode, /const _biTurnLine = _bilingualOn && typeof bilingualTurnHint === "function"/, "单聊没声明");
  assert.match(appCode, /crossSamenessHint\(charId\) \+ _biTurnLine \+/, "单聊声明了却没拼进每轮任务串——就是 v55.95 那个形状");
  assert.match(appCode, /userContent \+= "\\n\\n" \+ _biTurnNames\.map\(c => bilingualTurnHint\(c\.name\)\)\.join/, "群聊没拼进每轮");
});

test("没开双语的角色一个字都不多发", () => {
  assert.match(appCode, /_bilingualOn && typeof bilingualTurnHint/, "单聊要看开关");
  assert.match(appCode, /members\.filter\(c => !c\.npc && \(settingsFor\(c\.id\) \|\| \{\}\)\.bilingual\)/, "群聊要按成员筛");
});

test("提示词单聊说「这个角色」，群里点名说是谁", () => {
  assert.ok(/这个角色/.test(bilingualRule("")));
  assert.ok(/「裴照川」/.test(bilingualRule("裴照川")));
  [bilingualRule(""), bilingualRule("阿屿")].forEach(r => {
    assert.ok(/原文 \| 中文/.test(r), "得把格式写清楚");
    assert.ok(/说中文的那些条/.test(r), "得说清中文消息不加竖线");
  });
});

// ——接线：新加的一层不许只写在一处（.claude/rules/four-surfaces-same-context.md）
const noComment = src => src.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const appCode = noComment(app), compCode = noComment(comp);

test("拆双语必须排在拆气泡【之前】，不然长句会从竖线中间断开", () => {
  const i = appCode.indexOf("const _biZh = new Map();");
  assert.ok(i > 0, "单聊没接双语拆分");
  const seg = appCode.slice(i, i + 700);
  assert.ok(seg.indexOf("splitBilingual(w)") < seg.indexOf("splitLongBubble("), "顺序反了");
  assert.ok(/parts\[parts\.length - 1\]/.test(seg), "中译该挂在最后一泡上");
});

test("单聊和群聊两处都要接，一处都不许少", () => {
  assert.ok(/_biZh\.get\(bilingualKey\(words\[i\]\)\)/.test(appCode), "单聊气泡没带上 zh");
  assert.ok(/gBiZh\.get\(bilingualKey\(gBubbles\[j\]\)\)/.test(appCode), "群聊气泡没带上 zh");
  assert.ok(/const gBiHint =/.test(appCode) && /\+ gBiHint \+/.test(appCode),
    "群聊提示词声明了却没拼进 system——就是 v55.95 那个形状");
  assert.ok(/\$\{_biRuleLine\}/.test(appCode) && /const _biRuleLine =/.test(appCode),
    "单聊提示词没拼进协议");
});

test("开关按角色存得住", () => {
  assert.ok(/bilingual: !!s\.bilingual/.test(appCode), "没写进 x_chatSettings");
  assert.ok(/settings\.bilingual/.test(compCode) && /setBilingual/.test(compCode), "设置页没有这个开关");
  assert.ok(/dispRow\("外语消息自带中译"/.test(compCode), "设置页没有这一行");
});

// 她 2026-08-26：「我喜欢在旁边可以按翻译，不要放长按里面」——位置和交互一个字不许改
test("自带中译走的还是气泡旁边那个译键，不另起一套 UI", () => {
  assert.ok(/function TransText\(\{ text, isU, zhReady \}\)/.test(compCode), "TransText 没接自带中译");
  assert.ok(/zhReady \|\| \(cached && cached\.zh\)/.test(compCode), "有现成中译时该直接用");
  assert.ok(/zhReady \? \(_lang \|\| "外语"\)/.test(compCode), "探不出语种时也得给译键");
  const hits = compCode.match(/zhReady: m\.zh/g) || [];
  assert.equal(hits.length, 2, "单聊和群聊两个气泡都要把 m.zh 递进去，现在只有 " + hits.length + " 处");
});

test("自带中译不再去调免费接口", () => {
  const i = compCode.indexOf("function TransText(");
  const seg = compCode.slice(i, compCode.indexOf("\n}\n", i));
  assert.ok(/lang && !zhReady && typeof transCacheGet/.test(seg), "有自带中译时不该再查翻译缓存");
  assert.ok(/if \(zh \|\| busy\) return;/.test(seg), "run 得在已有译文时直接返回");
});

// 她 2026-08-27 截图：一轮六条日文，只有第一条带了中译，后面五条全掉回免费接口
//（而免费那版把「ちゃんと息抜きしな？」翻成「你真的喘不过气来」）。
// 规则单独摆一段，模型照着做一条就忘；格式得写在【字段本身】上才跑不掉。
test("双语格式写在 word / text 字段的说明里，不是只另起一段规则", () => {
  assert.match(appCode, /const _biWordSpec = _bilingualOn/, "单聊没有字段级说明");
  assert.match(appCode, /word: string\[\]，角色实际发送的消息。\$\{_biWordSpec\}/, "没插进 word 的字段定义");
  assert.match(appCode, /const gBiTextSpec =/, "群聊没有字段级说明");
  assert.match(appCode, /\\"text\\":\\"内容" \+ gBiTextSpec \+ "/, "没插进 text 的字段定义");
});

test("字段级说明和每轮提醒都得说「一条不落」", () => {
  const grab3 = name => {
    const i = engine.indexOf("function " + name);
    return engine.slice(i, engine.indexOf("\n}\n", i) + 3);
  };
  const turnHint = new Function(grab3("bilingualTurnHint") + "\nreturn bilingualTurnHint;")();
  assert.match(turnHint(""), /一条不落/);
  assert.match(turnHint(""), /别只给第一条/);
  assert.match(appCode, /一条不落——不是只给第一条/, "单聊字段说明里也要点破");
  assert.match(appCode, /每一条不是中文的都写成『原文 \| 中文』，一条不落/, "群聊字段说明里也要点破");
});

test("没开双语的角色，字段说明是空串——一个字都不多发", () => {
  assert.match(appCode, /const _biWordSpec = _bilingualOn\n\s*\? "（这个角色开着双语/);
  assert.match(appCode, /members\.some\(c => !c\.npc && \(settingsFor\(c\.id\) \|\| \{\}\)\.bilingual\)\)\n\s*\? "（开了双语的成员/);
});
