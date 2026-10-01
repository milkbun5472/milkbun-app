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
