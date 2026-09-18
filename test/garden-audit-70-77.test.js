"use strict";
// 审计（她 2026-09-18：「哪些地方还没有动作只是纯看的也做了」「哪些动作没接上日程的也接了」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const game = rd("apps/fairy-garden/game.mjs");
const comp = rd("apps/fairy-garden/companion.mjs");
const host = rd("js/fairy-garden.js");
const W = () => import("../apps/fairy-garden/world.mjs");
const C = () => import("../apps/fairy-garden/companion.mjs");
const J = x => JSON.parse(JSON.stringify(x));

test("座位只此一份：地图写死的几处加从家具推出来的；每一处站得住、走得到、他坐的那点不叠在她身上", async () => {
  const w = await W();
  for (const map of Object.keys(w.MAPS)){
    const seats = w.seatsOf(map);
    for (const [id, seat] of Object.entries(seats)){
      const s = { ...w.freshState(), map };
      if (seat.opensWith) continue;
      // ⚠️2026-09-18 起分成两点：走过去停在【站得住的那一点】（approach），
      //   坐下落在【坐垫上】（seat.x/z，家具本身不walkable，这正是对的）。
      const stand = seat.approach || seat;
      assert.ok(w.walkable(stand.x, stand.z, map, s), map + ":" + id + " 站不住");
      if (!seat.companion.rise) assert.ok(w.walkable(seat.companion.x, seat.companion.z, map, s), map + ":" + id + " 他那一点站不住");
      const d = Math.hypot(seat.x - seat.companion.x, seat.z - seat.companion.z);
      assert.ok(d >= .55 && d <= 1.45, map + ":" + id + " 两个人隔 " + d);
      assert.ok(w.findPath(w.MAPS[map].spawn, stand, map, [], s), map + ":" + id + " 走不到");
      if (seat.piece) assert.ok(seat.rise > .2, map + ":" + id + " 坐面没有高度，人会浮在家具前面");
      assert.equal(typeof seat.heading, "number");
    }
  }
  // 屋里每一张沙发／扶手椅／椅子／长凳／矮凳／浴缸边都是一处；地图写死的那几处还在
  for (const map of ["home", "hall", "neighbor1", "neighbor2", "neighbor3"]){
    const n = (w.MAPS[map].furniture || []).filter(f => w.SEAT_KINDS.includes(f.kind)).length;
    assert.ok(n > 0 && Object.keys(w.seatsOf(map)).length === n, map + " 家具 " + n + " 座位 " + Object.keys(w.seatsOf(map)).length);
  }
  assert.ok(w.seatsOf("home")["home:bath:14"] || Object.keys(w.seatsOf("home")).some(k => k.startsWith("home:bath:")), "浴缸边也坐得下");
  assert.deepEqual(Object.keys(w.seatsOf("garden")).sort(), ["bridge", "clearing", "island", "lakeEast", "lakeNorth", "pond", "railway", "square"]);
  assert.ok(w.seatsOf("oldTower").towerVines);
  assert.equal(w.seatsOf("nope") && Object.keys(w.seatsOf("nope")).length, 0);
  assert.equal(w.seatsOf("home"), w.seatsOf("home"), "算一次就记住");
});

