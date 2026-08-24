const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-08-22：「我说看看自拍，有时候会回答：自拍？行，别后悔。明明直接说后部分就行」。
// 回声式开场——把对方刚说的词原样反问一遍再回答。它不添任何东西，只是给真正的回答垫场。

// v55.66 起禁令抽成了共用常量 ECHO_QUESTION_BAN（线上线下同一份），
// 所以这里要【求值】而不是读原文，否则看到的是没插值的 ${...} 占位。
const ONLINE = (() => {
  const g = n => { const i = engine.indexOf("const " + n + " = `"); return engine.slice(i, engine.indexOf("`;", i) + 2); };
  return new Function(g("ECHO_QUESTION_BAN") + "\n" + g("ONLINE_CHAT_RULE_V2") + "\nreturn ONLINE_CHAT_RULE_V2;")();
})();

test("点名这个毛病，并说清它为什么是复述不是反应", () => {
  assert.match(ONLINE, /别把对方刚说的词原样反问一遍再开口/);
  assert.match(ONLINE, /这种回声式开场不是反应，是复述/);
  assert.match(ONLINE, /把对方的话原样退回去一次，什么都没添/);
  // 用她给的原例，模型照着这个形状认最准
  assert.match(ONLINE, /「行，别后悔」本身就是一句完整的回答，前面不需要挂一个「自拍？」/);
});

test("给可判定的检验，而不是再加一句「别反问」", () => {
  assert.match(ONLINE, /【判定】把开头那个反问删掉——句子照样成立、意思一点没少，那它就是回声，删掉/);
});

test("真反问不许被误杀：区别在有没有带进新东西", () => {
  assert.match(ONLINE, /真的没听清、真的意外到要确认一遍、或者你就是在质疑这件事本身，那是真反问，照常用/);
  assert.match(ONLINE, /区别在于它有没有带进新的东西/);
});

test("单聊和群聊都吃得到（共用同一个常量）", () => {
  const m = app.match(/ONLINE_CHAT_RULE_V2\.replace\("([^"]+)", "([^"]+)"\)/);
  assert.ok(m, "群聊那处的改写形状变了，得重新确认这条还在不在");
  assert.match(ONLINE.replace(m[1], m[2]), /别把对方刚说的词原样反问一遍再开口/, "群聊也要带上");
  assert.match(app, /ONLINE_CHAT_RULE_V2 \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE/, "单聊");
});

test("只加在线上：线下是叙事散文，对白里的反问由场景决定", () => {
  assert.ok(!/回声式开场/.test(
    engine.match(/const OFFLINE_NARRATIVE_RUNTIME = `([\s\S]*?)`;/)?.[1] || ""),
    "别顺手塞进线下");
});

// —— 「你这反问还是压不住线上啊啊啊」（她 2026-08-24）——
// 刀一直在跑，是判据太窄：原来要求那个词【逐字】出现在她上一条里。
// 于是「自拍啊？」「自拍吗？」（多了语气助词）、「你的自拍？」（多了两个字）、
// 「你要我陪你去？」（字序不同）全漏；第一泡是「嗯」或表情、第二泡才回声的也漏。

const S = (() => {
  const g = n => { const i = engine.indexOf(n); return engine.slice(i, engine.indexOf("\n}\n", i) + 2); };
  const consts = engine.slice(engine.indexOf("const ECHO_TAIL ="), engine.indexOf("function echoCore("));
  return new Function(consts + g("function echoCore(") + g("function isEchoOfSaid(") + g("function echoOpening(")
    + g("function stripEchoQuestion(") + "\nreturn stripEchoQuestion;")();
})();

test("语气助词不该让它逃掉", () => {
  assert.deepEqual(S(["自拍啊？", "行"], "看看自拍"), ["行"]);
  assert.deepEqual(S(["自拍吗？行，别后悔"], "看看自拍"), ["行，别后悔"]);
  assert.deepEqual(S(["哦，自拍？", "行"], "看看自拍"), ["行"]);
});

test("多几个字也还是回声", () => {
  assert.deepEqual(S(["你的自拍？", "行"], "看看你的自拍"), ["行"]);
  // 字序不同但字都是她的：八成以上命中也算
  assert.deepEqual(S(["你要我陪你去？", "行啊"], "你要不要陪我去"), ["行啊"]);
});

test("垫场不一定在第一泡——前两泡都要扫", () => {
  assert.deepEqual(S(["嗯", "自拍？", "行，别后悔"], "看看自拍"), ["嗯", "行，别后悔"]);
  // 但第三泡以后不碰：那时候他已经在正经说话了
  assert.deepEqual(S(["嗯", "好", "自拍？", "行"], "看看自拍"), ["嗯", "好", "自拍？", "行"]);
});

