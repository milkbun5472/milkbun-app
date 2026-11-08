import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const D = require("../js/stamp-duel.js");
// 桩照邮票册写卡那段的形状：id / charId / rarity / lv / kind / text{name,line,thought} / pokes{head,heart,hand}
const card = (i, charId, rarity, lv, kind) => ({ id: "c" + i, charId, rarity, lv, kind, text: { name: "卡" + i, line: "台词" + i, thought: "心声" + i }, pokes: rarity === "SSR" ? { head: ["h"], heart: ["赢了" + i], hand: ["疼" + i] } : undefined });
const mine = Array.from({ length: 20 }, (_, i) => card(i, i % 2 ? "a" : "b", ["R", "SR", "SSR"][i % 3], 1 + i * 2, i % 7 === 0 ? "bday" : ""));
const theirs = Array.from({ length: 6 }, (_, i) => card(100 + i, "b", "SR", 20));
test("同一张卡永远算出同一个数，等级越高越强", () => {
  assert.deepEqual(D.stampOf(mine[3]), D.stampOf(mine[3]));
  const lo = D.stampOf({ ...mine[2], lv: 1 }), hi = D.stampOf({ ...mine[2], lv: 50 });
  assert.ok(hi.pow > lo.pow && hi.maxHp > lo.maxHp);
  assert.equal(D.stampOf({ id: "x", rarity: "SSR" }).face, 3);
});
test("卡组随机从收藏里抽，不够数用通用票补；对面先拿自己的卡", () => {
  assert.equal(D.deckFrom(mine.slice(0, 3), 1).length, D.DECK_SIZE);
  const f = D.foeDeckFrom(mine.concat(theirs), "b", ["a"], 5);
  assert.equal(f.length, D.DECK_SIZE);
  assert.ok(f.every(s => s.charId === "b" || s.charId === "a"));
  assert.notDeepEqual(D.deckFrom(mine, 1).map(s => s.cardId), D.deckFrom(mine, 2).map(s => s.cardId));
});
test("对面的下一步开回合就亮出来，照着走", () => {
  const st = D.newDuel(D.deckFrom(mine, 3), D.foeDeckFrom(mine.concat(theirs), "b", ["a"], 3), 3);
  assert.ok(st.intent && Array.isArray(st.intent.place));
  const plan = st.intent.place.map(p => p.slot);
  D.endTurn(st);
  for (const s of plan) assert.ok(st.foe.board[s] || st.log.some(l => l.kind === "fall" && l.slot === s && l.who === "foe"));
});
test("贴票花面值、邮资不够贴不上、一回合只能撕一张", () => {
  const st = D.newDuel(D.deckFrom(mine, 9), D.deckFrom(mine, 10), 9);
  st.me.terrain = st.me.terrain.map(() => ""); st.events = [];
  const before = st.me.postage, s = st.me.hand[0];
  assert.ok(D.place(st, "me", 0, 4).ok);
  assert.equal(st.me.postage, before - s.face + (s.trait === "节俭" ? 1 : 0));
  assert.equal(D.place(st, "me", 0, 4).ok, false);
  assert.ok(D.tear(st, "me", 4).ok);
  D.place(st, "me", 0, 0);
  if (st.me.board[0]) assert.equal(D.tear(st, "me", 0).ok, false);
});
test("四方连：四张同一个人凑成 2×2 觉醒一次、打到信封", () => {
  const four = Array.from({ length: 12 }, (_, i) => card(200 + i, "z", "R", 1));
  const st = D.newDuel(D.deckFrom(four, 1), D.deckFrom(theirs, 1), 1);
  st.me.terrain = st.me.terrain.map(() => ""); st.events = [];
  st.me.postage = 9; st.me.hand = D.deckFrom(four, 2).slice(0, 4);
  const hp = st.foe.hp;
  [0, 1, 3, 4].forEach(s => D.place(st, "me", 0, s));
  assert.ok(st.log.some(l => l.kind === "wake"));
  assert.ok(st.foe.hp < hp);
  const n = st.log.filter(l => l.kind === "wake").length; D.tear(st, "me", 8); assert.equal(st.log.filter(l => l.kind === "wake").length, n);
});
test("整局能打完，有输赢；结束时给一句要不要记的话", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const st = D.newDuel(D.deckFrom(mine, seed), D.foeDeckFrom(mine.concat(theirs), "b", ["a"], seed), seed);
    let guard = 0;
    while (!st.over && guard++ < 50) {
      // 她这边：能贴就贴，从上往下
      for (let k = st.me.hand.length - 1; k >= 0; k--) { const free = st.me.board.findIndex(x => !x); if (free < 0) break; D.place(st, "me", k, free); }
      D.endTurn(st);
    }
    assert.ok(st.over, "seed " + seed);
    assert.ok(["me", "foe", "draw"].includes(st.over.winner));
    assert.match(D.memoryLine(st, "B", "她"), /打了一局对局/);
  }
});

