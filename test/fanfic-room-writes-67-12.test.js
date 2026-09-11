// 她 2026-09-11：「就直接做房间里我们讨论了他直接写了然后推卡给我，就按我和他商量过的来，
//   但是如果我们有不同意见有分叉那还是按他想的来（比如说"不行我觉得这样比较合理"），
//   这样才好玩。然后我跟谁讨论让他写谁再写。」
//
// 形状照「一起学」那张卡抄：他开口 → 出一张卡 → **她点了才真花那一枪**。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const fic = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic.js"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "..", "js/app.js"), "utf8");
const comp = fs.readFileSync(path.resolve(__dirname, "..", "js/components.js"), "utf8");
const grab = (src, name) => {
  const i = src.indexOf("function " + name + "(");
  assert.ok(i > 0, "找不到 " + name);
  let d = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (!d) { j = k + 1; break; } } }
  return src.slice(i, j);
};

test("商量好的照办，但分歧按他的来——这一条是她要的那个「好玩」", () => {
  const box = {};
  vm.createContext(box);
  vm.runInContext(grab(fic, "roomTalkBlock") + "\nthis.f = roomTalkBlock;", box);
  const out = box.f("小美：我想让他这一章就走了\n沈屿白：走去哪儿", "小美", "沈屿白");
  assert.match(out, /【你们在房里商量过这一章】/);
  assert.match(out, /小美：我想让他这一章就走了/);
  // ⚠️是走向，不是素材：上次「她的原话被当台词搬进正文」那个坑就在隔壁
  assert.match(out, /这是【你们商量出来的走向】，不是素材：上面那些话\*\*一句都不许出现在正文里\*\*/);
  assert.match(out, /也不许把这段对话本身写成情节/);
  // ⚠️分歧按他的来，而且要当面说一句为什么
  assert.match(out, /\*\*但你要是不同意，就按你自己想的写\*\*/);
  assert.match(out, /你是写这一章的人，不是替她记录的人/);
  assert.match(out, /在 authorNote 里当面跟她说一句为什么/);
  assert.match(out, /「不行我觉得这样比较合理」那种口气，是沈屿白会说的话，不是道歉、不是请示/);
  assert.match(out, /照着写了就不用提这件事/, "不给出口的话，每一章都要解释一遍自己为什么听话");
  // 没商量过就一个字都不发
  assert.equal(box.f("", "小美", "沈屿白"), "");
  // 只有【他自己写】那一路才发：请圈里的太太写，跟你们商量的没关系
  assert.match(fic, /\(byChar \? roomTalkBlock\(opts\.roomTalk, userName, byChar\.remark \|\| byChar\.name\) : ""\) \+/);
});

