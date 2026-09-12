// 她 2026-09-12 两件事：
//   ①「从房间到同人文有点慢，能不能搞个快捷键可以写了新章直接跳转过去」
//   ②「现在是每一章之间的话都会做参考吗宝宝，因为好像我一说叫他写他就出卡了太快了点」
//
// ② 的答案：会参考，但原来取的是「最近 14 条」，**不管中间已经写过几章**——
// 写第五章时他手上那份「我们说好的」里还混着第四章那会儿商量的事。
// 「每一章之间的话」就是字面意思：窗口该从上一张「他写好了」那儿起算。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), fic = R("js/fanfic.js"), comp = R("js/components.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app), F = strip(fic), C = strip(comp);

// roomTalkOf 抠出来真跑：它只用 chatsRef / ChatRooms / isOocMsg / roomFicPick
const talkOf = (() => {
  const i = app.indexOf("  const roomTalkOf = (chatKey, charName, uName, n, ficId) => {");
  assert.ok(i > 0, "抠不出 roomTalkOf");
  const src = app.slice(i, app.indexOf("\n  };", i) + 5);
  const box = { window: { ChatRooms: require("../js/chat-rooms.js") }, isOocMsg: m => m && m.kind === "ooc",
    roomFicPick: () => null, chatsRef: { current: {} } };
  vm.createContext(box);
  vm.runInContext("const window = this.window;" + src + "\nthis.f = roomTalkOf;", box);
  return (msgs, ficId, n) => { box.chatsRef.current.k = msgs; return box.f("k", "他", "她", n || 14, ficId); };
})();

const ROOM = [
  { ts: 1, ficId: "a", ficTitle: "长篇如果", kind: "ficshare" },
  { ts: 2, role: "user", content: "第一章让他去找她" },
  { ts: 3, role: "assistant", content: "行，我让他在门口站一会儿" },
  { ts: 4, kind: "ficdone", ficId: "a", subject: "《长篇如果》第 1 章", chapIdx: 0 },
  { ts: 5, role: "user", content: "第二章写她回信" },
  { ts: 6, role: "assistant", content: "那封信我想写得短一点" }
];

// ⭐她问的就是这一段
test("商量的话只取上一章写完之后的那几句", () => {
  const t = talkOf(ROOM, "a");
  assert.match(t, /第二章写她回信/, "这一章商量的话得在");
  assert.match(t, /那封信我想写得短一点/);
  assert.ok(t.indexOf("第一章让他去找她") < 0, "上一章那会儿商量的事又混进来了：" + t);
});

test("还没写过章的时候不设起点——那会儿的话就是给第一章用的", () => {
  const before = ROOM.slice(0, 3);
  const t = talkOf(before, "a");
  assert.match(t, /第一章让他去找她/);
  assert.match(t, /我让他在门口站一会儿/);
});

test("写过好几章就从最后那一张起算", () => {
  const more = ROOM.concat([
    { ts: 7, kind: "ficdone", ficId: "a", chapIdx: 1 },
    { ts: 8, role: "user", content: "第三章该收线了" }
  ]);
  const t = talkOf(more, "a");
  assert.match(t, /第三章该收线了/);
  assert.ok(t.indexOf("第二章写她回信") < 0, "该从最后一张卡起算，不是第一张");
});

test("别的书写完的那一章，不该把这本书【之前】商量过的话切掉", () => {
  const mixed = [
    { ts: 1, ficId: "a", kind: "ficshare" },
    { ts: 2, role: "user", content: "这一章让他去找她" },
    { ts: 3, kind: "ficdone", ficId: "b" },          // 另一本写完了
    { ts: 4, role: "user", content: "还有他得带伞" }
  ];
  const t = talkOf(mixed, "a");
  assert.match(t, /这一章让他去找她/, "别本书写完了，就把这本商量过的话切掉了");
  // ⚠️但 ts4 那句归 b 不归 a——这是对的，不是漏：
  //   b 的章刚落进这间房，房里「现在在聊的」就是 b，她接着说的话自然是说 b 的。
  //   切它的是 ficTrack（按书分账），不是这一章的窗口。两道闸各管各的。
  assert.ok(t.indexOf("还有他得带伞") < 0, "b 的章刚落下，后面那句该归 b：" + t);
  assert.match(talkOf(mixed, "b"), /还有他得带伞/, "那句得在 b 名下找得到");
});

