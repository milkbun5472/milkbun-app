"use strict";
// 他会拒绝、会约你、会回送；邻居能挥手、能收东西、有自己那句话（她 2026-09-18：「接着做3和4」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const host = rd("js/fairy-garden.js");
const rules = rd("apps/fairy-garden/rules.js");
function service(callAI){const ctx={React:{},WeakMap,JSON,Error,extractJSON:JSON.parse,callAI,narrativeCore:()=> '共同文风',CONDESCENDING_TONE_BAN:'公共规则',REGISTER_FOLLOWS_SCENE:'',STOCK_REPLY_BAN:'',OVERREACH_BAN:'',ECHO_QUESTION_BAN:'',userName:p=>p.name};ctx.window=ctx;vm.runInNewContext(rules,ctx);vm.runInNewContext(host,ctx);return ctx.FairyGardenService;}
const W = () => import("../apps/fairy-garden/world.mjs");
const nearby = s => ({ ...s, companion: { ...s.companion, map: s.map, position: { ...s.position } } });

// ── 3 ────────────────────────────────────────────────────────────────────
test("他递给你的真进背包：只能是顺手采得到的三样，一天一样，得在跟前", async () => {
  const w = await W();
  const s = nearby(w.freshState());
  assert.equal(w.himGive(s, "herb").herbs, 2);
  assert.equal(w.himGive(s, "mushroom").mushrooms, 1);
  const f = w.himGive(s, "flower");
  assert.equal(f.harvest, 1);
  assert.equal(f.gifts[0].from, "him");
  assert.ok(w.bondKinds(f).has("given"));
  assert.match(f.happenings[0].text, /递给你月光花/);
  assert.equal(w.himGive(f, "herb"), f, "一天一样");
  assert.equal(w.himGive(s, "dew"), s, "月露不是顺手采得到的");
  const farAway = { ...s, companion: { ...s.companion, position: { x: s.position.x + 8, z: s.position.z } } };
  assert.equal(w.himGive(farAway, "herb"), farAway, "不在跟前递不过来");
  // 他给的不占她「一天一样」的额度，也不算她摸清了他的喜好
  const mine = w.giveGift({ ...f, harvest: 2 }, { type: "flower" }, null);
  assert.equal(mine.harvest, 1, "他给过之后她今天照样能递");
  assert.equal(w.giftBook(f).families.find(x => x.id === "flower").count, 0);
  assert.equal(w.giftBook(f).fromHim.length, 1);
  // 读档不丢 from
  assert.equal(w.restoreState(JSON.parse(JSON.stringify(f))).gifts[0].from, "him");
});

test("他约她：先自己去那儿等，她到了才算赴约；隔天作废；没到档的地方约不了", async () => {
  const w = await W();
  let far = w.freshState();
  for (const k of ["gift", "sit"]) far = w.noteBond(far, k, k);
  const fresh = w.freshState();
  assert.equal(w.invite(fresh, "market", "x"), fresh, "刚住到一起约不到集市");
  const inv = w.invite(far, "market", "来吃个饼");
  assert.equal(inv.companion.mode, "goto"); assert.equal(inv.companion.destination, "market");
  assert.deepEqual(inv.invite, { place: "market", day: 1, note: "来吃个饼" });
  assert.ok(!w.inviteMet(inv), "他还没走到，她也没到");
  const d = w.COMPANION_DESTINATIONS.market;
  const there = { ...inv, position: { ...d.target }, companion: { ...inv.companion, position: { ...d.target } } };
  assert.ok(w.inviteMet(there));
  const kept = w.keepInvite(there);
  assert.equal(kept.invite, null);
  assert.ok(w.bondKinds(kept).has("date"));
  assert.match(kept.happenings[0].text, /赴了.*的约/);
  assert.equal(w.nextDay(inv).invite, null, "过了那天就不算了");
  assert.equal(w.restoreState(JSON.parse(JSON.stringify(inv))).invite.place, "market");
  assert.equal(w.restoreState({ ...inv, invite: { place: "secret", day: 1 } }).invite, null);
  // 游戏那头：赴约那一枪走「他来找你」同一条路，她点了才打
  assert.match(game, /const dating=inviteMet\(data\),starry=!dating&&starNightReady\(data\),guiding=!dating&&!starry&&guideTalkReady\(\);call\.textContent=dating\?'他约你来的':starry\?'摊开星图':guiding\?'他带你看看':'他好像有话要说';/);
  assert.match(game, /if\(inviteMet\(data\)\)\{askDate\(\);return;\}/);
  assert.match(game, /data=keepInvite\(data\);ui\(\);save\(\);/, "先记上再打，点两下不许两枪");
  assert.match(host, /material && material\.invite\s*\?\s*"【此刻】是你约她来"/);
});

