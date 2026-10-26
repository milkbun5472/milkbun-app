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

test("一张卡升满的印泥正好是定好的数（误差 3%，便宜的卡每级取整多出一点）", () => {
  const C = fresh();
  for (const r of ["R", "SR", "SSR"]) {
    let s = 0; for (let l = 1; l < C.CAP[r]; l++) s += C.levelCost(r, l);
    assert.ok(Math.abs(s - C.FULL_COST[r]) / C.FULL_COST[r] < 0.03, r + " " + s);
  }
});

test("上线礼只给一次；限时主题上新送一张十连券", () => {
  const C = fresh();
  const t = Date.parse("2026-10-27T12:00:00+08:00");
  const got = C.grantOnOpen(t, []);
  assert.equal(got.length, 2, "开幕礼、万圣夜");
  const st = C.load();
  assert.equal(st.tickets, C.GIFT.tickets + 1);
  assert.equal(st.ink, C.GIFT.ink);
  assert.equal(C.grantOnOpen(t, []).length, 0);
  const after = C.activeLimited(Date.parse("2026-11-15T00:00:01+08:00")).map(L => L.id);
  assert.ok(!after.includes("halloween26"), "万圣夜 11-15 0 点下架");
  assert.ok(after.includes("lateautumn26"), "深秋接着上");
});

