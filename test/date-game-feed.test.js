// 她 2026-10-14：「约会节奏和气泡显示有点不对」——TA 对这一站的反应排在小票前面；整场的话挤在一个小框里
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../js/date-game-core.js");
const fs = require("fs");
test("话和小票按发生先后排成一条；旧存档没有先后号时，同一站话在前、小票在后", () => {
  const s = { talk: [{ who: "user", text: "a", round: 1, n: 1 }, { who: "char", text: "b", round: 1, n: 3 }], events: [{ place: "cafe", text: "e", round: 1, n: 2 }] };
  assert.deepEqual(C.feed(s).map(f => f.kind + ":" + (f.item.text)), ["talk:a", "event:e", "talk:b"]);
  const old = { talk: [{ who: "user", text: "a", round: 1 }, { who: "char", text: "b", round: 2 }], events: [{ place: "cafe", text: "e", round: 1 }] };
  assert.deepEqual(C.feed(old).map(f => f.item.text), ["a", "e", "b"]);
});
test("约会页用这条时间线、跟着整页滚；TA 一句拆成几个气泡", () => {
  const src = fs.readFileSync(__dirname + "/../js/date-game.js", "utf8");
  assert.match(src, /C\.feed\(s\)\.forEach/);
  assert.match(src, /maxHeight: "none", k: "date"/);
  assert.match(src, /split\(\/\\n\+\/\)/);
  const g = fs.readFileSync(__dirname + "/../js/games.js", "utf8");
  assert.match(g, /if \(l\.node\) return h\("div"/, "公共气泡里夹卡片那一口");
});
