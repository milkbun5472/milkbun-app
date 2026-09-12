// 她 2026-09-11 拦下来的那件事：
//   「这个记忆到底要不要进宝宝，比如有时候我也只是想测试一下但是不想让他们记得」
// v66.78 那版是【写完就自动往主线记忆库记一条】。她是对的：
//   「不记」事后能补，「记了」得手动去删——**默认值不该选不可逆的那一边**。
// 改口之后：她按一下才发生，而且默认落进【房间】不是主线；
// 而且这一步**一分钱不花**——喂给他只是把东西放进上下文，上下文是本地拼的，
// 只有「让他开口」才打枪（她原话：「按次计费的话那就是…第二次…第三次」）。
//
// 同一轮还修了左右位那一行：她「这个不仅仅是同性 cp，异性 cp 女左男右那也不是
// 男上位而是 4 爱女的上」——原来那句「异性 CP 顺序代表叙事重心先后即可」
// 等于把她的选择悄悄丢掉了。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const fic = R("js/fanfic.js"), app = R("js/app.js"), rooms = R("js/chat-rooms.js"), man = R("js/assistant-manual.js"), asst = R("js/assistant.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const grab = name => {
  const i = fic.indexOf("function " + name + "(");
  assert.ok(i > 0, "找不到 " + name);
  let d = 0, j = fic.indexOf("{", i);
  for (let k = j; k < fic.length; k++) { if (fic[k] === "{") d++; else if (fic[k] === "}") { d--; if (!d) { j = k + 1; break; } } }
  return fic.slice(i, j);
};
const box = {}; vm.createContext(box);
vm.runInContext("const FILE_CARD_HEAD = 200;\n" + grab("chapterCard") + grab("chapterNote")
  + "\nthis.F = { chapterCard, chapterNote };", box);
const F = box.F;
const FIC = { title: "码头那批货", author: "青梅", chapters: [
  { content: "第一章。" }, { content: "第二章正文写了很长很长的一段。".repeat(30), byAuthor: "顾朝", byCharId: "c1" },
  { content: "第三章。", byAuthor: "隔壁老陈" }] };

test("自动回流撤掉了——撤就是删，不是在后面挂一句说明", () => {
  assert.ok(fic.indexOf("onCharWrote") < 0 && app.indexOf("onCharWrote") < 0, "那条自动写又长回来了");
  const r = fic.slice(fic.indexOf("async function addChapter(by, want, hard)"), fic.indexOf("    // 去请她回来"));
  assert.ok(strip(r).indexOf("addMemEntry") < 0 && strip(r).indexOf("onNoteChapter") < 0, "生成那一路上还在自己往记忆里写");
  // 她按一下才发生
  assert.match(fic, /onClick: function \(\) \{ setFileIdx\(idx\); \}/);
  assert.match(fic, /ch\.byCharId \? "记进房间" : "拿给他看"/, "他自己写的和别人写的是两件事，文案要分开");
});

test("落进去的是一张卡，不是整章正文", () => {
  const card = F.chapterCard(FIC, 1, "顾朝", true, "小美");
  assert.match(card, /^\[同人文\] 你替小美接的《码头那批货》第 2 章。/);
  assert.match(card, /开头是：/);
  assert.ok(card.length < 420, "卡长到 " + card.length + " 字——一章几千字塞进房间聊天，上下文当场吃光");
  assert.match(card, /全文在同人文里/);
  // 别人写的那一章是「拿给他看」，说的是另一件事
  const show = F.chapterCard(FIC, 2, "顾朝", false, "小美");
  assert.match(show, /小美把《码头那批货》第 3 章拿给你看了——那一章是「隔壁老陈」写的。/);
  // 只记一笔那条更短，进的是她自己的记忆库
  assert.match(F.chapterNote(FIC, 1, "顾朝", true, "小美"), /第 2 章是「顾朝」替我接着写的/);
  assert.match(F.chapterNote(FIC, 2, "顾朝", false, "小美"), /我把《码头那批货》第 3 章拿给「顾朝」看了/);
});