test("真反问一个都不许误杀", () => {
  assert.deepEqual(S(["疼吗？", "我看看"], "我摔了一下"), ["疼吗？", "我看看"]);
  // 「真的」这类字面上对得上、其实是在惊讶的，进停用表
  assert.deepEqual(S(["真的？", "太好了"], "我今天真的很累"), ["真的？", "太好了"]);
  assert.deepEqual(S(["什么？", "再说一遍"], "我说什么了"), ["什么？", "再说一遍"]);
  // 连问＝情绪
  assert.deepEqual(S(["自拍？现在？", "行"], "看看自拍"), ["自拍？现在？", "行"]);
  // 削了就没话了
  assert.deepEqual(S(["自拍？"], "看看自拍"), ["自拍？"]);
  // 本来就没有回声
  assert.deepEqual(S(["行，别后悔"], "看看自拍"), ["行，别后悔"]);
  // 太短/太长都不算
  assert.deepEqual(S(["你？", "行"], "你看看"), ["你？", "行"]);
});

test("线上线下群聊共用同一套判据，别再各写一份", () => {
  assert.equal((engine.match(/function isEchoOfSaid\(/g) || []).length, 1);
  assert.equal((engine.match(/function echoOpening\(/g) || []).length, 1);
  assert.match(engine, /isEchoOfSaid\(m\[1\], said\)/, "单条判定");
  assert.match(engine, /isEchoOfSaid\(em\[1\], said\)/, "线下正文版");
  assert.match(engine, /她 2026-08-24：\n\/\/ 「你这反问还是压不住线上啊啊啊」|你这反问还是压不住线上/, "病因写在代码里");
});

// —— 「我不删的话第二轮绝对又会用反问开头」（她 2026-08-24）——
// 刀发生在【展示前】，可 v55.11 之前漏出去的、判据没盖住的那些，已经躺在记录里了；
// 每一轮它们都作为「他自己的说话习惯」被重新喂回去。她只能手动删。
// 加一条「这一条不跟聊天记录走」，跟标点那条同款。
// （曾经还做过「把旧回声从送进模型的历史里削掉」，她 2026-08-24 说不用，撤了：
//   她宁可自己手动删，也不想让模型看到的内容跟她看到的不一样。）

test("提示词里要说清：记录里有旧回声不代表那是他的习惯", () => {
  assert.match(ONLINE, /【这一条不跟聊天记录走】上面的记录里要是有你自己「某某？」开场的旧消息/);
  assert.match(ONLINE, /不是你的口头禅、不是你的语气标记、也不是这段关系里的默契/);
  assert.match(ONLINE, /记录里出现过几次，就说明它错了几次，不说明它对/);
  // 线下叙事准则那份也吃得到（共用 ECHO_QUESTION_BAN）
  const i = engine.indexOf("const OFFLINE_NARRATIVE_RUNTIME = `");
  const g = n => { const j = engine.indexOf("const " + n + " = `"); return engine.slice(j, engine.indexOf("`;", j) + 2); };
  const off = new Function(g("ECHO_QUESTION_BAN") + "\n" + engine.slice(i, engine.indexOf("`;", i) + 2) + "\nreturn OFFLINE_NARRATIVE_RUNTIME;")();
  assert.match(off, /不说明它对/);
});

// —— 她 2026-08-24 的截图：一轮连发三条，他回声了中间那条 ——
//   她：「腊月不还早吗」「说不定到时候你身边已经妻妾成群」「早就忘了我了」
//   他：「妻妾成群？」+「一个天天想着休大房…我都应付不过来」
// 刀只拿【最后一条】去比，里面没有「妻妾成群」，判定永远不成立。
// 她一连发消息，这把刀就整个废了——判据再宽也没用，比错了对象。

const TURN = (() => {
  const g = n => { const i = engine.indexOf(n); return engine.slice(i, engine.indexOf("\n}\n", i) + 2); };
  const consts = engine.slice(engine.indexOf("const ECHO_TAIL ="), engine.indexOf("function echoCore("));
  return new Function(consts + g("function echoCore(") + g("function isEchoOfSaid(") + g("function echoOpening(")
    + g("function lastUserTurnText(") + g("function stripEchoQuestion(")
    + "\nreturn { stripEchoQuestion, lastUserTurnText };")();
})();

test("要比的是她这一整轮说的话，不是最后那一条", () => {
  const hist = [
    { role: "assistant", content: "服了你了" },
    { role: "user", content: "腊月不还早吗" },
    { role: "user", content: "说不定到时候你身边已经妻妾成群" },
    { role: "user", content: "早就忘了我了" }
  ];
  const said = TURN.lastUserTurnText(hist);
  assert.match(said, /妻妾成群/);
  assert.match(said, /腊月不还早吗/, "整轮三条都要在");
  const words = ["妻妾成群？", "一个天天想着休大房、还算计我爹娘房事的某人我都应付不过来"];
  assert.deepEqual(TURN.stripEchoQuestion(words, said),
    ["一个天天想着休大房、还算计我爹娘房事的某人我都应付不过来"]);
  // 旧做法（只拿最后一条）确实拦不住——这就是她截图里看到的
  assert.deepEqual(TURN.stripEchoQuestion(words, "早就忘了我了"), words);
});

test("上一轮的话不算数：碰到他说话就停", () => {
  const hist = [
    { role: "user", content: "看看自拍" },
    { role: "assistant", content: "行" },
    { role: "user", content: "今天累死了" }
  ];
  assert.equal(TURN.lastUserTurnText(hist), "今天累死了");
  // 所以他这轮回「自拍？」是真的莫名其妙，不该被当成回声削掉
  assert.deepEqual(TURN.stripEchoQuestion(["自拍？", "嗯"], TURN.lastUserTurnText(hist)), ["自拍？", "嗯"]);
});

test("三处都改成看整轮", () => {
  assert.match(app, /words = stripEchoQuestion\(words, lastUserTurnText\(history\)\);/, "线上");
  assert.match(engine, /const lastSaid = lastUserTurnText\(session\.msgs\);/, "单人线下");
  assert.match(engine, /const gLastSaid = lastUserTurnText\(session\.msgs\);/, "群线下");
  assert.ok(!/stripEchoQuestion\(words, _lastSaid/.test(app), "旧的只取最后一条的写法不许留着");
  assert.match(engine, /她一连发消息，这把刀就整个废了/, "病因写在代码里");
});

// —— 「宝宝群聊也会反问」（她 2026-08-24 截图）——
//   顾朝：「阿暮你别挑衅人家，万一王爷真带了飞爪绳梯什么的呢」
//   裴照川：「飞爪绳梯？」＋「对付个二十层的高楼还不至于用那些劳什子物件」
// 两件事：① 群聊这条路从来没接过刀；② 回声的来源是【别的成员】，
// 而判据一直只跟「她说的话」比——所以判据再宽也够不着。

const EO = (() => {
  const g = n => { const i = engine.indexOf(n); return engine.slice(i, engine.indexOf("\n}\n", i) + 2); };
  const consts = engine.slice(engine.indexOf("const ECHO_TAIL ="), engine.indexOf("function echoCore("));
  return new Function(consts + g("function echoCore(") + g("function isEchoOfSaid(")
    + g("function echoOpening(") + "\nreturn echoOpening;")();
})();

const GSAID = "顾朝：阿暮你别挑衅人家，万一王爷真带了飞爪绳梯什么的呢 顾朝：不过要是进来了，我们家沙发可没地方给你睡";

test("群里回声别人的话一样要削", () => {
  assert.equal(EO("飞爪绳梯？", GSAID), null, "整条就是回声");
  assert.equal(EO("飞爪绳梯？对付个二十层的高楼", GSAID), "对付个二十层的高楼", "合并型只削开头");
});

test("群里的真反问和正常话一个都不许动", () => {
  assert.equal(EO("对付个二十层的高楼还不至于", GSAID), undefined);
  assert.equal(EO("你几楼？", GSAID), undefined, "她/别人都没说过「你几楼」");
  assert.equal(EO("飞爪？绳梯？", GSAID), undefined, "连问＝情绪");
  assert.equal(EO("飞爪绳梯？", ""), undefined, "没有可比的话就别乱削");
});

test("群聊接线：比对文本要随本批成员依次开口累加", () => {
  assert.match(app, /let _gSaidRun = typeof lastUserTurnText === "function" \? lastUserTurnText\(groupChatsRef\.current\[groupId\] \|\| \[\]\) : "";/,
    "先装她这一整轮");
  assert.match(app, /const r = echoOpening\(item\.text, _gSaidRun\);/);
  assert.match(app, /if \(item\.text\) _gSaidRun \+= " " \+ item\.text;/, "后面的人要能看见他刚说的");
  assert.match(app, /群里回声的来源可能是【别的成员】/, "病因写在代码里");
});

test("整条是回声时，只有他后面还有别的话才敢丢", () => {
  assert.match(app, /const hasMore = safeArr\.slice\(i \+ 1\)\.some\(x => x && x\.name === item\.name && String\(x\.text \|\| ""\)\.trim\(\)\);/);
  assert.match(app, /if \(hasMore\) continue;/);
  assert.match(app, /否则他这一轮就等于没开口/);
  // 言秋那条专线不参与
  assert.match(app, /typeof echoOpening === "function" && !settingsFor\(spk\.id\)\.engineerEyes/);
});
