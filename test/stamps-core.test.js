// 邮票册（2026-10-26 方案）：价格、保底、生日池、等级、上线礼、互动记账
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

function fresh() {
  let store = null;
  const listeners = {};
  global.window = global;
  global.loadJSON = () => store;
  global.saveJSON = (k, v) => { store = JSON.parse(JSON.stringify(v)); };
  global.addEventListener = (n, f) => { (listeners[n] = listeners[n] || []).push(f); };
  global.dispatchEvent = e => { (listeners[e.type] || []).forEach(f => f(e)); return true; };
  global.CustomEvent = class { constructor(type, o) { this.type = type; this.detail = o && o.detail; } };
  delete require.cache[path.resolve(__dirname, "../js/stamps-core.js")];
  require("../js/stamps-core.js");
  return global.StampsCore;
}

test("60 抽必出 SSR，每十抽至少一张 SR", () => {
  const C = fresh(), st = C.load();
  let since = 0, sinceSR = 0, worst = 0, worstSR = 0;
  for (let i = 0; i < 5000; i++) {
    const r = C.rollRarity(st, null, () => 0.99);   // 运气最差
    since++; sinceSR++;
    if (r === "SSR") { worst = Math.max(worst, since); since = 0; sinceSR = 0; }
    if (r === "SR") { worstSR = Math.max(worstSR, sinceSR); sinceSR = 0; }
  }
  assert.ok(worst <= C.HARD_AT, "保底没兜住：" + worst);
  assert.ok(worstSR <= C.SR_EVERY);
});

test("生日池保底单独算，不动共用的那份", () => {
  const C = fresh(), st = C.load();
  for (let i = 0; i < 10; i++) C.rollRarity(st, { bday: "c1", isDay: false }, () => 0.99);
  assert.equal(st.pulls, 0);
  assert.equal(st.bday.c1.since, 10);
  let n = 10; while (C.rollRarity(st, { bday: "c1" }, () => 0.99) !== "SSR") n++;
  assert.equal(n + 1, C.BDAY.hard);
});

test("一张卡升满的印泥正好是定好的数（误差 2%）", () => {
  const C = fresh();
  for (const r of ["R", "SR", "SSR"]) {
    let s = 0; for (let l = 1; l < C.CAP[r]; l++) s += C.levelCost(r, l);
    assert.ok(Math.abs(s - C.FULL_COST[r]) / C.FULL_COST[r] < 0.02, r + " " + s);
  }
});

test("上线礼只给一次；限时主题上新送一张十连券", () => {
  const C = fresh();
  const t = Date.parse("2026-10-27T12:00:00+08:00");
  const got = C.grantOnOpen(t, []);
  assert.equal(got.length, 2);
  const st = C.load();
  assert.equal(st.tickets, C.GIFT.tickets + 1);
  assert.equal(st.ink, C.GIFT.ink);
  assert.equal(C.grantOnOpen(t, []).length, 0);
  assert.equal(C.activeLimited(Date.parse("2026-11-15T00:00:01+08:00")).length, 0, "万圣夜 11-15 0 点下架");
});

test("互动记账：一轮 5、线下 10；callAI 广播的按用途分档，聊天不重记", () => {
  const C = fresh();
  C.gain("round"); C.gain("beat");
  let st = C.load(); assert.equal(st.postage, 15); assert.equal(st.ink, 15);
  dispatchEvent(new CustomEvent("ai-ok", { detail: { use: "chat", label: "", tag: "" } }));
  dispatchEvent(new CustomEvent("ai-ok", { detail: { use: "", label: "论坛回帖", tag: "" } }));
  dispatchEvent(new CustomEvent("ai-ok", { detail: { use: "", label: "", tag: "tarot" } }));
  st = C.load(); assert.equal(st.postage, 15 + 10 + 5); assert.equal(st.ink, 15 + 10 + 10);
});

test("生日池窗口：生日前 14 天到生日后 7 天", () => {
  const C = fresh();
  const y = new Date().getFullYear();
  const day = new Date(y, 5, 20).getTime();
  assert.ok(C.bdayWindow("06-20", day - 13 * 86400000));
  assert.equal(C.bdayWindow("06-20", day - 15 * 86400000), null);
  assert.ok(C.bdayWindow("06-20", day + 7 * 86400000));
  assert.ok(C.bdayWindow("06-20", day + 3600000).isDay);
});