test("不先把她赶去建房：没有就顺手开一间", () => {
  const seg = app.slice(app.indexOf("onFileChapter: (charId, card, pick, meta) =>"), app.indexOf("onNoteChapter:"));
  assert.match(seg, /if \(!room\) room = K\.create\(charId, "一起写", "focused"\);/, "先要求她去建房的话，她就不记了，又回到自动写那个问题上");
  // v67.11：她可以点名放进哪一间、也可以另开一间；两样都没点时老路一个字没变
  assert.match(seg, /let room = \(pick && pick\.id\) \? rooms\.filter\(r => r\.id === pick\.id\)\[0\] \|\| null : null;/);
  assert.match(seg, /if \(!room && pick && String\(pick\.name \|\| ""\)\.trim\(\)\) room = K\.create\(charId, String\(pick\.name\)\.trim\(\)\.slice\(0, 20\), "focused"\);/);
  assert.match(seg, /r\.actions && r\.actions\.fanfic/, "随便挑一间房塞进去＝塞进了一起学那间");
  assert.match(seg, /sort\(\(a, b\) => \(b\.updatedAt \|\| 0\) - \(a\.updatedAt \|\| 0\)\)/, "不按最近用过排，她每次都得想「上次放哪儿了」");
  // 房间里那条要真进得了上下文：kind:"system" 的卡是被过滤掉的
  // v67.13：这张也做成卡了（复用转发那张 ficshare），但 role 照旧是 user——
  // ⚠️他读的是 content，卡只是给她看的那一面；kind:"system" 那种是进不了上下文的
  assert.match(seg, /role: "user", kind: "ficshare", ts: Date\.now\(\)/);
  assert.ok(seg.indexOf('kind: "system"') < 0, "system 卡在好几处都被排除出上下文，他根本看不见");
});

test("这一步一分钱不花——喂不要钱，说话才要钱", () => {
  // ⚠️结束锚点要【从起点往后找】：app.js 里 `onBack: () => setScreen("home")` 有好几十处，
  //   从头找会切出一段空串，底下那几条断言就全变成摆设（axes 那条顺序断言刚踩过同一个坑）
  const from = app.indexOf("onFileChapter: (charId, card, pick, meta) =>");
  assert.ok(from > 0);
  const seg = app.slice(from, app.indexOf("    onBack: () => setScreen", from));
  assert.ok(seg.length > 200 && seg.length < 2600, "切出来 " + seg.length + " 字，锚点不对");
  assert.ok(seg.indexOf("callAI") < 0 && seg.indexOf("await") < 0, "归档那条路上打枪了");
  assert.match(app, /这一条一分钱不花/);
  assert.match(fic, /这一步不花钱——喂给他只是放进他的上下文，让他开口才要/, "界面上不说清楚，她会以为每按一次都在烧钱");
});

test("一起写是第三个开关，一间房想开几样开几样", () => {
  assert.match(rooms, /\["fanfic", "他可以拉你一起写"/);
  // ⚠️钉的是「focused 这一档把一起写开着」，不是「这一行一共列了几样」——
  //   v67.53 一起读进来之后又多一样，再多一样也不该红。
  assert.match(rooms, /actions: \{ \.\.\.bools\(GROUPS\.actions, false\)[^}]*\bfanfic: true\b/, "归档用的那一档（focused）没把一起写开上");
  assert.match(rooms, /懒得开那么多/);
});

test("左右位：异性 CP 那个分叉删掉了，性别跟「更壮」是同一类借口", () => {
  const seg = fic.slice(fic.indexOf("const posRule = function"), fic.indexOf("    // ── 群像"));
  assert.ok(seg.length > 300, "没切到左右位那一段");
  assert.ok(seg.indexOf("若两人是同性 CP") < 0 && seg.indexOf("顺序代表叙事重心先后") < 0,
    "那一行把她的选择悄悄丢掉了：她点女×男是要女方主导，模型收到的却是「顺序只是先后」");
  assert.match(seg, /或者因为谁是男的，就自行把位置调换/);
  assert.match(seg, /\*\*异性 CP 一样按这条走\*\*：女左男右就是女方主导，不是「男的照例在上」/);
  assert.match(seg, /凌驾于人设气场与性别之上/);
  // 加笔走的是同一个 cpBlock，所以改一处两边一起好
  assert.match(fic, /parts\.push\(cpBlock\(cpChars, ficOpts\(fic, \{ includeMe: true/);
  assert.equal((fic.match(/const posRule = function/g) || []).length, 1, "左右位又被抄了第二份");
});

test("穿书改叫加笔：界面、手册、提示词都改了，病历留着", () => {
  assert.match(man, /\{ id: "stepin", zh: "同人文 · 加笔", where: "同人文底栏的「加笔」"/,
    "手册原来指着一个界面上不存在的按钮——她问秋秋「加笔怎么玩」只能靠运气");
  assert.match(man, /kw: \["加笔", "穿书"/, "旧词也得认，不然照老叫法问就搜不到");
  assert.match(asst, /"加笔怎么玩"/);
  assert.ok(fic.indexOf("【穿书 · 互动叙事引擎】") < 0);
  assert.match(fic, /【加笔 · 互动叙事引擎】/);
  // 存档键和 mode key 一个都不许动（改了旧存档就读不出来）
  assert.match(fic, /const K_RP = "x_fanfic_rp";/);
  // 注释里的病历是事件当时的名字，原样留着，但要标一句对照
  assert.match(fic, /\*\*「穿书」＝这个功能的旧名\*\*/);
  assert.match(fic, /改掉病历会让它跟版本号对不上/);
  // 体裁标签里「穿书」是读者用的词，不是功能名，留着
  assert.match(fic, /IF线\|AU\|au\|穿越\|穿书\|重生/);
});
