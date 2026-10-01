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
  assert.deepStrictEqual(list.map(x => x[0]), ["chats", "forum", "money", "shop", "music", "memo", "journal", "pics"]);
  assert.ok(!list.some(x => /记账/.test(x[1])));
});

test("聊天加号里有「给TA看手机」，单子能把几样藏起来再递", () => {
  assert.match(c, /\["peekphone", "给TA看手机", "mobile"\]/);
  assert.match(c, /onHandPhone\(peekAllow\)/);
  assert.match(c, /mobile: \[R\(/);
  assert.match(a, /onHandPhone: allow => handPhoneTo\(activeChar\.id, allow\)/);
});

test("递过去：只摆她手机上真有的、藏了什么；主动开关和防连发闸都不拦", () => {
  assert.match(a, /const peekHint = opts\.peekPhone \?/);
  assert.match(a, /const dongnianHint = peekHint \+ \(/, "递手机那段喂进这一轮");
  assert.match(a, /if \(_peekTurn\) opts = \{ \.\.\.opts, proactive: false \};/);
  assert.match(a, /if \(_peekTurn\) opts = \{ \.\.\.opts, proactive: true \};/);
  assert.ok(a.indexOf("proactive: false };") < a.indexOf("!opts.phoneAs && history.length") && a.indexOf("!opts.phoneAs && history.length") < a.indexOf("if (_peekTurn) opts = { ...opts, proactive: true };"), "摘掉→过闸→挂回 的顺序");
});

const p = src("peek-phone.js");
const loadPeek = () => { const w = {}; new Function("window", "React", p)(w, {}); return w.PeekPhone; };

test("录像脚本收拾：她藏起来的 app 打不开，心声按点开次数封顶，认不得的动作丢掉", () => {
  const P = loadPeek();
  const s = P.cleanScript({ steps: [
    { do: "open", app: "forum" }, { do: "open", app: "wallet" }, { do: "fly" },
    { do: "think", text: "一" }, { do: "think", text: "二" }, { do: "think", text: "三" }, { do: "think", text: "四" }, { do: "think", text: "五" }
  ] }, ["forum"]);
  assert.deepStrictEqual(s.filter(x => x.do === "open").map(x => x.app), ["forum"], "wallet 被藏了还打开了");
  assert.ok(!s.some(x => x.do === "fly"));
  assert.ok(s.filter(x => x.do === "think").length <= 4, "心声没封顶");
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
  assert.match(p, /IN_MSG\.indexOf\(lastAppRef\.current\) >= 0 && props\.toMessages/);
  assert.match(a, /toMessages: \(\) => setScreen\("messages"\),/);
  assert.match(a, /你就是「" \+ c\.name \+ "」本人，此刻在你自己的日子里/);
});

test("消息列表也是一处看点；退出来才想的那句挪回退出之前；论坛没点帖就替它点一条（匿名帖绕匿名吧）；记住上次看过啥", () => {
  const P = loadPeek();
  const s1 = P.cleanScript({ steps: [{ do: "open", app: "wallet" }, { do: "back" }, { do: "think", text: "钱" }] }, ["wallet"]);
  assert.ok(s1.findIndex(x => x.do === "think") < s1.findIndex(x => x.do === "back"), "心声还在退出之后");
  const s2 = P.cleanScript({ steps: [{ do: "open", app: "forum" }, { do: "think", text: "帖" }] }, ["forum"], { forum: [{ title: "匿名的帖", anon: true }] });
  const taps = s2.filter(x => x.do === "tap").map(x => x.text);
  assert.deepStrictEqual(taps, ["匿名的帖"], "匿名帖现在就在她的「我」里，不用绕");
  assert.match(src("screens.js"), /isMe \? p\.authorType === "me" : \(p\.authorId === profileId && p\.authorType === "character" && !p\.anon\)/);
  assert.match(p, /messages: \{ dock: "信息"/);
  assert.match(p, /const IN_MSG = \["chat", "messages", "wallet"\];/);
  assert.match(a, /【她的消息列表（一打开「信息」就看得到）】/);
  assert.match(a, /saveJSON\("x_peekLast", all\)/);
  assert.match(a, /你上次翻她手机已经看过：/);
  assert.match(a, /seg\("最近", ms\.slice\(-12\)\)/);
});

test("写上日子、整段聊天的来龙去脉、至少翻 4 样（上次没翻的先去），记住上次开过哪些 app", () => {
  assert.match(a, /今天是" \+ \(d\.getMonth\(\) \+ 1\) \+ "月"/);
  assert.match(a, /聊起，到现在一共 " \+ n \+ " 条）/);
  assert.match(a, /seg\("早先", ms\.slice\(0, 4\)\)/);
  assert.match(a, /md\(e\.ts\) \+ "写的"/);
  assert.match(a, /while \(fresh < 2 && pool\.length\)/, "按「上次没开过的」算，不是按总数");
  assert.match(a, /const COLD = \["shop", "takeout", "listen", "memo"/);
  assert.match(a, /apps: \[\.\.\.new Set\(sc\.filter\(s => s\.do === "open"\)\.map\(s => s\.app\)\)\]/);
});

test("翻手机：购物先进「我的」、外卖先进「订单」，两份单子分开写，补的冷门 app 只插在 open 前", () => {
  const p = require("fs").readFileSync(require("path").join(__dirname, "../js/peek-phone.js"), "utf8");
  const a = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  assert.match(p, /shop: \{ key: "shop", path: \[\{ text: "我的"/);
  assert.match(p, /takeout: \{ key: "takeout", path: \[\{ text: "订单"/);
  assert.match(a, /【购物 app 里的订单】/);
  assert.match(a, /【外卖 app 里的订单】/);
  assert.match(a, /s\.do === "open" \? i : -1/);
});

test("翻手机：翻完的料留到TA真接上话才用掉，她先开口也接得上", () => {
  const a = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  assert.match(a, /peekPendingRef\.current\[p\.charId\] = \{/);
  assert.match(a, /opts = \{ \.\.\.opts, peekPhone: _pk \}/);
  assert.match(a, /if \(delivered && _peekTurn\) delete peekPendingRef\.current\[charId\]/);
});

test("翻手机：帖子滑到评论区；组件不去点里面的按钮；料里带评论；按查她手机来想", () => {
  const p = require("fs").readFileSync(require("path").join(__dirname, "../js/peek-phone.js"), "utf8");
  const a = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
  assert.match(p, /const POST_READ = \(\) =>/);
  assert.doesNotMatch(p, /el\.querySelector\("button, \[role=button\]"\)/);
  assert.match(a, /const floors = p =>/);
  assert.match(a, /这是在查她的手机/);
});