test("坐：走 sit 那一条老路（起身／喝茶／翻书／他来坐旁边／读档不丢）；倒树后那处要先开路", async () => {
  const w = await W(), c = await C();
  const s = w.freshState(), key = Object.keys(w.seatsOf("home")).find(k => k.includes(":sofa:"));
  let h = { ...s, map: "home", position: { ...w.MAPS.home.spawn }, companion: { ...s.companion, map: "home", mode: "follow", position: { ...w.MAPS.home.spawn } } };
  assert.equal(w.actionError(h, "sit", key), "");
  const sofa = w.seatsOf("home")[key];
  assert.deepEqual(w.targetFor(h, "sit", key), { x: sofa.approach.x, z: sofa.approach.z }, "走过去停在家具旁边站得住的那一点");
  h = w.perform({ ...h, position: w.targetFor(h, "sit", key) }, "sit", key);
  assert.equal(h.seat, key);
  assert.equal(w.restoreState(J(h)).seat, key, "读档座位还在");
  assert.equal(w.restoreState(J({ ...h, position: { ...w.MAPS.home.spawn } })).seat, null, "人不在座位上就不算坐着");
  const plan = c.companionPlan(h);
  assert.equal(plan.id, "sit-together"); assert.match(plan.label, /在长沙发边陪你坐着/); assert.deepEqual(plan.target, w.seatsOf("home")[key].companion);
  assert.equal(w.actionError({ ...s, map: "home" }, "sit", "nope"), "这里没有座位。");
  assert.match(w.actionError(s, "sit", "clearing"), /倒树/);
  assert.equal(w.actionError(s, "sit", "bridge"), "");
  // 游戏那头：家具菜单里多一颗「坐一会儿」；衣柜／梳妆台开样貌页；户外景点先问坐还是看；收藏馆的墙点开馆
  assert.match(game, /if\(SEAT_KINDS\.includes\(at\.kind\)&&seatsOf\(at\.map\)\[key\]\)\{const b=document\.createElement\('button'\);b\.textContent=data\.seat===key\?'起身':'坐一会儿';/);
  assert.match(game, /if\(\['wardrobe','vanity'\]\.includes\(at\.kind\)\)\{const b=document\.createElement\('button'\);b\.textContent='换样貌';/);
  assert.match(game, /if\(hit\.kind==='visit'&&openSeatSite\(hit\.id\)\)return;if\(hit\.kind==='visit'&&data\.map==='museum'\)\{say\(MAPS\.museum\.sites\[hit\.id\]\?\.text\|\|''\);openMuseum\(\);return;\}/);
  // ⚠️坐下要真落在坐面上（她 2026-09-18：「沙发坐下去对不上建模」）：朝向照旧，
  //   另外把人挪到坐垫上、按 rise 抬起来。
  assert.match(game, /const mySeat=data\.seat\?seatsOf\(data\.map\)\[data\.seat\]:null;/);
  assert.match(game, /actor\.position\.x\+=\(mySeat\.x-actor\.position\.x\)\*Math\.min\(1,dt\*8\);/);
  // ⚠️坐面多高【量模型】，SEAT_RISE 只是量不到时的兜底（她 2026-09-18：「基本上所有坐下的都对不上」）
  assert.match(game, /const myRise=mySeat\?\(mySeat\.piece\?\(seatTop\(data\.seat,mySeat\)\?\?mySeat\.rise\?\?0\):\(mySeat\.rise\|\|0\)\):0;/);
  assert.match(game, /height:floorHeight\(data\.map,\{x:actor\.position\.x,z:actor\.position\.z\},data\)\+\(mySeat&&!moving\?myRise:0\)/);
  assert.match(game, /const hit=r\.intersectObject\(view\.root,true\)\.find\(h=>h\.point\.y>floor\+\.1&&h\.point\.y<floor\+1\.2\);/);
  assert.doesNotMatch(game, /MAPS\[data\.map\]\.seats\[data\.seat\]/, "座位一律问 seatsOf");
  assert.match(host, /openWardrobe: \(\) => \{ pullLook\(\); pullGarden\(\); setDress\(true\); \},/);
  assert.match(comp, /const seat=seatsOf\(s\.map\)\[s\.seat\];/);
});

test("日程：小路的灯、夜市、自己家里面、公共厅楼上都排得到；夜市只在那两晚天黑那一格；摊子有棚雨天照常", async () => {
  const w = await W(), c = await C();
  for (const id of ["lamp", "fair", "living", "upstairs"]) assert.ok(w.ACTIVITIES[id], id);
  assert.equal(w.ACTIVITIES.bridge.gesture, "sit"); assert.equal(w.ACTIVITIES.living.map, "home"); assert.equal(w.ACTIVITIES.upstairs.map, "dormitory");
  const s = w.freshState();
  const days = [];
  for (let d = 1; d <= 56; d++){ const list = c.dailySchedule({ ...s, day: d }); const at = list.find(x => x.id === "fair"); if (at) days.push([d, at.start]); }
  assert.deepEqual(days.map(x => x[0]), [13, 27, 41, 55], "一季两晚里第一晚排夜市，第二晚是换季的灯会（v70.81）");
  assert.ok(days.every(x => x.start === undefined || x[1] === 1140), "天黑那一格");
  assert.ok(!c.dailySchedule({ ...s, day: 3 }).some(x => x.id === "fair"));
  // 一起排过这一季的，那两晚天黑那一格也改去夜市
  const plan = { season: 0, days: Array.from({ length: 14 }, (_, i) => ({ day: i + 1, note: "", activities: [{ id: "walk", note: "" }, { id: "bridge", note: "" }, { id: "study", note: "" }] })) };
  const withPlan = c.dailySchedule({ ...s, day: 13, seasonPlan: plan });
  assert.deepEqual(withPlan.filter(x => x.id === "fair").map(x => x.start), [1080]);
  assert.equal(withPlan.find(x => x.id === "fair").note, "今晚村里有夜市。");
  assert.ok(!c.dailySchedule({ ...s, day: 12, seasonPlan: plan }).some(x => x.id === "fair"));
  // 雨天：集市／夜市不改到檐下
  const rainy = [..."abcdefghijklmnopqrstuvwxyz"].map(ch => ch + "9").find(ep => w.weather(13, ep) === "细雨");
  if (rainy){ const wet = c.dailySchedule({ ...s, day: 13, epoch: rainy }); assert.ok(wet.some(x => x.id === "fair"), "夜市雨天照常"); }
  assert.match(comp, /const DRY_IN_RAIN=new Set\(\['home','flowers','rain','market','fair','festival','indoors'\]\);/);
  assert.match(comp, /\[1140,festivalDay\(s\.day\)\?'festival':nightMarketDay\(s\.day\)\?'fair':c\]/);
  assert.match(comp, /id!=='fair'&&id!=='festival'&&reachable\(id,s\)/, "夜市和灯会不进抽签池");
});
