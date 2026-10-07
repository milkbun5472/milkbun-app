// 把手机递给TA看（她 2026-10-01）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const a = src("app.js"), c = src("components.js");

test("能翻的几样是一张表，记账（现实的钱）不在里面", () => {
  const m = a.match(/const PEEK_PHONE_SECTIONS = (\[[\s\S]*?\]\]);/);
  assert.ok(m);
  const list = new Function("return " + m[1])();
  assert.deepStrictEqual(list.map(x => x[0]), ["chats", "money", "shop", "pics"]);
  assert.ok(!list.some(x => /记账/.test(x[1])));
});

test("聊天加号里有「给TA看手机」，单子能把几样藏起来再递", () => {
  assert.match(c, /\["peekphone", "给TA看手机", "mobile"\]/);
  assert.match(c, /onHandPhone\(peekAllow, peekHide, peekAllMasks\)/);
  assert.match(c, /mobile: \[R\(/);
  assert.match(a, /onHandPhone: \(allow, hideIds, allMasks\) => handPhoneTo\(activeChar\.id, allow, hideIds, false, allMasks\)/);
});

test("递过去：只摆她手机上真有的、藏了什么；主动开关和防连发闸都不拦", () => {
  assert.match(a, /const peekHint = opts\.peekPhone \?/);
  assert.match(a, /const dongnianHint = peekHint \+ letterHint \+ refuseHint \+ caughtHint \+ peekMemo \+ \(/, "递手机那段喂进这一轮");
  assert.match(a, /if \(_peekTurn\) opts = \{ \.\.\.opts, proactive: false \};/);
  assert.match(a, /if \(_peekTurn\) opts = \{ \.\.\.opts, proactive: true \};/);
  assert.ok(a.indexOf("proactive: false };") < a.indexOf("!opts.phoneAs && history.length") && a.indexOf("!opts.phoneAs && history.length") < a.indexOf("if (_peekTurn) opts = { ...opts, proactive: true };"), "摘掉→过闸→挂回 的顺序");
});

const p = src("peek-phone.js");
const loadPeek = () => { const w = {}; new Function("window", "React", p)(w, {}); return w.PeekPhone; };

test("录像脚本收拾：她藏起来的 app 打不开，心声按点开次数封顶，认不得的动作丢掉", () => {
  const P = loadPeek();
  const s = P.cleanScript({ steps: [
    { do: "open", app: "forum" }, { do: "think", text: "〇" }, { do: "open", app: "wallet" }, { do: "fly" },
    { do: "think", text: "一" }, { do: "think", text: "二" }, { do: "think", text: "三" }, { do: "think", text: "四" }, { do: "think", text: "五" }
  ] }, ["forum"]);
  assert.deepStrictEqual(s.filter(x => x.do === "open").map(x => x.app), ["forum"], "wallet 被藏了还打开了");
  assert.ok(!s.some(x => x.do === "fly"));
  assert.ok(s.filter(x => x.do === "think").length <= 6, "心声没封顶");
});

test("在她真的 app 上播：照屏幕上的字找、照返回键退，翻完回聊天再开口", () => {
  assert.match(p, /function findByText\(text, minTop, exact\)/);
  assert.match(a, /document\.querySelector\('#root \[data-watch="back"\]'\)/);
  assert.match(a, /peekPlay && window\.PeekPhone && h\(window\.PeekPhone\.PeekPlayer, \{/);
  assert.match(a, /thoughts: thoughts \|\| \[\]/);
  assert.match(a, /你刚才翻的时候心里闪过这几句/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8"), /<script src="js\/peek-phone\.js\?v=[\d.]+"><\/script>\n<script src="js\/app\.js/);
});

test("先回主屏一页页滑过去找 app、文件夹里的先点开文件夹，找不到或没点开就直接打开兜底", () => {
  assert.match(p, /const HOME_SPOT = \{/);
  assert.match(p, /function folderOf\(key\)/);
  assert.match(p, /x_homeFolders/);
  assert.match(p, /window\.__homeNav\.go\(window\.__homeNav\.page\(\) \+ dir\)/);
  assert.match(p, /if \(document\.querySelector\("#root \[data-appkey\]"\)\) return false;/);
  assert.match(p, /if \(!ok\) \{ props\.onOpen && props\.onOpen\(s\.app, s\.who\);/);
  assert.match(c, /window\.__homeNav = \{ go: goPage, page: function \(\) \{ return page; \} \};/);
  assert.match(a, /goHome: \(\) => setScreen\("home"\),/);
});

test("钱包从信息 →「我」→「我的钱包」点进去；找人前先点回「聊天」；聊天素材写清是她和别人", () => {
  assert.match(p, /wallet: \{ dock: "信息", path: \[\{ text: "我", exact: true/);
  assert.match(p, /chat: \{ dock: "信息", path: \[\{ text: "聊天", exact: true/);
  assert.match(a, /【她跟别人的聊天——这些不是跟你聊的，是她和别人之间的】/);
  assert.match(a, /翻聊天的时候记着：那是【她和别人】在聊/);
});

test("论坛先去「我」、日记先翻到她那本；钱包流水从她这边说清给了谁；书名号不挡找字", () => {
  assert.match(p, /forum: \{ dock: "论坛", path: \[\{ text: "我", exact: true/);
  assert.match(p, /diary: \{ dock: "日记", path: \[\{ call: "diaryMine" \}\] \}/);
  assert.match(src("screens.js"), /window\.__diaryNav = \{ openMine: \(\) => openEntries\("__me"\) \};/);
  assert.match(a, /【她的钱包流水——是她的钱进进出出】/);
  assert.match(a, /"她转给" \+ who\(m\[1\]\)/);
  assert.match(a, /（就是你）/);
  const P = loadPeek();
  assert.strictEqual(P.cleanScript({ steps: [{ do: "tap", text: "《我的帖子》" }] }, []).find(x => x.do === "tap").text, "我的帖子");
});

test("点开就读：聊天往上翻、帖子日记往下滑（脚本没写就代码补）；连着翻两个聊天走列表不回主屏；心声站在TA自己的世界里", () => {
  const P = loadPeek();
  const s = P.cleanScript({ steps: [{ do: "open", app: "chat", who: "甲" }, { do: "think", text: "一" }, { do: "tap", text: "帖子" }] }, ["chat"]);
  const sc = s.filter(x => x.do === "scroll");
  assert.strictEqual(sc[0].dir, "up", "聊天要往上翻");
  assert.strictEqual(sc[sc.length - 1].dir, "down", "点开的帖子要往下滑");
  assert.match(p, /elementsFromPoint/, "滚动找容器要绕开遮罩");
  assert.match(p, /if \(IN_MSG\.indexOf\(app\) >= 0 && props\.toMessages\) \{/);
  assert.match(a, /toMessages: tab => \{ setMsgTab\(tab \|\| "chats"\); setScreen\("messages"\); \},/);
  assert.match(a, /你就是「" \+ c\.name \+ "」本人，此刻在你自己的日子里/);
});

test("消息列表也是一处看点；退出来才想的那句挪回退出之前；论坛没点帖就替它点一条（匿名帖绕匿名吧）；记住上次看过啥", () => {
  const P = loadPeek();
  const s1 = P.cleanScript({ steps: [{ do: "open", app: "wallet" }, { do: "back" }, { do: "think", text: "钱" }] }, ["wallet"]);
  assert.ok(s1.findIndex(x => x.do === "think") < s1.findIndex(x => x.do === "back"), "心声还在退出之后");
  const s2 = P.cleanScript({ steps: [{ do: "open", app: "forum" }, { do: "think", text: "帖" }] }, ["forum"], { forum: [{ title: "匿名的帖", anon: true }] });
  const taps = s2.filter(x => x.do === "tap").map(x => x.text);
  assert.deepStrictEqual(taps, ["匿名的帖"], "匿名帖现在就在她的「我」里，不用绕");
  assert.match(src("screens.js"), /isMe \? \(p\.authorType === "me" && !!p\.alt === !!onAlt\) : \(p\.authorId === profileId && p\.authorType === "character" && !p\.anon\)/);   // v74.909：挂着小号时「我」只列小号的帖
  assert.match(p, /messages: \{ dock: "信息"/);
  assert.match(p, /const IN_MSG = \["chat", "messages", "wallet"\];/);
  assert.match(a, /【她的消息列表（一打开「信息」就看得到，从上往下）】/);
  assert.match(a, /saveJSON\("x_peekLast", all\)/);
  assert.match(a, /你上次翻她手机已经看过：/);
  assert.match(a, /ms\.slice\(-16\)\.map\(m => line\(x, m\)\)/);
});

test("写上日子、整段聊天的来龙去脉、至少翻 4 样（上次没翻的先去），记住上次开过哪些 app", () => {
  assert.match(a, /今天是" \+ \(d\.getMonth\(\) \+ 1\) \+ "月"/);
  assert.match(a, /聊起，一共 " \+ n \+ " 条；往上翻得到的是最近这些/);
  assert.match(a, /ms\.slice\(-16\)\.map\(m => line\(x, m\)\)/, "只给屏幕上翻得到的那一截");
  assert.match(a, /md\(e\.ts\) \+ "写的"/);
  assert.doesNotMatch(a, /const COLD = /, "查岗不硬塞冷门 app（她 2026-10-01）");
  assert.match(a, /单聊至少看 3 个人/);
  assert.match(a, /群是额外的，看完单聊想看就看/);
  assert.match(a, /apps: \[\.\.\.new Set\(sc\.filter\(s => s\.do === "open"\)\.map\(s => s\.app\)\)\]/);
});

test("翻手机：购物先进「我的」、外卖先进「订单」，两份单子分开写，补的冷门 app 只插在 open 前", () => {
  const p = require("fs").readFileSync(require("path").join(__dirname, "../js/peek-phone.js"), "utf8");
  const a = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  assert.match(p, /shop: \{ key: "shop", path: \[\{ text: "我的"/);
  assert.match(p, /takeout: \{ key: "takeout", path: \[\{ text: "订单"/);
  assert.match(a, /【购物 app 里的订单】/);
  assert.match(a, /【外卖 app 里的订单】/);
});

test("翻手机：翻完的料留到TA真接上话才用掉，她先开口也接得上", () => {
  const a = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  // 2026-10-06 起这份料走公共的 waitForHer（不再是递手机自己一份），翻完也不当场开口
  assert.match(a, /waitForHer\(p\.charId, \{ peekPhone: \{/);
  assert.match(a, /const _wh = !opts\.room && !opts\.proactive && waitHerRef\.current\[charId\];/);
  assert.match(a, /if \(delivered && _wh\) delete waitHerRef\.current\[charId\]/);
});

test("翻手机：帖子滑到评论区；组件不去点里面的按钮；料里带评论；按查她手机来想", () => {
  const p = require("fs").readFileSync(require("path").join(__dirname, "../js/peek-phone.js"), "utf8");
  const a = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  assert.match(p, /const POST_READ = \(\) =>/);
  assert.doesNotMatch(p, /el\.querySelector\("button, \[role=button\]"\)/);
  assert.match(a, /const floors = p =>/);
  assert.match(a, /这是在查她的手机/);
});

test("翻手机：看完开口不限条数，照心情多说或沉默", () => {
  const a = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  assert.doesNotMatch(a, /看到在意的就说，1~4 条消息/);
  assert.match(a, /说多少照你此刻的心情来/);
});

test("翻手机：先查聊天；聊天里往下滑改往上；兜底打开也走底栏路径；一起听带播放记录和挂着的人；对照她对你的语气", () => {
  const fs = require("fs"), path = require("path");
  const p = fs.readFileSync(path.join(__dirname, "../js/peek-phone.js"), "utf8");
  const a = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  global.window = global.window || {};
  const PP = (new Function("window", "document", "React", p + ";return window.PeekPhone;"))(global.window, {}, {});
  const out = PP.cleanScript({ steps: [{ do: "open", app: "forum" }, { do: "open", app: "chat", who: "A" }, { do: "scroll", dir: "down", n: 1 }, { do: "think", text: "嗯" }] }, ["forum", "chat", "messages"], {});
  assert.equal(out.find(s => s.do === "open").app, "messages");
  const ci = out.findIndex(s => s.do === "open" && s.app === "chat");
  assert.equal(out[ci + 1].dir, "up");
  assert.match(p, /if \(sp && sp\.key && sp\.path\)/);
  assert.match(a, /她现在挂着跟/);
  assert.match(a, /【对照：她最近跟你说话是这样的】/);
});

test("翻手机：只查聊天；钱包外卖购物要聊天里有线索才去；列表里点人名就是打开那人的聊天，列表不往外退", () => {
  const fs = require("fs"), path = require("path");
  const p = fs.readFileSync(path.join(__dirname, "../js/peek-phone.js"), "utf8");
  const a = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  global.window = global.window || {};
  const PP = (new Function("window", "document", "React", p + ";return window.PeekPhone;"))(global.window, {}, {});
  const out = PP.cleanScript({ steps: [{ do: "open", app: "messages" }, { do: "back" }, { do: "tap", text: "阿乙" }, { do: "think", text: "x" },
    { do: "open", app: "takeout" }, { do: "think", text: "不该出现" }, { do: "open", app: "wallet" }, { do: "think", text: "y" }] },
    ["messages", "chat", "wallet", "takeout", "shop"], { who: ["阿乙"], gate: ["wallet"] });
  assert.ok(!out.some(s => s.do === "back"), "消息列表上不往外退");
  assert.ok(out.some(s => s.do === "open" && s.app === "chat" && s.who === "阿乙"), "点人名＝打开聊天");
  assert.ok(!out.some(s => s.app === "takeout" || s.text === "不该出现"), "没线索的外卖连同心声一起不演");
  assert.ok(out.some(s => s.app === "wallet"));
  assert.match(a, /const CLUE = \{ transfer: "wallet", redpacket: "wallet", takeout: "takeout", gift: "shop" \}/);
  assert.match(a, /toMessages: tab => \{ setMsgTab\(tab \|\| "chats"\)/);
});

test("翻手机：没心声的那段不删；open 自带心声；心声上限放宽；列表里找人只按一下、交给外面按 id 打开单聊", () => {
  const fs = require("fs"), path = require("path");
  const p = fs.readFileSync(path.join(__dirname, "../js/peek-phone.js"), "utf8");
  global.window = global.window || {};
  const PP = (new Function("window", "document", "React", p + ";return window.PeekPhone;"))(global.window, {}, {});
  const out = PP.cleanScript({ steps: [{ do: "open", app: "chat", who: "甲" }, { do: "think", text: "一" }, { do: "think", text: "二" }, { do: "think", text: "三" },
    { do: "open", app: "chat", who: "乙" }, { do: "scroll", dir: "up", n: 2 }] }, ["chat", "messages"], {});
  assert.ok(out.some(s => s.who === "乙"), "没心声的聊天不删");
  const withT = PP.cleanScript({ steps: [{ do: "open", app: "chat", who: "丙", thoughts: ["甲句", "乙句"] }] }, ["chat"], {});
  assert.equal(withT.filter(s => s.do === "think").length, 2, "open 自带的心声展开成边翻边想");
  assert.equal(out.filter(s => s.do === "think").length, 3, "一个聊天能想三句");
  assert.match(p, /if \(app === "chat" && who\) \{ const n = findRow\(who\); if \(n\) \{ await scrollTo\(n\); await pressOnly\(n\); \} return false; \}/);
});

test("翻手机：同一个聊天先安静开一回、再带心声开一回——安静的那回删掉", () => {
  const fs = require("fs"), path = require("path");
  const p = fs.readFileSync(path.join(__dirname, "../js/peek-phone.js"), "utf8");
  global.window = global.window || {};
  const PP = (new Function("window", "document", "React", p + ";return window.PeekPhone;"))(global.window, {}, {});
  const out = PP.cleanScript({ steps: [{ do: "open", app: "chat", who: "甲" }, { do: "scroll", dir: "up", n: 2 }, { do: "back" },
    { do: "open", app: "chat", who: "甲", thoughts: ["想一", "想二"] }] }, ["chat", "messages"], {});
  assert.equal(out.filter(s => s.do === "open" && s.who === "甲").length, 1);
  assert.equal(out.filter(s => s.do === "think").length, 2);
});

test("翻手机：动作描写不当聊天；她在的群照群开（旁观群不给）；线索只看近 3 天；列表先滑到那一行再点", () => {
  const fs = require("fs"), path = require("path");
  const a = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  const p = fs.readFileSync(path.join(__dirname, "../js/peek-phone.js"), "utf8");
  assert.match(a, /m\.role !== "narration" && m\.kind !== "narration" && contextAllowsMessage\(m\)/);
  assert.match(a, /【她在的群（打开时 who 写群名）】/);
  assert.match(a, /if \(g\) \{ setActiveGroup\(g\); clearUnread\(g\.id\); setScreen\("gthread"\); return; \}/);
  assert.match(a, /Date\.now\(\) - \(m\.ts \|\| 0\) < 3 \* 86400000/);
  assert.match(p, /if \(n\) \{ await scrollTo\(n\); await pressOnly\(n\); \}/);
});

test("翻手机：留一个位置给以前聊得多、后来断了的那个人", () => {
  const a = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  assert.match(a, /const gone = rowsAll\.slice\(3\)\.filter\(x => Date\.now\(\) - x\.last > 7 \* 86400000 && x\.ms\.length >= 30\)/);
  assert.match(a, /以前聊得挺多，后来断了/);
});

test("翻手机：能单独藏某个人的聊天（列表里也不出现）；TA能开口要手机，卡片上给／不给", () => {
  const fs = require("fs"), path = require("path");
  const a = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  const c = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
  assert.match(c, /onHandPhone\(peekAllow, peekHide, peekAllMasks\)/);
  assert.match(c, /window\.__peekHide\.has\(String\(it\.id\)\)/);
  assert.match(a, /const peekPhoneMaterial = \(viewerId, allow, hideIds, maskIds\)/);
  assert.match(a, /try \{ window\.__peekHide = null; \} catch \(e\) \{\}/, "播完要清");
  assert.match(a, /askPhone:"开口那句话"=想看她的手机；/);
  assert.match(a, /kind: "askphone"/);
  assert.match(c, /function PhoneAskCard\(/);
  assert.match(a, /replyNow\(charId, "", null, \{ proactive: true, phoneRefused: true \}\)/);
  assert.match(a, /Date\.now\(\) - \(a\[charId\] \|\| 0\) > 20 \* 3600e3/, "一天最多要一回");
});

test("翻手机：只在吵架生气时有几率开口要；单独藏的人直接告诉TA", () => {
  const a = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  assert.match(a, /phoneAskReady\(charId\) && \(_moodNeg \|\| _harsh\) && Math\.random\(\) < 0\.5/);
  assert.match(a, /的聊天藏起来了——消息列表里没有，你翻不到，但你知道她藏了/);
  assert.match(a, /hidden: hidden\.concat\(hidePeople\.map/);
});

test("翻手机：消息列表里有TA自己那一行；TA能进自己那栏改她给的备注（真改，一趟一次）", () => {
  const fs = require("fs"), path = require("path");
  const a = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  const p = fs.readFileSync(path.join(__dirname, "../js/peek-phone.js"), "utf8");
  global.window = global.window || {};
  const PP = (new Function("window", "document", "React", p + ";return window.PeekPhone;"))(global.window, {}, {});
  const out = PP.cleanScript({ steps: [{ do: "open", app: "messages" }, { do: "think", text: "嗯" }, { do: "rename", text: "「老公」" }, { do: "rename", text: "二次" }] }, ["messages", "chat"], {});
  assert.deepStrictEqual(out.filter(s => s.do === "rename").map(s => s.text), ["老公"]);
  assert.match(a, /filter\(c => c\.id === viewerId \|\| shownId\(c\.id\)\)/);
  assert.match(a, /\(x\.c\.id === viewerId \? "【你自己】" : ""\)/);
  assert.doesNotMatch(a, /"· 第" \+ \(i \+ 1\) \+ "行"/, "不给每行标号，TA会去数第几行");
  assert.match(a, /pC\(p => p\.map\(x => x\.id === charId \? \{ \.\.\.x, remark: text \} : x\)\)/);
  assert.match(p, /props\.onRename && props\.onRename\(s\.text, old\)/);
});

test("翻手机：置顶／取消置顶／删好友／拉黑／用她名义回一句，各一趟一次；删好友拉黑只是盖一张空白页、能加回来", () => {
  const fs = require("fs"), path = require("path");
  const a = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  const c = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
  const p = fs.readFileSync(path.join(__dirname, "../js/peek-phone.js"), "utf8");
  global.window = global.window || {};
  const PP = (new Function("window", "document", "React", p + ";return window.PeekPhone;"))(global.window, {}, {});
  const out = PP.cleanScript({ steps: [{ do: "open", app: "messages" }, { do: "think", text: "嗯" }, { do: "pin" }, { do: "pin", who: "甲" },
    { do: "unfriend", who: "甲" }, { do: "block", who: "不在名单" }, { do: "impersonate", who: "乙", text: "她有男朋友了" }, { do: "impersonate", who: "乙" }] }, ["messages", "chat"], { who: ["甲", "乙"] });
  assert.deepStrictEqual(out.filter(s => ["pin", "unfriend", "block", "impersonate"].includes(s.do)).map(s => s.do + ":" + (s.who || "")), ["pin:", "unfriend:甲", "impersonate:乙"]);
  assert.match(a, /savePeekCut\(p => \(\{ \.\.\.p, \[tgt\.id\]: \{ kind: step\.do, by: viewerId, ts: Date\.now\(\) \} \}\)\)/);
  assert.match(a, /peekCut\[activeChar\.id\]\) body = h\(PeekCutPage, \{/);
  assert.match(c, /function PeekCutPage\(/);
  assert.match(c, /un \? "加回好友" : "解除拉黑"/);
  assert.match(a, /pChat\(tgt\.id, p => \[\.\.\.p, \{ role: "user", content: step\.text, ts: Date\.now\(\), peekBy: viewerId \}\]\)/);
});

test("翻手机：偷偷翻——每个角色一个开关、所有角色共用一个冷却；当场生效，留卡片能回放／当面问／装没看见；回放不再动一遍", () => {
  const fs = require("fs"), path = require("path");
  const a = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  const c = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
  assert.match(a, /const PEEK_SNEAK_GAP = 24 \* 3600e3;/);
  assert.match(a, /loadJSON\("x_peekSneakLast", 0\)/, "冷却只有一个，不按角色分");
  assert.match(a, /handPhoneTo\(charId, PEEK_PHONE_SECTIONS\.map\(s => s\[0\]\), \[\], true\)/);
  assert.match(a, /kind: "peeksneak"/);
  assert.match(a, /onEffect: step => \{ if \(!peekPlay\.replay\) peekEffect/);
  assert.match(a, /if \(p && p\.replay\) \{ openChatById\(p\.charId\); return; \}/);
  assert.match(c, /function PeekSneakCard\(/);
  assert.match(c, /"允许" \+ \(character\.remark \|\| character\.name\) \+ "偷偷翻"/);
});

test("翻手机：查手机记事进之后一周的上下文；两张卡不当TA的话进历史；列表按 id 找那一行", () => {
  const fs = require("fs"), path = require("path");
  const a = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  const c = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
  const p = fs.readFileSync(path.join(__dirname, "../js/peek-phone.js"), "utf8");
  assert.match(a, /&& m\.kind !== "askphone" && m\.kind !== "peeksneak"\);/);
  assert.match(a, /const peekMemo = \(opts\.peekPhone \? "" : peekMemoFor\(charId\)\) \+ remarkHint;/);   // v74.978 她改TA通讯录备注那句挂在同一格
  assert.match(a, /Date\.now\(\) - x\.ts < 7 \* 86400000/);
  assert.match(a, /peekLogAdd\(charId, \{ how: "refused" \}\)/);
  assert.match(a, /peekLogAdd\(charId, \{ how: "sneak"/);
  assert.match(c, /"data-chatid": c\.id/);
  assert.match(c, /"data-chatid": g\.id/);
  assert.match(p, /const findRow = who =>/);
});

test("翻手机：动手那几样是鼓励、不是「别写」，格式示范里有", () => {
  const a = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  assert.doesNotMatch(a, /真气到那份上才用，不想就一样都别写/);
  assert.match(a, /照你的性子挑一两样做（各一趟最多一次）/);
  assert.match(a, /\{\\"do\\":\\"impersonate\\",\\"who\\":\\"名字\\",\\"text\\":/);
});

test("翻手机：滑到那一行用它自己的滚动容器、滑不动就停；不演打开自己的聊天、不演点「设置／备注」这种空点", () => {
  const fs = require("fs"), path = require("path");
  const p = fs.readFileSync(path.join(__dirname, "../js/peek-phone.js"), "utf8");
  global.window = global.window || {};
  const PP = (new Function("window", "document", "React", p + ";return window.PeekPhone;"))(global.window, {}, {});
  const out = PP.cleanScript({ steps: [{ do: "open", app: "messages" }, { do: "think", text: "嗯" }, { do: "open", app: "chat", who: "我自己" }, { do: "tap", text: "设置备注" }, { do: "scroll", dir: "up" },
    { do: "rename", text: "新名" }] }, ["messages", "chat"], { who: ["甲"], self: "我自己" });
  assert.ok(!out.some(s => s.do === "open" && s.who === "我自己"));
  assert.ok(!out.some(s => s.do === "tap"));
  assert.ok(out.some(s => s.do === "rename"));
  assert.match(p, /if \(Math\.abs\(sc\.scrollTop - before\) < 2\) return;/);
});

test("翻手机：她藏了的，TA心里有数（翻的时候和翻完开口都知道）", () => {
  const a = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  assert.match(a, /她是当着你的面藏的，你知道/);
  assert.match(a, /翻的时候想到这一茬，心声里就带上/);
});

test("翻手机：换了面具聊的人默认查不到（连钱包购物痕迹一起）；单子里能打开「别的面具聊的也给看」；不当成「她藏了」", () => {
  const fs = require("fs"), path = require("path");
  const a = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  const c = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
  assert.match(a, /const peekMaskOthers = viewerId =>/);
  assert.match(a, /const maskIds = allMasks \? \[\] : peekMaskOthers\(charId\);/);
  assert.match(a, /\(walletLog \|\| \[\]\)\.filter\(w => !maskTrace\(w\.label\)\)/);
  assert.match(a, /const userHide = new Set\(\(hideIds \|\| \[\]\)\.map\(String\)\);/);
  assert.match(c, /"别的面具聊的也给看"/);
  assert.match(c, /onHandPhone\(peekAllow, peekHide, peekAllMasks\)/);
});

test("翻手机：递手机单子分三格折叠（能翻的几样／单独藏起几个人／更多），用公共 FoldRow，论坛设置也是它", () => {
  const fs = require("fs"), path = require("path");
  const c = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
  const sc = fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8");
  assert.match(c, /function FoldRow\(\{ title, state, open, onToggle, children \}\)/);
  assert.match(c, /h\(FoldRow, \{ title: "能翻的几样"/);
  assert.match(c, /h\(FoldRow, \{ title: "单独藏起几个人"/);
  assert.match(c, /h\(FoldRow, \{ title: "更多"/);
  assert.match(sc, /const fold = \(key, title, state, kids\) => h\(FoldRow,/);
});
