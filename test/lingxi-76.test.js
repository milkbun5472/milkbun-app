// 心有灵犀（她 2026-10-30）：各写一个连上两个词的新词，一样得分；写词前能聊；亮词后看 TA 怎么想的。
const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const L = require("../js/lingxi-core.js");
const g = fs.readFileSync("js/games.js", "utf8"), list = fs.readFileSync("js/games-list.js", "utf8"),
  idx = fs.readFileSync("index.html", "utf8"), ts = fs.readFileSync("js/theme-studio.js", "utf8"), man = fs.readFileSync("js/assistant-manual.js", "utf8");

test("挂进小游戏柜：目录、分派、懒加载、攻略", () => {
  assert.match(list, /key: "lingxi", emoji: "🔗", zh: "心有灵犀"[^}]*min: 2, max: 2/);
  assert.match(g, /if \(session\.game\.key === "lingxi" && window\.LingxiCore\) return h\(LingxiGame, engineProps\);/);
  assert.match(idx, /data-lazy="games" data-src="js\/lingxi-core\.js\?v=/);
  assert.match(man, /\*\*心有灵犀：\*\*[^\\]*算我们一样[^\\]*是怎么想的/);
});

test("比对：空白、标点、大小写、全半角不算", () => {
  assert.ok(L.same(" 月亮 ", "月亮。"));
  assert.ok(L.same("「海 边」", "海边！"));
  assert.ok(L.same("Coffee", "ｃｏｆｆｅｅ"));
  assert.ok(!L.same("月亮", "太阳"));
  assert.ok(!L.same("", "  "));
  assert.equal(L.cleanWord("「星星」\n因为……"), "星星");
});

test("计分与「算我们一样」", () => {
  const s = L.newGame(); s.start = ["猫", "雨"]; s.pair = ["猫", "雨"]; s.status = "play";
  const r1 = L.reveal(s, "伞", "伞");
  assert.ok(r1.hit); assert.deepEqual(s.pair, ["伞", "伞"]);
  const r2 = L.reveal(s, "晴天", "太阳");
  assert.equal(L.score(s.rounds), 1);
  L.toggleManual(s, r2.n); assert.equal(L.score(s.rounds), 2);
  L.toggleManual(s, r2.n); assert.equal(L.score(s.rounds), 1);
  L.toggleManual(s, r1.n); assert.equal(r1.manual, false, "自动对上的那轮不用手点");
});

test("TA 写词的提示词里没有她这一轮的词；聊过的话在里面", () => {
  const s = L.newGame(); s.start = ["猫", "雨"]; s.pair = ["猫", "雨"]; s.status = "play";
  L.reveal(s, "伞", "屋檐");
  s.talk = [{ who: "me", text: "往下雨天想" }, { who: "ta", text: "我懂了" }];
  const herSecret = "秘密词蜻蜓";
  const p = L.roundPrompt({ uName: "她", who: "", state: s });
  assert.ok(p.indexOf(herSecret) < 0);
  assert.match(p, /「伞」/); assert.match(p, /「屋檐」/);
  assert.match(p, /往下雨天想/);
  assert.match(p, /"thought"/); assert.match(p, /"say"/);
  assert.ok(L.openPrompt({ uName: "她", who: "" }).indexOf("猫") < 0, "开局 TA 看不到她的起始词");
  const tp = L.talkPrompt({ uName: "她", who: "", state: s, line: "你猜我写啥" });
  assert.match(tp, /还没定你的词/);
  // 亮词后这一轮聊的随着那一轮进往期，下一轮从空的开始
  const r = L.reveal(s, "水", "水"); assert.equal(r.talk.length, 2); assert.equal(s.talk.length, 0);
  // 组件这头：她的 draft 只在拿到 TA 的词以后才用；提示词只拿 state
  const comp = g.slice(g.indexOf("function LingxiGame("), g.indexOf("function TetBoard("));
  assert.match(comp, /L\.roundPrompt\(\{ uName: uName, who: who, state: state,/);
  assert.doesNotMatch(comp, /roundPrompt\([^)]*mine/);
});

test("TA 的话和心思只在亮词以后上屏", () => {
  const comp = g.slice(g.indexOf("function LingxiGame("), g.indexOf("function TetBoard("));
  // 心思挂在已经揭晓的那一轮（last）或起始词上，不在请求进行中渲染
  assert.match(comp, /const thought = last \? last\.thought : state\.startThought;/);
  assert.match(comp, /PT\("他是怎么想的"\)/);
  const thenIdx = comp.indexOf("ask(sys, \"心有灵犀\").then");
  assert.ok(comp.indexOf("L.reveal(n, mine, a.word, a.say, a.thought)", thenIdx) > thenIdx);
  assert.match(comp, /maxTokens: 12000/);
});

test("新挂点都是写死的字面量，并且登记在小游戏页", () => {
  const comp = g.slice(g.indexOf("function LingxiGame("), g.indexOf("function TetBoard("));
  const wk = [...comp.matchAll(/"data-wk": "([a-z]+)"/g)].map(m => m[1]).filter(k => k.indexOf("lingxi") === 0);
  wk.push(...[...comp.matchAll(/"(lingxi(?:send|end|chat|again))"/g)].map(m => m[1]));
  assert.doesNotMatch(comp, /"data-wk": [a-z]/, "data-wk 不许是变量");
  assert.ok(wk.length >= 8);
  const games = ts.slice(ts.indexOf('zh:"小游戏"'), ts.indexOf('zh:"小游戏"') + 60000);
  new Set(wk).forEach(k => assert.ok(games.indexOf('["' + k + '"') >= 0, k + " 没登记"));
});
