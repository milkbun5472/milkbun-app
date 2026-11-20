// 频道里一起摆弄的小东西（她 2026-11-20「1-7都可以做」）＋顶上压成一行（她截图「顶上太高把聊天挤没了」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(en.slice(en.indexOf("const CHP_EMOJI"), en.indexOf("// 一轮里好几个人改同一份")) + ";this.X={chpNorm,chpCount,chpBump,chpFindMsg,chpReactMsg,chpPin,chpUnpin,chpNoteAdd,chpScribble,chpTear,chpTearOk,chpSongAdd,chpSkipVote,chpSkipDue,chpLedgerAdd,chpBalances,chpSettle,chpPetNow,chpCare,chpHint,CHP_CAP};", ctx);
const X = ctx.X;
test("表情回应：再点同一个就是收回；找句子只找最近、逐字", () => {
  const ms = [{ content: "今晚吃火锅", ts: 1 }, { content: "好啊", ts: 2 }];
  assert.equal(X.chpFindMsg(ms, "火锅", 20), 0);
  assert.equal(X.chpFindMsg(ms, "烧烤", 20), -1);
  let m = X.chpReactMsg(ms[0], "a", "😂"); assert.equal(m.reacts.a, "😂");
  m = X.chpReactMsg(m, "a", "😂"); assert.equal(m.reacts.a, undefined);
});
test("置顶最多三条；便利贴撕自己的或贴了一天以上的；每天计数换天清零", () => {
  let s = X.chpNorm(null, "d1");
  for (let i = 1; i <= 4; i++) X.chpPin(s, { content: "第" + i, ts: i }, "me");
  assert.equal(s.pins.length, X.CHP_CAP.pins); assert.equal(s.pins[0].text, "第2");
  X.chpNoteAdd(s, "买牛奶", "a"); const n = s.notes[0];
  assert.equal(X.chpTearOk(n, "b", n.ts + 1000), false);
  assert.equal(X.chpTearOk(n, "b", n.ts + 2 * 86400000), true);
  X.chpScribble(s, "牛奶", "我也要", "b"); assert.equal(s.notes[0].doodles[0].text, "我也要");
  X.chpBump(s, "note"); assert.equal(X.chpCount(s, "note"), 1);
  s = X.chpNorm(s, "d2"); assert.equal(X.chpCount(s, "note"), 0);
});
test("小账本：均摊、两两相抵、结清", () => {
  let s = X.chpNorm(null, "d");
  X.chpLedgerAdd(s, { payer: "a", amount: 30, among: ["a", "b", "c"] });
  X.chpLedgerAdd(s, { payer: "b", amount: 10, among: ["a", "b"] });
  const bal = X.chpBalances(s.ledger);
  assert.deepEqual(bal.find(x => x.from === "b" && x.to === "a").amount, 5);
  assert.equal(bal.find(x => x.from === "c").amount, 10);
  X.chpSettle(s, "c", "a"); assert.equal(X.chpBalances(s.ledger).some(x => x.from === "c"), false);
});
test("歌单切歌过半才提醒；养的东西会掉、照顾会回来", () => {
  let s = X.chpNorm(null, "d"); X.chpSongAdd(s, "晴天", "周杰伦", "a"); X.chpSkipVote(s, "晴天", "a");
  assert.equal(X.chpSkipDue(s.playlist[0], 3), false); X.chpSkipVote(s, "晴天", "b"); assert.equal(X.chpSkipDue(s.playlist[0], 3), true);
  const pet = { name: "小绿", full: 80, ts: 0 };
  assert.equal(X.chpPetNow(pet, 10 * 3600000).full, 40);
  assert.equal(X.chpCare(pet, "浇水", "a", 10 * 3600000).full, 80);
});
test("接线：回复里的字段落地、提示词带着摆着的东西；顶上压成一行，公告、置顶、在听都收成小签", () => {
  assert.match(ap, /gAtHint \+ gListenHint \+ gPlayHint \+/);
  assert.match(ap, /item\.react \|\| item\.rename \|\| item\.pin/);
  assert.match(ap, /h\(ChannelTopRow, \{ onTab: setChannelTab/);
  assert.match(cs, /function ChannelTopRow\(/);
  assert.match(cs, /"data-wk": "chtabs", className: "shrink-0 flex items-end", style: \{ gap: 2, height: 38/);
  assert.match(cs, /!channelTabs && gs\.notice && String/);
  assert.doesNotMatch(ap, /h\(ChannelListenBar, \{/);
  assert.match(ap, /onReact: activeGroup\.spaceId && !groupSpectating\(activeGroup\)/);
});
test("歌单能从她的歌库挑、点「放这首」走播放器、「让他们各挑一首」回聊天跑一轮", () => {
  const fs = require("fs"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  assert.match(cs, /"data-wk": "chsonglib"/);
  assert.match(cs, /"data-wk": "chsongask"/);
  assert.match(ap, /onAskSongs: groupSpectating\(_g\) \? null : \(\) => \{ window\.__chAskSongs = _g\.id; setChannelTab\("chat"\); replyGroup\(_g\.id\); \}/);
  assert.match(ap, /if \(window\.__chAskSongs === groupId\) \{ window\.__chAskSongs = null;/);
});
test("歌单一天十首；小家伙能先不起名，让大家定一个", () => {
  const fs = require("fs"), en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
  assert.match(en, /const CHP_CAP = \{ rename: 1, note: 4, song: 10, pins: 3 \};/);
  assert.match(ap, /if \(item\.petName && _st\.pet && _st\.pet\.naming\)/);
  assert.match(ap, /onAskPetName: groupSpectating\(_g\) \? null :/);
});
