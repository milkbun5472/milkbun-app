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
  assert.match(out, /在 penNote 里当面跟她说一句为什么/);
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

test("这间房在聊哪一篇：只认这间房自己的卡，她挑过就听她的", () => {
  // v67.21：一间房可以放好几本（她 2026-09-12：「放吧」）。判哪一本的算法搬去了
  //   ChatRooms（纯函数，见 test/room-many-fics-67-21.test.js），这儿只测 app 这一头：
  //   她挑的那一本存在哪儿、挑的那本被删了怎么退。
  const pickStore = {};
  const box = { chatsRef: { current: {} }, window: {},
    loadJSON: (k, d) => (k === "x_roomFicPick" ? pickStore : d),
    saveJSON: () => {} };
  box.window.Fanfic = { loadFics: () => [{ id: "f1", title: "甲" }, { id: "f2", title: "乙" }] };
  box.window.ChatRooms = require("../js/chat-rooms.js");
  vm.createContext(box);
  vm.runInContext("const window = this.window;" + app.slice(app.indexOf("  const K_ROOM_FIC_PICK ="), app.indexOf("  // 你们在这间房里刚聊过的那几句"))
    + "\nthis.f = lastRoomFic; this.pick = setRoomFicPick; this.list = roomFicsOf;", box);
  box.chatsRef.current["c1:r1"] = [{ ts: 1, ficId: "f1" }, { ts: 2, content: "聊天" }, { ts: 3, ficId: "f2" }];
  box.chatsRef.current["c1:r2"] = [{ ts: 1, ficId: "f1" }];
  assert.equal(box.f("c1:r1").title, "乙", "没挑过就是最近放进来那一张");
  assert.equal(box.f("c1:r2").title, "甲");
  assert.equal(box.f("c1:r3"), null, "别的房放过什么，跟这间房不相干");
  // 她点了「换书」换回甲——这正是她当场问的那一种情况
  pickStore["c1:r1"] = { id: "f1", title: "甲", ts: 99 };
  assert.equal(box.f("c1:r1").title, "甲", "换回去了还认最近那一张＝换书是假的");
  // 换书单子上两本都在，最近动过的在前——换书本身也算动过，所以刚换回的甲排头一个
  assert.deepEqual(box.list("c1:r1").map(x => x.title), ["甲", "乙"]);
  // ⚠️走 setRoomFicPick 本人，不是手写一个 ts：换书那一下不记时间的话，
  //   她挑的那本会排到所有卡前面去，点了等于没点
  delete pickStore["c1:r1"];
  assert.equal(box.f("c1:r1").title, "乙", "先回到没挑过的状态");
  box.pick("c1:r1", "f1", "甲");
  assert.ok(Number(pickStore["c1:r1"].ts) > 0, "换书那一下没记时间");
  assert.equal(box.f("c1:r1").title, "甲", "记了时间才排得到卡后面去");
  // 文被删了就别硬认
  box.chatsRef.current["c1:r4"] = [{ ts: 1, ficId: "gone" }];
  assert.equal(box.f("c1:r4"), null);
  // ⚠️当前那本被删了要往回退，不是两手空空
  pickStore["c1:r5"] = { id: "gone", title: "没了", ts: 99 };
  box.chatsRef.current["c1:r5"] = [{ ts: 1, ficId: "f1" }, { ts: 2, ficId: "gone" }];
  assert.equal(box.f("c1:r5").title, "甲", "挑的那本被删了就该退回房里还认得的上一本");
  // 删掉的那本也不该摆在换书单子上
  assert.deepEqual(box.list("c1:r5").map(x => x.title), ["甲"]);
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
  assert.match(h, /roomTalk: roomTalkOf\(key, activeChar\.remark \|\| activeChar\.name, uName, 14, f\.id\),/);
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
  assert.match(h, /say: String\(ch\.penNote \|\| ""\)\.trim\(\)\.slice\(0, 300\)/);
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
  // ⚠️v67.14：这儿写过一次 ch.content——那个闭包里压根没有 ch（那一章叫 ch2），
  //   点下去当场抛异常，按钮看着像死的（她 2026-09-11：「拿给他看那个按钮是死的」）。
  //   所以摘要必须从【这个闭包自己声明的那一章】上取。
  const onFile = fic.slice(fic.indexOf("        onFile: function (c, noteOnly, roomPick) {"), fic.indexOf("        setFileIdx(-1);"));
  assert.ok(onFile.length > 300, "没切到 onFile");
  assert.match(onFile, /const ch2 = \(f\.chapters \|\| \[\]\)\[i\] \|\| \{\};/);
  assert.match(onFile, /excerpt: String\(ch2\.content \|\| ""\)\.trim\(\)\.slice\(0, 90\)/);
  // ⚠️先把注释剥掉：病历里就写着 ch.content 那几个字，拿原文去断永远是红的
  const onFileNoc = onFile.split("\n").map(l => l.split("//")[0]).join("\n").replace(/ch2\./g, "");
  assert.ok(!/[^a-zA-Z0-9_]ch\./.test(onFileNoc), "又去摸了一个这个闭包里不存在的 ch");
  // ⚠️复用转发那张卡，不新发明一种；转发那一路没有 note，长相一点没变
  assert.match(comp, /"同人文" \+ \(f\.cpText \? " · " \+ f\.cpText : ""\) \+ \(f\.note \? " · " \+ f\.note : ""\)\)/);
  assert.equal(comp.split("function FicShareCard").length - 1, 1, "又画了第二张同人文卡");
});