test("互动记账：一轮 5、线下 10；callAI 广播的按用途分档，聊天不重记", () => {
  const C = fresh();
  C.gain("round"); C.gain("beat");
  let st = C.load(); assert.equal(st.postage, 60); assert.equal(st.ink, 60);
  dispatchEvent(new CustomEvent("ai-ok", { detail: { use: "chat", label: "", tag: "" } }));
  dispatchEvent(new CustomEvent("ai-ok", { detail: { use: "", label: "论坛回帖", tag: "" } }));
  dispatchEvent(new CustomEvent("ai-ok", { detail: { use: "", label: "", tag: "tarot" } }));
  st = C.load(); assert.equal(st.postage, 60 + 40 + 20); assert.equal(st.ink, 60 + 40 + 40);
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

test("盖印升级：扣印泥，30 级那一坎没发给他看过就停住", () => {
  const C = fresh(), st = C.load();
  st.ink = 100000; st.cards = [{ id: "a", rarity: "SR", lv: 1 }]; C.save(st);
  let r = C.levelUp("a", 100);
  assert.equal(r.lv, 30); assert.ok(r.msg);
  const s2 = C.load(); s2.cards[0].sentTs = 1; C.save(s2);
  r = C.levelUp("a", 100);
  assert.equal(r.lv, C.CAP.SR);
  const s3 = C.load(); s3.ink = 0; s3.cards = [{ id: "b", rarity: "R", lv: 1 }]; C.save(s3);
  assert.equal(C.levelUp("b", 1).n, 0);
});

test("生日池求情：20 抽没出才能求，求了下一张一定是 SSR，一个生日只能求一次", () => {
  const C = fresh(), st = C.load();
  for (let i = 0; i < 19; i++) C.rollRarity(st, { bday: "c1_2026" }, () => 0.99);
  assert.equal(C.canBeg(st, "c1_2026"), false);
  C.rollRarity(st, { bday: "c1_2026" }, () => 0.99);
  assert.equal(C.canBeg(st, "c1_2026"), true);
  C.save(st); C.markBeg("c1_2026");
  const s2 = C.load();
  assert.equal(C.rollRarity(s2, { bday: "c1_2026" }, () => 0.99), "SSR");
  assert.equal(C.canBeg(s2, "c1_2026"), false);
});

test("测试券开着时盖印不扣印泥", () => {
  const C = fresh(), st = C.load();
  st.ink = 0; st.opt = { testInf: true }; st.cards = [{ id: "a", rarity: "R", lv: 1, sentTs: 1 }]; C.save(st);
  assert.equal(C.levelUp("a", 100).lv, C.CAP.R);
  assert.equal(C.load().ink, 0);
});

test("限定 SSR 重复折的印泥是定好的数", () => { const C = fresh(); assert.equal(C.DUPE_INK, 500); });

test("写回来的卡去掉 (R)/(SR) 占位、R 卡不留 SR 的栏", () => {
  const C = fresh();
  const t = C.cleanText({ name: "南瓜灯", narration: "(R)万圣节当晚", thought: "（R）都多大了", line: "(SR)胡闹。", before: { narration: "(R)前面" } }, "R");
  assert.equal(t.narration, "万圣节当晚"); assert.equal(t.thought, "都多大了"); assert.equal(t.line, undefined); assert.equal(t.before.narration, "前面");
  const s = C.cleanText({ name: "x", sections: [{ beats: [{ text: "(SSR)嗯" }] }] }, "SSR");
  assert.equal(s.sections[0].beats[0].text, "嗯");
});

test("老用户补发两张十连券只一次；聊天里那封今天的信只能领一次；单抽先用单抽券", () => {
  const C = fresh(); const st = C.load(); st.gifted = true; C.save(st);
  const d1 = Date.parse("2026-10-27T09:00:00+08:00");
  C.grantOnOpen(d1, []); let s = C.load(); assert.equal(s.tickets, 2 + 1);
  C.grantOnOpen(d1 + 86400000, []); s = C.load(); assert.equal(s.tickets, 3);
  assert.equal(C.claimLetter("sl_a"), true); assert.equal(C.claimLetter("sl_a"), false);
  s = C.load(); assert.equal(s.singles, 1); assert.equal(C.letterClaimed("sl_a"), true);
  assert.equal(C.pay(s, 1, false), "single"); assert.equal(s.singles, 0);
});

test("十连没券时单抽券顶上：9 张一个十连，不够的拿邮资补", () => {
  const C = fresh(); const st = C.load();
  st.singles = 9; st.postage = 0; assert.equal(C.pay(st, 10, true), "singles"); assert.equal(st.singles, 0);
  st.singles = 4; st.postage = 500; assert.equal(C.pay(st, 10, true), "singles"); assert.equal(st.singles, 0); assert.equal(st.postage, 0);
  st.singles = 4; st.postage = 100; assert.equal(C.pay(st, 10, true), null);
});

test("限时池上新按人数送十连：每两人一张，1～5 张", () => {
  const t0 = Date.parse("2026-10-27T12:00:00+08:00");
  for (const [n, want] of [[1, 1], [2, 1], [3, 2], [10, 5], [20, 5]]) {
    const C = fresh(); const st = C.load(); st.gifted = true; st.seenLimited = { postage26: 1 }; C.save(st);
    C.grantOnOpen(t0, [], n); assert.equal(C.load().tickets, want, n + " 人");
  }
});

test("日历：深秋 11-30 底下架、温泉 12-01 上、12-15 底下架", () => {
  const C = fresh(); const ids = t => C.activeLimited(Date.parse(t)).map(L => L.id);
  assert.deepEqual(ids("2026-11-30T23:59:00+08:00"), ["lateautumn26"]);
  assert.deepEqual(ids("2026-12-01T00:00:01+08:00"), ["onsen26"]);
  assert.deepEqual(ids("2026-12-16T00:00:01+08:00"), []);
});

test("你的生日池送十张生日券（只在那个池用），他的生日池送一张十连", () => {
  const C = fresh(); const st = C.load(); st.gifted = true; st.seenLimited = { postage26: 1, halloween26: 1, halloween26_top: 1 }; C.save(st);
  C.grantOnOpen(Date.parse("2026-10-27T12:00:00+08:00"), [{ id: "me_main", name: "你", year: 2026 }, { id: "c1", name: "他", year: 2026 }]);
  const s = C.load(); assert.equal(s.tickets, 1); assert.equal(s.bdTickets["me_main_2026"], 10);
  assert.equal(C.pay(s, 10, true, "me_main_2026"), "bdticket"); assert.equal(s.bdTickets["me_main_2026"], 9);
});

test("改版前只领过一张的你的生日池，补到十张", () => {
  const C = fresh(); const st = C.load(); st.gifted = true; st.seenLimited = { postage26: 1, halloween26: 1, halloween26_top: 1, bd_me_main_2026: 1 }; C.save(st);
  C.grantOnOpen(Date.parse("2026-10-27T12:00:00+08:00"), [{ id: "me_main", name: "你", year: 2026 }]);
  assert.equal(C.load().bdTickets["me_main_2026"], 9);
  C.grantOnOpen(Date.parse("2026-10-27T13:00:00+08:00"), [{ id: "me_main", name: "你", year: 2026 }]);
  assert.equal(C.load().bdTickets["me_main_2026"], 9);
});