test("他才能开口：房里开了「一起写」，而且这间房里放进过某一篇", () => {
  const seg = app.slice(app.indexOf("const roomFicOn ="), app.indexOf("// 小游戏跟一起学同一个形状"));
  assert.ok(seg.length > 300, "没切到那一段");
  assert.match(seg, /const roomFicOn = !!\(room && !room\.main && room\.actions && room\.actions\.fanfic && !_s\.engineerEyes\);/);
  assert.match(seg, /const roomFic = roomFicOn \? lastRoomFic\(chatKey\) : null;/);
  assert.match(seg, /if \(roomFic\) \{\n\s*openCaps\.push\("ficNext"\);/, "没放进 openCaps＝这一栏他压根收不到");
  // ⚠️他不许声称已经写好了——一起学那张卡定下的规矩，这儿照抄
  assert.match(seg, /⚠️不能声称已经写好了，最终由她点卡片你才真的动笔；不想写就省略这一栏。/);
  // 他手上要知道写到第几章了，不然开口说的是空话
  assert.match(seg, /现在写到第 "\n\s*\+ \(\(roomFic\.chapters \|\| \[\]\)\.length\) \+ " 章/);
});

test("这间房最近放进来的是哪一篇：只认这间房自己的卡", () => {
  const box = { chatsRef: { current: {} }, window: {} };
  box.window.Fanfic = { loadFics: () => [{ id: "f1", title: "甲" }, { id: "f2", title: "乙" }] };
  vm.createContext(box);
  vm.runInContext("const window = this.window;" + app.slice(app.indexOf("  const lastRoomFic = chatKey =>"), app.indexOf("  // 你们在这间房里刚聊过的那几句"))
    + "\nthis.f = lastRoomFic;", box);
  box.chatsRef.current["c1:r1"] = [{ ficId: "f1" }, { content: "聊天" }, { ficId: "f2" }];
  box.chatsRef.current["c1:r2"] = [{ ficId: "f1" }];
  assert.equal(box.f("c1:r1").title, "乙", "取的不是最近那一张");
  assert.equal(box.f("c1:r2").title, "甲");
  assert.equal(box.f("c1:r3"), null, "别的房放过什么，跟这间房不相干");
  // 文被删了就别硬认
  box.chatsRef.current["c1:r4"] = [{ ficId: "gone" }];
  assert.equal(box.f("c1:r4"), null);
});

test("商量的那几句：卡片和 OOC 不算，原文那几张更不算", () => {
  const box = { chatsRef: { current: {} }, isOocMsg: m => !!(m && m.kind === "ooc"), window: {} };
  box.window.ChatRooms = { visibleText: m => (m && (m.role === "user" || m.role === "assistant") && !m.recalled ? String(m.content || "") : "") };
  vm.createContext(box);
  vm.runInContext("const window = this.window;" + app.slice(app.indexOf("  const roomTalkOf = (chatKey"), app.indexOf("  const replyNow = async"))
    + "\nthis.f = roomTalkOf;", box);
  box.chatsRef.current["k"] = [
    { role: "user", content: "这一章我想看他走" },
    { role: "assistant", content: "走去哪儿" },
    { role: "user", content: "〔设定讨论〕", kind: "ooc" },
    { role: "user", content: "《长夜》第 1 章…", ficId: "f1" },      // 拿给他看那张卡
    { role: "assistant", content: "撤回的", recalled: true }
  ];
  const out = box.f("k", "沈屿白", "小美", 14);
  assert.match(out, /小美：这一章我想看他走/);
  assert.match(out, /沈屿白：走去哪儿/);
  ["设定讨论", "《长夜》第 1 章", "撤回的"].forEach(w => assert.ok(out.indexOf(w) < 0, "不该进去的进去了：" + w));
});

test("点了才花那一枪，而且写的是这间房的这个人", () => {
  const h = app.slice(app.indexOf("    onOpenFicInvite: async m => {"), app.indexOf("    // 小游戏走同一张卡"));
  assert.ok(h.length > 800, "没切到 onOpenFicInvite");
  // ⚠️「她跟谁讨论让他写谁再写」——写的人不许是别人
  assert.match(h, /byChar: activeChar,/);
  assert.match(h, /roomTalk: roomTalkOf\(key, activeChar\.remark \|\| activeChar\.name, uName, 14\),/);
  // 枪打在这儿，不在他开口那一下
  assert.match(h, /await K\.genNextChapter\(/);
  const cap = app.slice(app.indexOf("const roomFicOn ="), app.indexOf("// 小游戏跟一起学同一个形状"));
  assert.ok(cap.indexOf("genNextChapter") < 0, "他一开口就写＝她还没点就花钱了");
  // 同一间房不许连着开两枪
  assert.match(h, /if \(laneBusy\("ficroom:" \+ cid\)\) return;/);
  assert.match(h, /startLane\("ficroom:" \+ cid\);/);
  assert.match(h, /endLane\("ficroom:" \+ cid\);/);
  // 落章：记上是谁写的（跟请枪手那条路同一个形状）
  assert.match(h, /next\.chapters = \(x\.chapters \|\| \[\]\)\.concat\(\[Object\.assign\(\{\}, ch, \{ byAuthor: nm, byCharId: cid \}\)\]\);/);
  assert.match(h, /K\.saveFics\(fics\);/);
  // 推卡回房：只放开头两百字 + 他那句话
  assert.match(h, /kind: "ficdone", ficId: f\.id/);
  assert.match(h, /say: String\(ch\.authorNote \|\| ""\)\.trim\(\)\.slice\(0, 300\)/);
  assert.match(h, /content: String\(ch\.content \|\| ""\)\.trim\(\)\.slice\(0, 200\)/);
  // 那一篇被删了就别硬写
  assert.match(h, /if \(!f\) \{ toast\("那一篇找不到了"\); return; \}/);
});

test("两张卡照一起学那张的形状，不另发明一种", () => {
  const seg = comp.slice(comp.indexOf('if (m.kind === "ficinvite" || m.kind === "ficdone")'), comp.indexOf('if (m.kind === "studyinvite"'));
  assert.ok(seg.length > 600, "没切到那张卡");
  assert.match(seg, /h\(Avatar, \{ character: character, size: 34, radius: 10 \}\)/, "跟一起学那张不是一个长相");
  assert.match(seg, /done \? "他写好了" : "一起写"/);
  // ⚠️写好的那张不给「让他写」的按钮：给了她会又点一次，又花一枪
  assert.match(seg, /done \? h\("div", \{[^}]*\} \}, "全文在同人文里"\)\n\s*: h\("button"/);
  assert.match(seg, /onClick: function \(\) \{ onOpenFicInvite && onOpenFicInvite\(m\); \}/);
  assert.match(seg, /\}, "让他写"\)\)\);/);
  // 房间里不放第二份正文
  assert.match(seg, /done && m\.content \? h\("div"/);
  assert.match(comp, /  onOpenFicInvite,/, "props 没接上，按钮点了没人接");
  assert.match(app, /onOpenFicInvite: async m => \{/);
});