const blank = st => { st.me.terrain = st.me.terrain.map(() => ""); st.foe.terrain = st.foe.terrain.map(() => ""); st.events = []; return st; };
test("票的作用跟卡上的字走：写拔刀的是投递、写撑伞的是火漆、写下雨的是邮戳", () => {
  assert.equal(D.stampOf({ id: "a", rarity: "R", text: { narration: "他拔刀挡在前面打了起来" } }).role, "投递");
  assert.equal(D.stampOf({ id: "b", rarity: "R", text: { narration: "他撑伞护着你，把外套披在你肩上" } }).role, "火漆");
  assert.equal(D.stampOf({ id: "c", rarity: "R", text: { narration: "雨夜里他喝醉了" } }).role, "邮戳");
  assert.ok(D.ROLES.includes(D.stampOf({ id: "d", rarity: "R", text: { name: "无" } }).role));
});
test("盖章：章攒满才能盖、花 1 邮资；挪票只能挪到旁边空格；留牌最多两张留到下回合", () => {
  const st = blank(D.newDuel(D.deckFrom(mine, 4), D.deckFrom(mine, 5), 4));
  st.me.postage = 9; D.place(st, "me", 0, 4);
  assert.equal(D.stamp(st, "me", 4).ok, false);
  st.me.board[4].charge = st.me.board[4].need; const pg = st.me.postage;
  assert.ok(D.stamp(st, "me", 4).ok); assert.equal(st.me.postage, pg - 1); assert.equal(st.me.board[4] ? st.me.board[4].charge : 0, 0);
  if (st.me.board[4]) { assert.equal(D.move(st, "me", 4, 0).ok, false); assert.ok(D.move(st, "me", 4, 1).ok); }
  const keepA = st.me.hand[0], keepB = st.me.hand[1];
  assert.ok(D.keep(st, "me", 0).ok); assert.ok(D.keep(st, "me", 1).ok); assert.equal(D.keep(st, "me", 2).ok, false);
  D.endTurn(st);
  if (!st.over) { assert.ok(st.me.hand.includes(keepA) && st.me.hand.includes(keepB)); }
});
test("前排挡着，后排挨不着；破损格贴不上", () => {
  const st = blank(D.newDuel(D.deckFrom(mine, 6), D.deckFrom(mine, 7), 6));
  st.foe.terrain[0] = "破损"; st.foe.postage = 9;
  assert.equal(D.place(st, "foe", 0, 0).ok, false);
  st.me.board[2] = Object.assign(D.stampOf(mine[1]), { uid: 99, hp: 99, maxHp: 99, shield: 0, marks: {}, charge: 0, role: "投递", pow: 5 });
  st.foe.board[8] = Object.assign(D.stampOf(mine[2]), { uid: 98, hp: 10, maxHp: 10, shield: 0, marks: {}, charge: 0, role: "补票" });
  st.foe.board[2] = Object.assign(D.stampOf(mine[3]), { uid: 97, hp: 50, maxHp: 50, shield: 0, marks: {}, charge: 0, role: "火漆" });
  st.intent = { place: [], stamp: [] };
  D.endTurn(st);
  assert.equal(st.foe.board[8] && st.foe.board[8].hp, 10);
});
test("邮局公告提前一回合预告；整版觉醒", () => {
  const st = D.newDuel(D.deckFrom(mine, 8), D.deckFrom(mine, 9), 8);
  assert.ok(st.events[3]);
  while (st.turn < 2 && !st.over) D.endTurn(st);
  if (!st.over) assert.equal(st.intent.nextEvent, st.events[3]);
  const row = Array.from({ length: 12 }, (_, i) => card(300 + i, "y", "R", 1));
  const s2 = blank(D.newDuel(D.deckFrom(row, 1), D.deckFrom(theirs, 1), 1));
  s2.me.postage = 9; s2.me.hand = D.deckFrom(row, 3).slice(0, 3);
  [6, 7, 8].forEach(x => D.place(s2, "me", 0, x));
  assert.ok(s2.log.some(l => l.kind === "wake" && l.combo === "整版"));
});
test("连打几把：一串结束才出一句总的；对局里不叫邮资叫胶水", () => {
  const sr = D.newSeries();
  for (let s = 1; s <= 3; s++) { const st = D.newDuel(D.deckFrom(mine, s), D.deckFrom(mine, s + 50), s); while (!st.over) D.endTurn(st); D.addGame(sr, st); }
  assert.equal(sr.games.length, 3);
  assert.match(D.memoryLine(sr, "B", "她"), /连打了 3 局对局，她 \d+ 胜 \d+ 负/);
  assert.ok(D.MARKS.受潮 && !D.MARKS.欠资);
});
test("放错了能撤回：胶水、手牌、信封都回去；寄出后就不能撤；撤回过对面照样照亮出来的那步走", () => {
  const st = D.newDuel(D.deckFrom(mine, 21), D.foeDeckFrom(mine.concat(theirs), "b", ["a"], 21), 21);
  st.me.terrain = st.me.terrain.map(() => "");
  const pg = st.me.postage, n = st.me.hand.length;
  assert.ok(D.place(st, "me", 0, 4).ok);
  assert.ok(D.canUndo(st));
  assert.ok(D.undo(st).ok);
  assert.equal(st.me.postage, pg); assert.equal(st.me.hand.length, n); assert.equal(st.me.board[4], null);
  assert.equal(D.undo(st).ok, false);
  assert.equal(D.place(st, "me", 0, 4).ok, true); D.undo(st);
  const plan = st.intent.place.map(p => p.slot);
  D.endTurn(st);
  assert.equal(D.canUndo(st), false);
  for (const s of plan) assert.ok(st.foe.board[s] || st.log.some(l => l.kind === "fall" && l.who === "foe"));
});
test("技能组：每张票有特质和章，同一张卡永远一样；人设定羁绊；带谁时三分之二从这几个人里抽", () => {
  const a = D.stampOf(mine[5]), b = D.stampOf(mine[5]);
  assert.equal(a.trait, b.trait); assert.equal(a.skill, b.skill);
  assert.ok(D.TRAITS[a.trait] && D.SKILLS[a.role][a.skill]);
  assert.equal(D.stampOf({ id: "w", rarity: "R", text: { narration: "他喝醉了酒" } }).trait, "醉意");
  assert.equal(D.bondOf("他护短又爱吃醋"), "护短");
  assert.equal(D.bondOf("普通人"), "默契");
  const deck = D.deckFrom(mine, 3, 12, ["a"]);
  assert.ok(deck.filter(s => s.charId === "a").length >= 8);
  const info = D.unitInfo(a, { [a.charId]: "好胜" });
  assert.ok(info.trait.desc && info.skill.desc && info.bond.zh === "好胜");
});
test("特质生效：锋利无视护盾、倔强留一口气", () => {
  const st = D.newDuel(D.deckFrom(mine, 30), D.deckFrom(mine, 31), 30);
  st.events = [];
  const mk = (o) => Object.assign(D.stampOf(mine[0]), { uid: Math.random(), hp: 10, maxHp: 10, shield: 0, marks: {}, charge: 0, first: false }, o);
  st.foe.board = Array(9).fill(null); st.me.board = Array(9).fill(null);
  st.me.board[0] = mk({ role: "投递", trait: "锋利", pow: 4 });
  st.foe.board[0] = mk({ role: "火漆", trait: "倔强", hp: 3, shield: 50, pow: 0 });
  st.intent = { place: [], stamp: [] };
  D.endTurn(st);
  assert.equal(st.foe.board[0] && st.foe.board[0].hp, 1);
});
test("护会散：每回合开头先掉一半，不会叠成打不动的墙", () => {
  const st = D.newDuel(D.deckFrom(mine, 40), D.deckFrom(mine, 41), 40);
  st.events = []; st.foe.board = Array(9).fill(null); st.me.board = Array(9).fill(null);
  st.foe.board[0] = Object.assign(D.stampOf(mine[0]), { uid: 7, hp: 99, maxHp: 99, shield: 20, marks: {}, charge: 0, role: "补票", trait: "治愈" });
  st.intent = { place: [], stamp: [] };
  D.endTurn(st);
  assert.ok(st.foe.board[0].shield <= 10);
});
test("对面照羁绊有打法；认不出字的特质照作用配；一把 40 血、最多 12 回合", () => {
  assert.equal(D.ENVELOPE_HP, 40); assert.equal(D.TURN_CAP, 12);
  const u = D.stampOf({ id: "zz", rarity: "R", text: { name: "无" } });
  assert.ok(D.TRAIT_FIT[u.role].includes(u.trait)); assert.equal(u.traitFrom, "");
  assert.match(D.unitInfo(D.stampOf({ id: "y", rarity: "R", text: { narration: "雨夜喝醉了酒" } })).trait.from, /从卡上的「/);
  const st = D.newDuel(D.deckFrom(mine, 50), D.deckFrom(mine, 51), 50, { bonds: { b: "冷淡" }, foeId: "b" });
  assert.equal(st.intent.style, "冷淡"); assert.ok(st.intent.place.length <= 2);
});
test("记下是哪张票动的手；让子、认真模式、快局", () => {
  const st = D.newDuel(D.deckFrom(mine, 60), D.deckFrom(mine, 61), 60, { meHp: 80, foeHp: 40, cap: 8, hard: true });
  assert.equal(st.me.max, 80); assert.equal(st.foe.hp, 40); assert.equal(st.cap, 8);
  while (!st.over) { for (let k = st.me.hand.length - 1; k >= 0; k--) { const f = st.me.board.findIndex((x, i) => !x && st.me.terrain[i] !== "破损"); if (f < 0) break; D.place(st, "me", k, f); } D.endTurn(st); }
  assert.ok(st.over.turn <= 8);
  assert.ok(st.log.some(l => (l.kind === "hit" || l.kind === "hitEnv") && l.from && l.from.name));
});
test("明牌虚线：aims 算出对面每张会出手的票打哪儿，previewPlace 算贴这儿会打谁、凑不凑组合，都不改棋盘", async () => {
  const D = globalThis.StampDuel || (await import("node:module")).createRequire(import.meta.url)("../js/stamp-duel.js");
  const mk = (r, c) => Array.from({ length: 12 }, (_, i) => Object.assign(D.stampOf({ id: c + i, rarity: "R", lv: 5, text: { name: "x" } }), { role: r, charId: c }));
  const st = D.newDuel(mk("投递", "a"), mk("投递", "b"), 3), before = JSON.stringify(st.foe.board) + JSON.stringify(st.me.board);
  const a = D.aims(st, "foe"); assert.ok(a.length > 0); a.forEach(x => assert.ok(x.kind === "env" || x.to >= 0));
  const pv = D.previewPlace(st, "me", 0, 4); assert.ok(pv && pv.aim && Array.isArray(pv.combo));
  assert.equal(JSON.stringify(st.foe.board) + JSON.stringify(st.me.board), before);
});
test("actsOf：两边每张上场的票都有一句这回合干什么", () => {
  const mk = (r, c) => Array.from({ length: 12 }, (_, i) => Object.assign(D.stampOf({ id: c + i, rarity: "R", lv: 5, text: { name: "x" } }), { role: r, charId: c }));
  const st = D.newDuel(mk("集邮", "a"), mk("投递", "b"), 5);
  const f = st.me.terrain.findIndex(t => !t); D.place(st, "me", 0, f);
  assert.match(D.actsOf(st, "me")[f], /^攒胶水·打/);
});
test("守城：十波、敌人往前走、前排站一回合就闯过去、守住或城破都会结束", () => {
  const cards = Array.from({ length: 30 }, (_, i) => ({ id: "c" + i, charId: ["a", "b"][i % 2], rarity: ["R", "R", "SR", "SSR"][i % 4], lv: 1 + i * 2, text: { name: "k" + i } }));
  let wins = 0, losses = 0;
  for (let n = 1; n <= 20; n++) {
    const st = D.newDuel(D.deckFrom(cards, n, D.DECK_SIZE, []), [], n, { siege: true });
    assert.equal(st.siege.waves, 10); assert.ok(st.foe.hand.length >= 1);
    while (!st.over) { for (let k = st.me.hand.length - 1; k >= 0; k--) { const f = [0, 1, 2, 3, 4, 5, 6, 7, 8].find(i => !st.me.board[i] && !st.me.terrain[i]); if (f != null) D.place(st, "me", k, f); } D.endTurn(st); assert.ok(st.turn <= st.cap); }
    if (st.over.winner === "me") wins++; else losses++;
    assert.ok(st.siege.cleared <= 10);
    assert.ok(st.log.some(l => /往前走/.test(l.text)));
  }
  assert.ok(wins > 0 && losses > 0, wins + "/" + losses);
});
test("专属信物：材料偏向定能挑的效果和档数，带进对局真的生效", () => {
  assert.deepEqual(D.keepFxOf(["旧邮票", "旧邮票", "TA 的东西"]), ["atk"]);
  assert.equal(D.keepTier(["旧邮票", "旧邮票", "TA 的东西"], "atk"), 3);
  assert.equal(D.keepTier(["旧邮票", "火漆块", "干花"], "def"), 1);
  const mk = c => Array.from({ length: 12 }, (_, i) => Object.assign(D.stampOf({ id: c + i, rarity: "R", lv: 5, text: { name: "x" } }), { role: "投递", charId: c }));
  const a = D.newDuel(mk("a"), mk("b"), 4, {}), b = D.newDuel(mk("a"), mk("b"), 4, { keeps: [{ fx: "env", v: 2 }, { fx: "glue", v: 1 }] });
  assert.equal(b.me.max, a.me.max + 10); assert.equal(b.me.postage, a.me.postage + 2);
  const d = D.matDrop(7, "boss", "雪国"); assert.ok(d.includes("TA 的东西") && d.length >= 3);
  const RN = require("../js/stamp-run.js"); assert.ok(RN.EVENTS.some(e => e.key === "trunk"));
});
test("讨伐：总局打不死、记伤害、封条只掉 1、邮戳撕开后虚弱翻倍、8 回合或无尽到信封空", () => {
  const cards = Array.from({ length: 30 }, (_, i) => ({ id: "c" + i, charId: "a", rarity: ["R", "R", "SR", "SSR"][i % 4], lv: 20, text: { name: "k" + i } }));
  for (const m of ["normal", "endless"]) {
    const st = D.newDuel(D.deckFrom(cards, 3, D.DECK_SIZE, []), [], 3, { raid: m });
    while (!st.over) { for (let k = st.me.hand.length - 1; k >= 0; k--) { const f = [6, 7, 8, 3, 4, 5, 0, 1, 2].find(i => !st.me.board[i] && !st.me.terrain[i]); if (f != null) D.place(st, "me", k, f); } D.endTurn(st); }
    assert.ok(st.raid.dealt > 0 && st.over.raid);
    if (m === "normal") assert.ok(st.turn <= D.RAID_TURNS);
  }
  const st = D.newDuel(D.deckFrom(cards, 5, D.DECK_SIZE, []), [], 5, { raid: "normal" });
  let sealed = 0; for (let t = 0; t < 6 && !st.over; t++) { sealed += st.foe.hand.filter(u => u.seal).length; D.endTurn(st); }
  assert.ok(sealed > 0);
});
