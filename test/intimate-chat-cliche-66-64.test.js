// 她 2026-09-11：「你看单聊也是这样的八股」——截图里两句：
//   「这可是你说的」「等下要是求饶，我可当听不见」。
//
// ⚠️先查「这件事已经有人管了吗」（她同一轮立的判据：一堆禁令会变笨，先别急着加）：
//   管了。INTIMATE_CHAT_ANTI_CLICHE 就是 v60.45 专为【线上气泡】写的那一份，
//   而且它【确实发到了】单聊线上（buildBundle 里 push 着，不是挂在 narrativeCore 那条线下路上）。
//   毛病在于那一族靠【三个例句】认人：她抓到这两句一个都没长成那个样子——
//   一句只有前半截（把责任记到对方头上），一句只有后半截（预告一场惩罚）。
//   所以补的是【判据】，不是又一条禁令，也不是再堆几个例句。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.resolve(__dirname, "..", "js/engine.js"), "utf8");

test("这一族靠判据认人，不是靠例句", () => {
  const seg = eng.slice(eng.indexOf("const INTIMATE_CHAT_ANTI_CLICHE = "), eng.indexOf("// 隐私围栏一直只挡"));
  assert.match(seg, /认这一族靠判据，不是靠上面那三个例句/);
  assert.match(seg, /这句话是不是在为等下要发生的事先立个据/, "判据那一句没写出来");
  assert.match(seg, /骨架拆开说、换个词说，照样是同一族/, "没说清拆开说也算");
  // 原来那三个例句一个都不许删——判据是补上去的，不是替换
  ["等你X了看我怎么收拾你", "回头有你好受的", "我看你怎么Y"].forEach(x =>
    assert.ok(seg.indexOf(x) > 0, "原来那个例句没了：" + x));
  assert.match(seg, /反问式表功／翻旧账/, "另一族被顺手删了");
});

test("那一份【确实】发到单聊线上——不是漏发（查过才动手）", () => {
  // ⚠️这条不许删：下次再报八股时，第一件事仍然是确认它到底有没有发出去
  const bb = eng.slice(eng.indexOf("      parts.push(ANTI_CLICHE);"), eng.indexOf("      parts.push(STOCK_REPLY_BAN);"));
  assert.match(bb, /parts\.push\(INTIMATE_CHAT_ANTI_CLICHE\);/, "线上那条路上没有它——那才是漏发，改法就完全不同了");
  assert.match(eng, /P\.push\(INTIMATE_CHAT_ANTI_CLICHE\);/, "线下那条路上的那一份也不许丢");
});

// 她 2026-09-11（同一轮）：「开了动描他就是会写什么抵在颈窝喘息，
// 但是因为不在线下所以没用线下那一堆压着咋办宝宝」。
//
// ⚠️v60.45 当初不把 INTIMATE_ANTI_CLICHE 搬到线上，写下的理由是
//   「线上根本没有描写，只有台词」——**动描做出来之后这句话就不成立了**：
//   居中那一行就是描写，而且正好是那几条（埋脸／颈窝／蹭／求饶）在管的东西。
//   规则会过期，结构变了要回头看那个理由（施工规则/bans-make-it-dumber.md 第三问）。
test("动描开着时，管描写的那一族也发到线上", () => {
  const eng2 = fs.readFileSync(path.resolve(__dirname, "..", "js/engine.js"), "utf8");
  const app2 = fs.readFileSync(path.resolve(__dirname, "..", "js/app.js"), "utf8");
  // ⚠️不抄第二遍：从已有那一份【滤】出来，以后往上面加一条，这一份自动跟着有
  assert.match(eng2, /const INTIMATE_ACT_CLICHE = INTIMATE_ANTI_CLICHE\.split\("\\n"\)\s*\n\s*\.filter\(l => l\.indexOf\("【绝不 OOC \/ 不跳戏】"\) < 0\)\.join\("\\n"\);/,
    "又照着抄了一份，或者改成了写死的字面量");
  // 滤掉的那条只对连续正文成立：一行动描没有「此处省略／画面淡出」可言
  assert.match(eng2, /一行动描没有「此处省略／画面淡出」可言，发过去是白发/);
  // 单聊和群聊两处都接上，而且都挂在【动描那个开关】上——没开就一个字不发
  assert.match(app2, /_actDesc \? "\\n\\n" \+ ownActNoBracketRule\(uName\) \+ "\\n\\n" \+ INTIMATE_ACT_CLICHE : ""/, "单聊没接");
  assert.match(app2, /_gActDesc \? "\\n\\n" \+ ownActNoBracketRule\(userName\(profile\)\) \+ "\\n\\n" \+ INTIMATE_ACT_CLICHE : ""/, "群聊没接");
  // 线下那一份一个字没动（顺序也没动）
  assert.match(eng2, /const INTIMATE_ANTI_CLICHE = INTIMATE_ANTI_CLICHE_LEGACY_V1;/);
  assert.match(eng2, /【绝不 OOC \/ 不跳戏】/, "线下那条被顺手删了");
});

// 她 2026-09-11：「叫他删掉重说这种话反而会让模型畏畏缩缩转向安全写法就会中规中矩」
test("禁令给出口，不给判决（施工规则/bans-make-it-dumber.md）", () => {
  const eng2 = fs.readFileSync(path.resolve(__dirname, "..", "js/engine.js"), "utf8");
  const seg = eng2.slice(eng2.indexOf("const INTIMATE_CHAT_ANTI_CLICHE = "), eng2.indexOf("// 隐私围栏一直只挡"));
  assert.ok(seg.indexOf("就整句删掉重说") < 0, "判决式的收尾会把整个话题变成雷区，模型退回最安全那版");
  assert.match(seg, /\*\*说你此刻真想说的那句\*\*：直接做那件事，或者说一句只有你会说的话。/, "只禁不给路，等于让他别写");
  // 「禁的是模子不是尺度」那句是这一族的刹车，不许丢
  assert.match(seg, /禁的是模子，不是尺度。/);
  // 规则本身也得在。⚠️路径只写在 test/_rules.js 一处（下次搬家改一处就够）
  const { ruleText } = require("./_rules.js");
  const rule = ruleText("bans-make-it-dumber");
  ["这件事已经有人管了吗", "有没有发到出问题的那一处", "它管的场合还成立吗", "给出口，不给判决"]
    .forEach(k => assert.ok(rule.indexOf(k) > 0, "规则里少了：" + k));
  assert.match(ruleText("README"), /bans-make-it-dumber\.md/, "没登记进 README，施工窗口不会读到它");
});
