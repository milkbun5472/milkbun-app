// 她 2026-09-29 转来的群反馈：「刚刚给 c 点了外卖，聊天时候 c 说等拿到外卖了一定给我 repo，
//   意料之中没有发任何消息来」。约回只认「多久以后」，TA不知道骑手几点到；
//   而 app 知道——那一单自带 arriveTs。所以 after 只说等哪件事，时间照那一单换算。
// 同一轮：「我们说好的」那一页不止情侣能开——记忆库「未了」里选一个人就能进。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

// 桩照【写那一单的地方】：外卖卡和在途礼物，两个写入方的字面量先钉住
test("桩的字段照写入方：外卖卡、在途礼物", () => {
  assert.match(app, /pChat\(char\.id, p => \[\.\.\.p, \{ role: "user", kind: "takeout", takeout: item\.takeout, arriveTs: now \+ deliverMsForCat\("food", item\.name\), ts: now,/);
  assert.match(app, /\{ id: giftId, charId, name: itemName, arriveTs, cat: cat \|\| null \}/);
});

const mk = (chats, gifts) => {
  const i = app.indexOf("  const promiseAfterTs = (charId, kindIn) => {"), j = app.indexOf("\n  };\n", i);
  assert.ok(i > 0 && j > i, "抠不出 promiseAfterTs");
  const tbl = app.slice(app.indexOf("const PROMISE_AFTER = {"), app.indexOf("\n", app.indexOf("const PROMISE_AFTER_GRACE_MS")));
  return new Function("chatsRef", "giftOutRef", tbl + "\n" + app.slice(i, j + 5) + "\nreturn promiseAfterTs;")({ current: chats }, { current: gifts });
};

test("外卖：照那一单的到达时刻，外加一点拆开吃上的工夫", () => {
  const now = Date.now(), at = now + 25 * 60000;
  const f = mk({ c1: [{ role: "user", kind: "takeout", arriveTs: at, ts: now }] }, []);
  const due = f("c1", "takeout");
  assert.ok(due >= at && due <= at + 10 * 60000, "没照骑手到的那一刻算");
  assert.equal(f("c1", "外卖"), due, "中文叫法没认");
  assert.equal(f("c2", "takeout"), 0, "串到别人的外卖上了");
});

test("TA给她点的不算（role 是 assistant）；什么都没在路上＝0，退回按分钟", () => {
  const now = Date.now();
  const f = mk({ c1: [{ role: "assistant", kind: "takeout", arriveTs: now + 60000, ts: now }] }, []);
  assert.equal(f("c1", "takeout"), 0);
  assert.equal(f("c1", "什么"), 0, "认不出的叫法也换算了");
});

test("礼物：在途礼物表里这个人的那一件；已经到了就照现在算", () => {
  const now = Date.now();
  const f = mk({}, [{ id: "g1", charId: "c1", name: "围巾", arriveTs: now - 60000 }]);
  const due = f("c1", "gift");
  assert.ok(due > now && due < now + 10 * 60000);
});

test("落账那一处：有 after 时不必有分钟；还是只落成一个 dueTs，走原来那条约回链", () => {
  assert.match(app, /const after = lp && promiseAfterTs\(charId, lp\.after\);/);
  assert.match(app, /if \(lp && \(after \|\| \(mins >= PROMISE_MIN_MINUTES && mins <= PROMISE_MAX_MINUTES\)\)\) \{\n\s*const due = after \|\| Date\.now\(\) \+ mins \* 60000;/);
  assert.match(app, /"after":"takeout\|gift（等一件事时才填）"/);
});

test("「我们说好的」：记忆库「未了」里选一个人就能进，而且就是情侣空间那一页", () => {
  assert.match(screens, /if \(pactChar && pactsOf\) return h\(CouplePacts, \{ partner: pactChar, pacts: pactsOf\(pactChar\.id\),/);
  assert.match(screens, /statusFilter === "open" && personKey && pactsOf \? h\("button", \{ onClick: \(\) => setPactsFor\(personKey\)/);
  assert.match(app, /pactsOf: pactsFor, onClosePact: closePact, onSetPactDue: setPactDue, onAddPact: addPact,/);
  // 只有一份 CouplePacts
  assert.equal((screens.match(/function CouplePacts\(/g) || []).length, 1);
});
