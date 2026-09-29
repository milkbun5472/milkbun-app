// 她 2026-09-29：「所有会自动调 api 的功能在设置里都要有开关；页面里也有开关的，两边要关联」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../js/auto-refresh-policy.js");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js");

test("新补的几样自动调用都在设置里有一栏", () => {
  const ids = P.FEATURES.map(f => f.id);
  ["gaze", "letter", "react", "groupChat", "watch", "proactive", "forum", "capsule"].forEach(id => assert.ok(ids.includes(id), id));
});

test("旧的页面开关一次性搬进来：主动私聊默认关、论坛不逛、情书自动、一起看", () => {
  const n = P.absorbLegacy(null, { chatSettings: { a: { proactive: true }, b: { proactive: false } }, forumOff: ["c"], letterCfg: { a: { auto: true }, b: {} }, watchAuto: false });
  assert.equal(P.enabled(n, "proactive", "a"), true);
  assert.equal(P.enabled(n, "proactive", "b"), false);
  assert.equal(P.enabled(n, "proactive", "zz"), false, "没设过的人照旧默认不主动");
  assert.equal(P.charOn(n, "forum", "c"), false);
  assert.equal(P.enabled(n, "letter", "a"), true);
  assert.equal(P.enabled(n, "letter", "b"), false);
  assert.equal(P.enabled(n, "watch"), false);
  // 只搬一次：搬完再给旧值也不动
  const again = P.absorbLegacy(n, { chatSettings: { b: { proactive: true } } });
  assert.equal(P.enabled(again, "proactive", "b"), false);
});

test("页面里打开一个人、总闸关着 → 总闸一起开", () => {
  const off = P.setGlobal(null, "letter", false);
  const n = P.turnOnFor(off, "letter", "a");
  assert.equal(P.enabled(n, "letter", "a"), true);
});

test("每个页面开关都读写同一格", () => {
  assert.match(app, /const toggleForumChar = charId => setAutoRefreshChar\("forum"/);
  assert.match(app, /const forumOff = Object\.keys\(autoRefreshPolicy\.features\.forum\.chars\)/);
  assert.match(app, /proactive: autoRefreshOn\("proactive", activeChar\.id\)/);
  assert.match(app, /setAutoFromPage\("proactive", activeChar\.id/);
  assert.match(app, /if \(!autoRefreshOn\("proactive", cid\)\) continue;/);
  assert.match(app, /if \(!autoRefreshOn\("letter", c\.id\)\) continue;/);
  assert.match(app, /auto: autoRefreshOn\("letter", c\.id\)/);
  assert.match(app, /autoChat: gsFor\(activeGroup\.id\)\.autoChat !== false && autoRefreshOn\("groupChat"\)/);
  assert.match(app, /!autoRefreshOn\("gaze", char\.id\)/);
  assert.match(R("js/watch.js"), /window\.__autoRefreshOn\("watch"\)/);
  assert.match(R("js/watch.js"), /window\.__setAutoFromPage\("watch", null, n\)/);
  assert.match(R("js/memo.js"), /\("react", id\)/);
  assert.match(R("js/ledger.js"), /\("react", id\)/);
  assert.match(R("js/capsule.js"), /__autoRefreshOn\("capsule", char\.id\)/);
});