test("卡片本身、OOC 都不算商量的话", () => {
  const t = talkOf(ROOM.concat([{ ts: 7, role: "user", kind: "ooc", content: "（测试一下）" }]), "a");
  assert.ok(t.indexOf("测试一下") < 0);
  assert.ok(t.indexOf("长篇如果") < 0, "卡片不该被当成对话喂回去");
});

test("没指定哪一本时照旧（别的调用点不受影响）", () => {
  const t = talkOf(ROOM);
  assert.match(t, /第一章让他去找她/, "不传书就不该切窗口");
  assert.match(t, /第二章写她回信/);
  // ⚠️连老卡（ficId 那一格还没有的年代留下的）也不许拿来当起点：
  //   不传书＝不知道在说哪一本，那就没有「上一章」这回事，一刀都不该切。
  const oldCard = [
    { ts: 1, role: "user", content: "这一段先这么走" },
    { ts: 2, kind: "ficdone" },                      // 老卡，没记是哪一篇
    { ts: 3, role: "user", content: "后面再说" }
  ];
  const t2 = talkOf(oldCard);
  assert.match(t2, /这一段先这么走/, "不传书却拿老卡当起点，前面商量的全被切掉了");
  assert.match(t2, /后面再说/);
});

// ── ① 快捷键：房间里那张卡点一下就翻到这一章 ──────────────────────
test("卡上要带着第几章，不然跳过去也不知道翻哪儿", () => {
  assert.match(A, /chapIdx: no - 1,/, "「他写好了」那张卡没记章号");
});

test("那一行死字变成了真按钮", () => {
  const i = C.indexOf('done ? (m.ficId && onOpenFicChapter');
  assert.ok(i > 0, "还是那行死字");
  const blk = C.slice(i, i + 700);
  assert.match(blk, /onOpenFicChapter\(m\)/, "点了不跳");
  assert.match(blk, /去看这一章/);
  assert.match(blk, /minHeight: 30/, "指头点得到");
  // 老卡（没记是哪一篇）照旧只是一行字，不许点出个空跳转
  assert.match(blk, /: h\("div"[\s\S]{0,200}?"全文在同人文里"\)/, "老卡该退回那行字");
  assert.match(C, /onOpenFicInvite,\n\s*onOpenFicChapter,/, "prop 没接上");
});

test("app 那头把它接到同人文屏上", () => {
  assert.match(A, /onOpenFicChapter: m => \{/, "没有这个处理函数");
  assert.match(A, /setFicJump\(\{ ficId: String\(m\.ficId\), chap: Number\(m\.chapIdx\) >= 0 \? Number\(m\.chapIdx\) : -1, key: Date\.now\(\) \}\);/);
  assert.match(A, /setScreen\("fanfic"\);\n\s*\},\n\s*onOpenGameInvite/, "跳了却没切屏");
  assert.match(A, /openFic: ficJump,/, "没传进同人文那一屏");
  assert.match(A, /onOpenFicUsed: \(\) => setFicJump\(null\),/, "用完不还回去，她翻别的篇会被拽回来");
});

test("同人文那一屏收下之后，真的翻到那一章", () => {
  assert.match(F, /const j = props\.openFic;/, "FanficApp 没收这个入口");
  assert.match(F, /setOpenId\(f\.id\); setJumpChap\(/, "打开了却不翻章");
  assert.match(F, /props\.onOpenFicUsed && props\.onOpenFicUsed\(\);/, "用完要还回去");
  assert.match(F, /startChap: jumpChap, onStartChapUsed: function \(\) \{ setJumpChap\(null\); \}/, "没传给阅读页");
  // 阅读页那一下：夹在章数范围里，用完也要还
  const i = F.indexOf("const c = Number(props.startChap);");
  assert.ok(i > 0, "阅读页没接这一下");
  const blk = F.slice(i, i + 420);
  assert.match(blk, /Math\.max\(0, Math\.min\(n - 1, c\)\)/, "章号超出范围会翻到空页");
  assert.match(blk, /props\.onStartChapUsed && props\.onStartChapUsed\(\)/, "不还回去，她往后翻一章就被拽回来");
});

test("那一篇被删了就说一声，别默默什么都不做", () => {
  assert.match(F, /else if \(props\.toast\) props\.toast\("那一篇找不到了"\);/);
});