// ── 她 2026-09-11 追两条 ──────────────────────────────────────────────
//  ①「把我转发给他的也做成卡吧」——「拿给他看」那一条原来是条光秃秃的文字消息。
//  ②「如果我只给他看前 200 字，他怎么接后面的剧情？还是说生成文的时候本身
//     就已经有一些小结了，也能顺手扔过去」——就是这样，料全是现成的。
test("拿给他看那一条也做成卡，而且是复用转发那张", () => {
  const seg = app.slice(app.indexOf("onFileChapter: (charId, card, pick, meta) =>"), app.indexOf("onNoteChapter:"));
  assert.match(seg, /role: "user", kind: "ficshare", ts: Date\.now\(\)/, "还是条光秃秃的文字消息");
  // ⚠️他读的是 content，卡只是给她看的那一面——content 不许被卡顶掉
  assert.match(seg, /content: String\(card\)\.slice\(0, 900\),/);
  assert.match(seg, /fic: \{\n\s*title: String\(\(meta && meta\.ficTitle\) \|\| ""\)\.slice\(0, 60\),/);
  assert.match(seg, /note: String\(\(meta && meta\.note\) \|\| "拿给你看"\),/);
  // 卡上那一行小字：第几章、是拿给他看还是他写的
  assert.match(fic, /note: "第 " \+ \(i \+ 1\) \+ " 章 · " \+ \(mine \? "他写的" : "拿给你看"\),/);
  assert.match(fic, /cpText: cpLabel\(f\.cp, props\.characters, props\.userName\),/);
  // ⚠️复用转发那张卡，不新发明一种；转发那一路没有 note，长相一点没变
  assert.match(comp, /"同人文" \+ \(f\.cpText \? " · " \+ f\.cpText : ""\) \+ \(f\.note \? " · " \+ f\.note : ""\)\)/);
  assert.equal(comp.split("function FicShareCard").length - 1, 1, "又画了第二张同人文卡");
});

test("只给他看两百字不够：现成的小结一起扔过去", () => {
  const box = {};
  vm.createContext(box);
  vm.runInContext("const HOOK_TAIL = 8;" + grab(fic, "bibleBlock") + grab(fic, "seedBlock") + grab(fic, "ficRecapForChat")
    + "\nconst RECAP_CAP = 1500;\nthis.f = ficRecapForChat;", box);
  const F = { title: "长夜", premise: "他欠他一条命", bible: ["他是王爷", "那年下过雪"], seeds: ["那封信还没拆"],
    chapters: [{ content: "第一章正文", endHook: "灯灭了" }, { content: "第二章正文，最后一句在这儿。", endHook: "他没回头" }] };
  const out = box.f(F, "皇帝 × 王爷");
  // ⚠️料全是生成时就存下来的，一枪都不用多打
  assert.match(out, /【她放进这间房的那一篇《长夜》，你读过】/);
  assert.match(out, /· 这一对：皇帝 × 王爷/);
  assert.match(out, /· 地基：他欠他一条命/);
  assert.match(out, /· 到现在写了 2 章。/);
  assert.match(out, /本篇设定卡/);
  assert.match(out, /他是王爷/);
  assert.match(out, /还埋着没收的伏笔/);
  assert.match(out, /· 第 1 章结束在：灯灭了/);
  assert.match(out, /· 第 2 章结束在：他没回头/);
  assert.match(out, /【最后一章的结尾】……第二章正文，最后一句在这儿。/);
  // ⚠️这一份是给【聊天的他】读的，一条写作指令都不许带——带了他会在聊天里开始写文
  ["至少写", "字数", "输出", "JSON", "只输出"].forEach(w =>
    assert.ok(out.indexOf(w) < 0, "混进了写作指令：" + w));
  assert.match(out, /⚠️这是【那篇文里的事】，不是你俩之间发生过的事。/);
  assert.match(out, /她没提这篇，就别硬往这上头扯。/, "不说这一句，他会把那篇文当成你们的共同经历");
  // 封顶：不封的话每一轮聊天都背着一大段
  // ⚠️桩要真的撑破 1500：设定卡每条都得够长，不然封顶那道闸拆了也照样过
  const big = { title: "长", chapters: [{ content: "字".repeat(5000), endHook: "锚" }],
    bible: Array.from({ length: 60 }, (_, i) => "设定" + i + "：" + "细".repeat(40)) };
  assert.ok(box.f(big, "").length <= 1502, "没封顶：" + box.f(big, "").length);
  assert.equal(box.f(null, ""), "");
  // 真的接进了房里那一枪
  assert.match(app, /capState\.push\(window\.Fanfic\.ficRecapForChat\(roomFic,/);
  assert.match(app, /if \(roomFic && window\.Fanfic\.ficRecapForChat\) \{/);
});