test("只给他看两百字不够：现成的小结一起扔过去", () => {
  const box = {};
  vm.createContext(box);
  vm.runInContext("const HOOK_TAIL = 8; const BIBLE_TAIL = 14;"
    + grab(fic, "bibleBlock") + grab(fic, "seedBlock") + grab(fic, "ficRecapForChat")
    + "\nthis.f = ficRecapForChat;", box);
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
  // ⚠️长篇那一头（她 2026-09-11：「我要他接写了很多章的」）：
  //   每一段各自截断，**最后一章的结尾必须活下来**——原来统一切一刀，
  //   而刀是从队尾落的，最要紧的那一段第一个被切掉。
  const big = { title: "长", premise: "地".repeat(400),
    chapters: Array.from({ length: 20 }, (_, i) => ({ content: "第" + i + "章正文" + "字".repeat(500) + "这是最后一句。", endHook: "锚" + i })),
    bible: Array.from({ length: 60 }, (_, i) => "设定" + i + "：" + "细".repeat(40)),
    seeds: Array.from({ length: 20 }, (_, i) => "伏笔" + i + "：" + "细".repeat(40)) };
  const bigOut = box.f(big, "甲 × 乙");
  assert.match(bigOut, /【最后一章的结尾】……/, "最后一章的结尾被那一刀切掉了");
  assert.match(bigOut, /这是最后一句。/, "结尾只剩半截");
  assert.match(bigOut, /· 第 20 章结束在：锚19/, "最近几章的锚点没了");
  assert.match(bigOut, /只列最近 14 条/, "设定卡没收着，它会把别的挤掉");
  assert.ok(bigOut.length < 2600, "太长了：" + bigOut.length);
  // 短的那一篇不许被截：二十章的刀不能落到三章的文上
  assert.ok(box.f(F, "皇帝 × 王爷").indexOf("只列最近") < 0);
  assert.equal(box.f(null, ""), "");
  // 真的接进了房里那一枪
  assert.match(app, /capState\.push\(window\.Fanfic\.ficRecapForChat\(roomFic,/);
  assert.match(app, /if \(roomFic && window\.Fanfic\.ficRecapForChat\) \{/);
});

test("界面上得说清楚：放一张就够，不用一章一章发", () => {
  // 她 2026-09-11：「那我要他接写了很多章的只能一章一章发给他嘛」——
  // 不用，可那一页从来没说过，她只能照着「开头两百字」那句猜。
  assert.match(fic, /放一张就够：这一篇的地基、设定卡、还埋着的伏笔、每一章结束在哪儿、/);
  assert.match(fic, /上一章的结尾，都会跟着进他手里——写了多少章都一样，不用一章一章发。/);
  // ⚠️界面上的字不许写 markdown：** ** 会原样显示出来
  const line = fic.slice(fic.indexOf("放一张就够"), fic.indexOf("不用一章一章发。") + 10);
  assert.ok(line.indexOf("**") < 0, "界面上的字里有 markdown，会原样显示");
});