test("他没答应：村里的账上有一笔，他回自己的日程，不扣任何东西", async () => {
  const w = await W();
  const s = { ...w.freshState(), companion: { ...w.freshState().companion, mode: "follow" } };
  const out = w.refuse(s, "太晒了，不去");
  assert.equal(out.companion.mode, "routine");
  assert.equal(out.happenings[0].text, "同行者这会儿没答应：太晒了，不去");
  assert.equal(out.miss.score, s.miss.score); assert.equal(out.bond.length, 0);
  assert.equal(w.refuse(s, "").happenings[0].text, "同行者这会儿没答应");
});

test("聊天里七种动作：白名单认得、参数洗过、游戏那头再验一次", () => {
  const svc = service();
  const norm = action => svc.normalizeReply(JSON.stringify({ reply: "嗯", action })).action;
  assert.deepEqual(JSON.parse(JSON.stringify(norm({ kind: "invite", target: "market", note: "来" }))), { kind: "invite", target: "market", note: "来" });
  assert.equal(norm({ kind: "invite", target: "secret" }).kind, "none");
  assert.deepEqual(JSON.parse(JSON.stringify(norm({ kind: "gift", item: "herb" }))), { kind: "gift", item: "herb" });
  assert.equal(norm({ kind: "gift", item: "moonstone" }).kind, "none", "不许凭空变出东西");
  assert.equal(norm({ kind: "refuse", why: "x".repeat(200) }).why.length, 80);
  assert.equal(norm({ kind: "eval", code: "evil()" }).kind, "none");
  assert.equal(norm({ kind: "goto", target: "market" }).target, "market");
  assert.match(game, /if\(action\.kind==='gift'\)\{if\(himGiveError\(data,action\.item\)\)return false;data=himGive\(data,action\.item\);/);
  assert.match(game, /if\(action\.kind==='refuse'\)\{data=refuse\(data,action\.why\);/);
  assert.match(game, /if\(action\.kind==='invite'\)\{if\(inviteError\(data,action\.target\)\)return false;/);
  assert.match(host, /invite=你约她去一个地点/);
  assert.match(host, /gift=你把手边顺手采到的一样递给她/);
  assert.match(host, /refuse=她提了什么你没答应/);
  assert.match(game, /invite:data\.invite\?\{place:/, "快照里得有这一约，他才知道自己约过");
});

// ── 4 ────────────────────────────────────────────────────────────────────
test("邻居能挥手、能收东西：挥手一天一次记交情，递东西交情加两格、一天一样", async () => {
  const w = await W();
  let s = w.moveIn(w.freshState(), { charId: "c1", name: "阿棠", look: {} });
  s = { ...s, position: { ...s.neighbors[0].position }, harvest: 2 };
  assert.equal(w.neighborNear(s).name, "阿棠");
  assert.equal(w.neighborNear({ ...s, position: { x: s.position.x + 9, z: s.position.z } }), null);
  const waved = w.waveAtNeighbor(s, "c1");
  assert.equal(w.metCount(waved, "c1"), 1);
  assert.match(waved.happenings[0].text, /你向阿棠挥了挥手/);
  assert.equal(w.waveAtNeighbor(waved, "c1"), waved, "一天对同一位只记一次");
  assert.ok(w.neighborWaveError({ ...s, seat: "pond" }, "c1"));
  assert.ok(w.neighborWaveError(s, "nobody"));
  const given = w.giveToNeighbor(waved, "c1", { type: "flower" });
  assert.equal(given.harvest, 1); assert.equal(w.metCount(given, "c1"), 3);
  assert.equal(given.gifts.length, 0, "递给邻居的不进同行者的礼物簿");
  assert.equal(w.giveToNeighbor(given, "c1", { type: "flower" }), given, "一天一样");
  assert.ok(w.neighborGiftError({ ...s, position: { x: s.position.x + 3, z: s.position.z } }, "c1", { type: "flower" }));
  // 邻居走远了，交情在；读档不丢「今天做过了」
  const loaded = w.restoreState(JSON.parse(JSON.stringify(given)));
  assert.equal(loaded.greeted.c1, 1); assert.equal(loaded.neighborGifts.c1, 1);
  // 游戏那头：同行者不在跟前、邻居在跟前，那一下是冲邻居挥的；邻居也抬手
  assert.match(game, /const nb=kind==='wave'&&err\?neighborNear\(data\):null;/);
  assert.match(game, /x\.avatar\.animate\(clock,\{gesture:'wave'/);
  assert.match(game, /if\(nb\)\{const err=neighborGiftError\(data,nb,o\.ref\);/);
});

test("邻居之间照过面翻得出来，一枪不打", async () => {
  const w = await W();
  let s = w.moveIn(w.moveIn(w.freshState(), { charId: "c1", name: "阿棠", look: {} }), { charId: "c2", name: "小满", look: {} });
  s = w.noteMeet(s, { a: "c1", b: "c2", nameA: "阿棠", nameB: "小满", place: "集市" });
  s = w.noteMeet(s, { a: "me", b: "c1", nameA: "你", nameB: "阿棠", place: "集市" });
  const pairs = w.neighborPairs(s);
  assert.equal(pairs.length, 1); assert.equal(pairs[0].n, 1);
  assert.ok([pairs[0].a, pairs[0].b].includes("阿棠") && [pairs[0].a, pairs[0].b].includes("小满"));
  assert.match(game, /pairs:neighborPairs\(data\)/);
  assert.match(host, /crew\.pairs\.map\(/);
});

test("邻居那句话：一位邻居一枪、三档各一句、之后查表；料在 system、user 一句触发", async () => {
  let calls = 0, args;
  const svc = service(async (...a) => { calls++; args = a; return JSON.stringify({ lines: [
    { tier: "刚搬来", text: "嗯。" }, { tier: "处熟了", text: "又来了。" }, { tier: "乱写", text: "x" } ] }); });
  const rows = await svc.hello({ active: {}, character: { name: "阿棠", persona: "全文人设" }, profile: { name: "她" }, world: { day: 1 } });
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(rows), JSON.stringify([{ tier: "刚搬来", text: "嗯。" }, { tier: "处熟了", text: "又来了。" }]));
  const [, sys, messages, opts] = args;
  assert.match(sys, /全文人设/); assert.match(sys, /邻居/);
  assert.equal(messages.length, 1); assert.ok(messages[0].content.length <= 8);
  assert.equal(opts.maxTokens, 65535);
  await assert.rejects(() => service(async () => "{}").hello({ active: {}, character: { name: "x" }, profile: {}, world: {} }), /没读出/);
  assert.match(host, /hellos: \{ \.\.\.\(old\.hellos \|\| \{\}\), \[cid\]: \{ status: "ready", at: Date\.now\(\), rows \} \}/);
  assert.match(host, /if \(have && have\.status === "ready"\) return have\.rows;/);
  // 游戏那头按处到哪一档挑那句；没配宿主就只是抬手
  assert.match(game, /const tier=closeness\(data,id\);const line=\(rows\|\|\[\]\)\.find\(r=>r\.tier===tier\)/);
  assert.match(game, /if\(!host\|\|!host\.hello\)\{say\(n\.name\+'抬手应了一下。'\);return;\}/);
  // 提示词不塞内容示范
  const seg = host.slice(host.indexOf("async function hello("), host.indexOf("return normalizeHello(raw);"));
  assert.doesNotMatch(seg, /"text":"[^"]*[，。！][^"]*"/, "输出格式里的 text 只能是说明，不能是样句");
});
