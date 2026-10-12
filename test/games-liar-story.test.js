// 她 2026-10-12：「先 1、2 吧」——小游戏加骗子骰和故事接龙
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const g = require("../js/games.js");
const src = fs.readFileSync(__dirname + "/../js/games.js", "utf8");
const seq = arr => { let i = 0; return () => arr[i++ % arr.length]; };
const P = n => Array.from({ length: n }, (_, i) => ({ key: i ? "c" + i : "user", name: i ? "角色" + i : "我", isUser: !i }));

test("骗子骰：叫价必须比上家大，点数只能叫 2~6", () => {
  assert.equal(g.liarLegalBid(null, { n: 2, f: 3 }, 10), true);
  assert.equal(g.liarLegalBid(null, { n: 2, f: 1 }, 10), false, "1 点万能，不能叫");
  assert.equal(g.liarLegalBid(null, { n: 11, f: 3 }, 10), false, "不能超过桌上总数");
  assert.equal(g.liarLegalBid({ n: 3, f: 4 }, { n: 3, f: 5 }, 10), true);
  assert.equal(g.liarLegalBid({ n: 3, f: 4 }, { n: 3, f: 4 }, 10), false);
  assert.equal(g.liarLegalBid({ n: 3, f: 4 }, { n: 3, f: 2 }, 10), false);
  assert.equal(g.liarLegalBid({ n: 3, f: 6 }, { n: 4, f: 2 }, 10), true);
  assert.equal(g.liarCount([1, 3, 3, 5, 1], 3), 4, "1 点算进去");
});

test("骗子骰：开了以后够数算开的人输、不够算叫的人输；命没了出局，剩一个就结束", () => {
  const s = g.liarNewGame(P(2), seq([0]));
  s.turn = 0;
  s.players[0].dice = [3, 3, 1, 2, 6]; s.players[1].dice = [3, 4, 4, 5, 6];
  g.liarAct(s, { kind: "bid", n: 4, f: 3 });
  assert.equal(s.turn, 1);
  g.liarAct(s, { kind: "open" });   // 桌上 3 有 3+1(万能)=4 个 → 够数，开的人（角色1）输
  assert.equal(s.players[1].lives, 2);
  assert.equal(s.reveal.got, 4);
  assert.throws(() => g.liarAct(s, { kind: "bid", n: 5, f: 3 }), /不是出手的时候/);
  g.liarNewRound(s, s.nextStarter);
  assert.equal(s.turn, 1, "输的人先叫");
  s.players[1].lives = 1; s.turn = 1;
  s.players[0].dice = [2, 2, 2, 2, 2]; s.players[1].dice = [5, 5, 5, 5, 5];
  g.liarAct(s, { kind: "bid", n: 9, f: 6 });
  g.liarAct(s, { kind: "open" });
  assert.equal(s.status, "finished");
  assert.equal(s.winner, "user");
});

test("骗子骰：不调模型的那一手永远合规", () => {
  for (let k = 0; k < 200; k++) {
    const s = g.liarNewGame(P(3));
    for (let step = 0; step < 6 && !s.reveal; step++) {
      const a = g.liarNpcMove(s, s.turn, 0);
      if (a.kind === "open" && !s.bid) assert.fail("还没人叫就开");
      g.liarAct(s, a);   // 不合规会抛
    }
  }
});

test("故事接龙：三圈写完收工，第一句是开头，没用上抽到的词也收但记一笔", () => {
  const s = g.storyNewGame(P(2), 3, seq([0]));
  assert.ok(s.opener && s.word);
  const w = s.word;
  g.storyAct(s, "user", "我在门口捡到一把" + w + "。");
  assert.equal(s.lines[0].used, true);
  assert.throws(() => g.storyAct(s, "user", "抢着写"), /还没轮到/);
  g.storyAct(s, "c1", "跟词没关系的一句。");
  assert.equal(s.lines[1].used, s.lines[1].text.indexOf(s.lines[1].word) >= 0);
  for (let i = 0; i < 4; i++) g.storyAct(s, s.players[s.turn].key, "又一句。");
  assert.equal(s.status, "finished");
  assert.equal(s.lines.length, 6);
  assert.ok(g.storyText(s).startsWith(s.opener));
});

test("架子、盒面、桌布、入口都接上了；故事接龙的战报不分输赢", () => {
  for (const k of ["liar", "story"]) {
    assert.match(src, new RegExp('\\{ key: "' + k + '", emoji:'));
    assert.match(src, new RegExp("\\n    " + k + ": +\\{ paper:"));
    assert.match(src, new RegExp("\\n    " + k + ": \\[\"#"));
    assert.match(src, new RegExp("\\n      " + k + ": \\["));
  }
  assert.match(src, /session\.game\.key === "liar"\) return h\(LiarDiceGame, engineProps\)/);
  assert.match(src, /session\.game\.key === "story"\) return h\(StoryChainGame, engineProps\)/);
  assert.match(src, /key: "story", zh: "故事接龙", ids: realCharIds\(state\.players\), wins: \[\], meWin: null/);
  assert.match(src, /game: o\.game \|\| "uno"/, "言秋亲打的票要写清是哪个游戏");
});
