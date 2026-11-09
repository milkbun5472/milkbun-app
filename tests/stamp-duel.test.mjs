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
  assert.ok(D.MARKS.延误 && !D.MARKS.欠资 && !D.MARKS.挂号);
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
test("戳多了四种、护封格挡所有戳：折角多掉、撕口掉血、封口盖不了章", () => {
  ["折角", "撕口", "封口", "延误"].forEach(k => assert.ok(D.MARKS[k], k));
  assert.ok(D.TERRAIN.护封 && !D.TERRAIN.雨棚);
  const mk = c => Array.from({ length: 12 }, (_, i) => Object.assign(D.stampOf({ id: c + i, rarity: "R", lv: 5, text: { name: "x" } }), { role: "火漆", charId: c }));
  const st = D.newDuel(mk("a"), mk("b"), 4, {}); const f = st.me.terrain.findIndex(t => !t); D.place(st, "me", 0, f);
  const u = st.me.board[f]; u.charge = u.need; u.marks.封口 = 2; st.me.postage = 5;
  assert.equal(D.stamp(st, "me", f).ok, false);
});
test("封缄令：难度条生效、分数加总、限 8 回合打不完算输", () => {
  const cards = Array.from({ length: 30 }, (_, i) => ({ id: "c" + i, charId: "a", rarity: "R", lv: 25, text: { name: "k" + i } }));
  const a = D.newDuel(D.deckFrom(cards, 2, 12, []), D.edictDeck(2), 2, { edict: [], fair: false });
  const b = D.newDuel(D.deckFrom(cards, 2, 12, []), D.edictDeck(2), 2, { edict: ["meEnv", "meGlue", "short", "noTear"], fair: false });
  assert.equal(b.edictPts, 2 + 3 + 2 + 1); assert.equal(b.me.hp, a.me.hp - 15); assert.equal(b.me.postage, a.me.postage - 1); assert.equal(b.cap, 8);
  const f = b.me.terrain.findIndex(t => !t); D.place(b, "me", 0, f); assert.equal(D.tear(b, "me", f).ok, false);
});
test("技能调整：厚封改名、盖一张也打人、加盖和转寄、冷静戳只挂一回合；票的几样各自单独哈希", () => {
  assert.ok(D.SKILLS.火漆.厚封 && !D.SKILLS.火漆.封口);
  assert.ok(D.SKILLS.邮戳.加盖 && D.SKILLS.补票.转寄);
  assert.match(D.SKILLS.邮戳.盖一张, /两倍/);
  assert.equal(D.TRAITS.冷静.desc, "被盖的戳只挂一回合");
  const c = {}; for (let i = 0; i < 800; i++) { const s = D.stampOf({ id: "st_" + i.toString(36) + "_ab" + (i * 7919).toString(36), rarity: "R", lv: 5, text: { name: "x" } }); c[s.skill] = (c[s.skill] || 0) + 1; }
  assert.ok(Object.keys(c).length >= 20, Object.keys(c).length);
});
test("邮局值班：买票扣钱、同一张两份合成＋、凑三张加攻击、卖掉退一半、三条命或满八轮结束", () => {
  const cards = [{ id: "x1", charId: "a", rarity: "R", lv: 10, text: { name: "x" } }];
  const sh = D.shiftNew(5); D.shiftRoll(sh, cards);
  assert.equal(sh.shop.length, 1); const c0 = sh.coins;
  assert.ok(D.shiftBuy(sh, 0).ok); assert.equal(sh.coins, c0 - 2); assert.equal(sh.bench.length, 1);
  D.shiftRoll(sh, cards); const r = D.shiftBuy(sh, 0); assert.ok(r.merged); assert.equal(sh.bench.length, 1); assert.equal(sh.bench[0].plus, 1);
  sh.bench.push(Object.assign({}, sh.bench[0], { cardId: "y" }), Object.assign({}, sh.bench[0], { cardId: "z" }));
  assert.equal(D.shiftDeck(sh)[0].pow, sh.bench[0].pow + 1);
  const back = D.shiftSell(sh, 2); assert.ok(back >= 1);
  for (let i = 0; i < 3; i++) D.shiftAfter(sh, false); assert.equal(sh.done.win, false);
  const s2 = D.shiftNew(1); for (let i = 0; i < 8; i++) D.shiftAfter(s2, true); assert.equal(s2.done.win, true);
});
test("邮区巡查：每人每周一张图、只能走挨着的、翻开四周、打输败退不结束、打倒巡查长结束", () => {
  const deck = D.deckFrom([{ id: "a", charId: "a", rarity: "R", lv: 10, text: { name: "x" } }], 1, 12, []);
  const now = new Date(2026, 10, 8), sig = p => p.cells.map(c => c.type).join(",");
  assert.equal(sig(D.patrolNew(deck, now, 5)), sig(D.patrolNew(deck, now, 5)));
  assert.notEqual(sig(D.patrolNew(deck, now, 5)), sig(D.patrolNew(deck, now, 6)));
  const p = D.patrolNew(deck, now, 5);
  assert.equal(D.patrolCan(p, 0, 0), false); assert.equal(D.patrolCan(p, 3, 2), true);
  assert.ok(p.cells[3 * 5 + 2].open);
  p.pos = [0, 0]; p.cells[0].type = "fight"; D.patrolAfter(p, "fight", false, 0);
  assert.ok(!p.done && p.hp === 1 && p.steps === 12);
  D.patrolAfter(p, "boss", true, 20); assert.equal(p.done.why, "boss");
});
test("巡查 TA 的格子：挑了陪打的人才放 3 个；包裹、等你、明信片／小剧场／回忆先给分再问要不要听", () => {
  const deck = D.deckFrom([{ id: "a", charId: "a", rarity: "R", lv: 10, text: { name: "x" } }], 1, 12, []), now = new Date(2026, 10, 8);
  assert.equal(D.patrolNew(deck, now, 9, false).cells.filter(c => D.TA_CELLS[c.type]).length, 0);
  const p = D.patrolNew(deck, now, 9, true); assert.equal(p.cells.filter(c => D.TA_CELLS[c.type]).length, 3);
  p.cells[3 * 5 + 2].type = "tmemory"; const s0 = p.score, r = D.patrolMove(p, 3, 2);
  assert.ok(r.ask); assert.equal(p.score, s0 + D.TA_PTS.tmemory);
  p.cells[2 * 5 + 2].type = "twait"; const st0 = p.steps; D.patrolMove(p, 2, 2); assert.equal(p.steps, st0 - 1 + 2);
});
test("残局：30 关都有解、最优那一手能一回合打空、随手的放法不够、同一关名字不重", () => {
  for (let lv = 1; lv <= D.PUZZLE_MAX; lv++) {
    const st = D.puzzleOf(lv); assert.ok(st, "lv" + lv);
    const names = [...st.me.hand, ...st.me.board, ...st.foe.board].filter(Boolean).map(u => u.name);
    assert.equal(new Set(names).size, names.length);
    const pl = st.puzzle.plan; pl.stamps.forEach(i => D.stamp(st, "me", i));
    pl.place.forEach(p => { const k = st.me.hand.findIndex(u => u.cardId === p.cardId); D.place(st, "me", k, p.slot); });
    D.endTurn(st); assert.equal(st.over.winner, "me", "lv" + lv);
  }
  const a = D.puzzleOf(7), b = D.puzzleOf(7); assert.equal(JSON.stringify(a.me.hand.map(u => u.name)), JSON.stringify(b.me.hand.map(u => u.name)));
});
test("残局 30 关以后接着出、每日残局按各人随机数不同；接力 TA 那回合按性子自己贴票", () => {
  const a = D.puzzleOf(45), b = D.puzzleOf(45, 7), c = D.puzzleOf(45, 8);
  assert.ok(a && b && c); assert.notEqual(JSON.stringify(b.me.hand.map(u => u.name)), JSON.stringify(c.me.hand.map(u => u.name)));
  const cards = Array.from({ length: 20 }, (_, i) => ({ id: "c" + i, charId: "a", rarity: "R", lv: 10, text: { name: "k" + i } }));
  const st = D.newDuel(D.deckFrom(cards, 1, 12, ["a"]), D.edictDeck(1), 1, {});
  const acts = D.autoMe(st, "冷淡"); assert.ok(acts.filter(x => x.place != null).length <= 2);
});
test("邮局小店：排的岗越多、擅长、装修，收入倍数越高；客人里有难缠的、没上班的角色会来", () => {
  const per = id => id === "a" ? "她很温柔，总是笑" : "";
  const shop = { day: 3, decor: [] };
  assert.ok(D.shopMul(shop, { 柜台: "a" }, per) > D.shopMul(shop, { 柜台: "b" }, per));
  assert.ok(D.shopMul({ day: 1, decor: ["旧木招牌"] }, {}, per) > D.shopMul({ day: 1, decor: [] }, {}, per));
  let tough = 0, vis = 0; for (let d = 1; d <= 30; d++) { const cs = D.shopCustomers({ day: d, decor: [] }, ["x", "y"], 7); tough += cs.filter(c => c.tough).length; vis += cs.filter(c => c.visitor).length; }
  assert.ok(tough > 0 && vis > 0);
});
test("小店接上卡：橱窗按稀有度加收入、信格多两格、工牌加成、点名要某人明信片的客人", () => {
  const cards = { a: { id: "a", rarity: "SSR", lv: 30, charId: "x" }, b: { id: "b", rarity: "R", lv: 1, charId: "y" } }, cardOf = id => cards[id];
  const per = () => "";
  assert.ok(D.shopMul({ decor: [], window: ["a"] }, {}, per, cardOf) > D.shopMul({ decor: [], window: ["b"] }, {}, per, cardOf));
  assert.equal(D.shopWinSlots({ decor: ["整面墙的信格"] }), 5);
  assert.ok(D.shopMul({ decor: [], badge: { 柜台: "a" } }, { 柜台: "x" }, per) > D.shopMul({ decor: [] }, { 柜台: "x" }, per));
  let named = 0; for (let d = 1; d <= 10; d++) named += D.shopCustomers({ day: d, decor: [] }, [], 3, ["x", "y"], "上午").filter(c => c.wantChar).length; assert.ok(named > 0);
});
test("小店装修：每月两样限定、买过的能翻新到三级、翻新加成更多", () => {
  for (let m = 1; m <= 12; m++) assert.equal(D.SHOP.MONTHLY[m].length, 2);
  const per = () => "", s1 = { decor: ["暖黄的吊灯"], decorLv: {} }, s2 = { decor: ["暖黄的吊灯"], decorLv: { 暖黄的吊灯: 3 } };
  assert.ok(D.shopMul(s2, {}, per) > D.shopMul(s1, {}, per));
  assert.equal(D.shopUpPrice(s1, "暖黄的吊灯"), 440); assert.equal(D.shopUpPrice(s2, "暖黄的吊灯"), 0);
  assert.ok(D.shopDecorOf("南瓜灯").month === 10);
});
test("小店按现实时间：时段划分、每段客人不一样（下午难缠多、傍晚角色多）、有急件", () => {
  assert.equal(D.shopPeriod(new Date(2026, 0, 1, 9)), "上午"); assert.equal(D.shopPeriod(new Date(2026, 0, 1, 14)), "下午");
  assert.equal(D.shopPeriod(new Date(2026, 0, 1, 20)), "傍晚"); assert.equal(D.shopPeriod(new Date(2026, 0, 1, 3)), "半夜");
  let t = { 上午: 0, 下午: 0 }, v = { 上午: 0, 傍晚: 0 }, u = 0;
  for (let d = 1; d <= 60; d++) for (const pd of ["上午", "下午", "傍晚"]) { const cs = D.shopCustomers({ day: d, decor: [] }, ["x", "y"], 5, ["x"], pd); if (t[pd] != null) t[pd] += cs.filter(c => c.tough).length; if (v[pd] != null) v[pd] += cs.filter(c => c.visitor).length; u += cs.filter(c => c.urgent).length; }
  assert.ok(t.下午 > t.上午); assert.ok(v.傍晚 > v.上午); assert.ok(u > 0);
});
test("小店同一时段的路人不重样", () => {
  for (let d = 1; d <= 30; d++) { const n = D.shopCustomers({ day: d, decor: [] }, [], 9, [], "上午").filter(c => !c.wantChar && !c.visitor).map(c => c.name); assert.equal(new Set(n).size, n.length); }
});
test("陪打的人点名的那张（core 里夹 card:id）一定进卡组", () => {
  for (let s = 1; s < 20; s++) assert.ok(D.deckFrom(mine, s, 12, ["a", "card:c4"]).some(u => u.cardId === "c4"));
});
test("溢出一半：打死一张多出来的一半落到后面那张或信封；补满多出来的一半补信封", () => {
  const st = D.newDuel(D.deckFrom(mine, 3, 12), D.deckFrom(theirs, 4, 12), 3, {});
  const mk = hp => Object.assign(D.stampOf(mine[2]), { hp, maxHp: 20, shield: 0, marks: {} });
  st.foe.board = Array(9).fill(null); st.foe.board[0] = mk(3); const env = st.foe.hp;
  D.hitUnit(st, "foe", 0, 13, "测试");           // 多出 10，一半 5 落到信封
  assert.equal(st.foe.board[0], null); assert.equal(st.foe.hp, env - 5);
  st.foe.board[0] = mk(3); st.foe.board[3] = mk(20);
  D.hitUnit(st, "foe", 0, 13, "测试"); assert.equal(st.foe.board[3].hp, 15);
  const v = mk(18); st.me.hp = 30; D.healUnits(st.me, [v], 8); assert.equal(v.hp, 20); assert.equal(st.me.hp, 33);
});
test("小店一直玩下去：口碑不封顶、加成越来越慢；每周三张单子随口碑变大；熟练度称号无限往上", () => {
  assert.equal(D.shopRepLv({ rep: 0 }), 0); assert.equal(D.shopRepLv({ rep: 80 }), 1);
  assert.ok(D.shopRepLv({ rep: 1e6 }) > 100);
  const b = [5, 10, 40, 45].map(D.shopRepBonus); assert.ok(b[1] - b[0] > b[3] - b[2]);
  const o1 = D.shopOrders(1, "2026-11-09", "s"), o9 = D.shopOrders(30, "2026-11-09", "s");
  assert.equal(o1.length, 3); assert.ok(o9.reduce((a, o) => a + o.pay, 0) > o1.reduce((a, o) => a + o.pay, 0));
  assert.equal(D.shopSkillTitle("柜台", 0), "柜台见习"); assert.equal(D.shopSkillTitle("柜台", 15), "柜台老手"); assert.equal(D.shopSkillTitle("柜台", 90), "柜台一把手·4段");
});
test("招待：客人只说一句、开价看人（定死不能反复试）；稀客凑条件才来", () => {
  const rich = { id: "x1", mood: "rich" }, poor = { id: "x2", mood: "poor" };
  assert.equal(D.shopPrice(rich, "high").mul, 1.35); assert.equal(D.shopPrice(poor, "high").mul, 0); assert.ok(D.shopPrice(poor, "high").left);
  assert.equal(D.shopPrice({ id: "x3", mood: "poor" }, "high", 3).mul, 1.35);
  assert.equal(D.shopPrice({ id: "y", mood: "normal" }, "high").mul, D.shopPrice({ id: "y", mood: "normal" }, "high").mul);
  assert.equal(D.shopPrice(rich, "low").mul, 0.8);
  assert.ok(D.shopHint({ post: "分拣" }, "normal", () => 0).length > 4);
  assert.ok(D.RARE_GUESTS.length >= 8 && D.RARE_GUESTS.every(g => g.tip));
});
test("客人小短句：20 个特征都有小动作、20 个身份都有道谢；客人那句话前面带上动作", () => {
  assert.ok(D.FACE_ADJ.every(a => D.faceAct(a + "花匠")));
  assert.ok(D.FACE_WHO.every(w => D.faceThanks("戴草帽的" + w, 0)));
  const cs = D.shopCustomers({ day: 1, decor: [], regulars: {} }, [], 7, [], "上午").filter(c => !c.tough && /的/.test(c.name) && D.faceAct(c.name));
  cs.forEach(c => assert.ok(c.hint.indexOf("（" + D.faceAct(c.name) + "）") === 0));
});
test("新面孔的特征跟身份合得上：不会拼出满身面粉的摄影师；拼错过的老熟客不再来", () => {
  let x = 1; const R = () => (x = (x * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) { const n = D.shopNewFace(R)[0]; assert.ok(!/满身面粉的摄影师|拄拐杖的小男孩|扎双马尾的渔夫/.test(n), n); }
  const shop = { day: 1, decor: [], regulars: { a: { id: "a", name: "满身面粉的摄影师", want: "寄", fee: 8, need: "送信", bond: 4 } } };
  for (let k = 0; k < 20; k++) assert.ok(!D.shopCustomers(shop, [], k, [], "上午").some(c => c.name === "满身面粉的摄影师"));
});
