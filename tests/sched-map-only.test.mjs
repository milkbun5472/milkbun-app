// 日程只去地图上的地方（按世界开）
import { createRequire } from "node:module"; import { readFileSync } from "node:fs"; import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const M = require("../js/map.js");
const world = { schedMapOnly: true, regions: [
  { name: "老城", terrain: "城郭", adj: ["港口"], nodes: [{ name: "钟楼茶馆", kind: "城镇" }, { name: "石桥", kind: "地标" }] },
  { name: "港口", terrain: "水泽", adj: [], nodes: [{ name: "三号码头", kind: "城镇" }] },
  { name: "北山", terrain: "山地", adj: [], nodes: [{ name: "旧矿洞", kind: "遗迹" }] }] };
assert.equal(M.schedMapOn(world), true);
assert.equal(M.schedMapOn({ ...world, schedMapOnly: false }), false);
const b = M.schedMapBlock(world, "钟楼茶馆");
assert.ok(b.indexOf("钟楼茶馆") > 0 && b.indexOf("三号码头") > 0 && b.indexOf("旧矿洞") > 0);
assert.ok(b.indexOf("老城") < b.indexOf("港口") && b.indexOf("港口") < b.indexOf("北山"), "按远近排");
assert.match(b, /挨着你住的这块/); assert.match(b, /不连着/);
assert.equal(M.snapSeqToMap(world, { place: "三号码头", title: "卸货" }, "钟楼茶馆").place, "三号码头");
assert.equal(M.snapSeqToMap(world, { place: "码头", title: "卸货" }, "钟楼茶馆").place, "三号码头");
assert.equal(M.snapSeqToMap(world, { place: "皇宫", location: "御花园", title: "上朝" }, "钟楼茶馆").place, "钟楼茶馆");
assert.equal(M.snapSeqToMap({ ...world, schedMapOnly: false }, { place: "皇宫" }, "钟楼茶馆").place, "皇宫");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
assert.match(app, /schedPeerBlock\(char, \[dayKey\]\) \+ schedMapRule\(char\)/);
assert.match(app, /plan\.seqs = schedSnap\(char, plan\.seqs\);\s*saveSchedDay\(char\.id, dayKey, plan\)/);
assert.match(app, /seqs: schedSnap\(char, seqs\), murmurs: \[\]/);
assert.match(app, /seqs: schedSnap\(c, seqs\), selfRevCheck: true/);
assert.match(app, /onSchedMapWorld: setWorldSchedMap/);
console.log("sched map only ok");
// 替谁添
const mapSrc = readFileSync(new URL("../js/map.js", import.meta.url), "utf8");
assert.match(mapSrc, /onGen\(reg, hint\.trim\(\), mode === "for" \? forId : ""\)/);
assert.match(mapSrc, /h\(NodeAdd, \{ world: world, characters: characters/);
assert.match(mapSrc, /o\.onGenNodes\(world\.id, r, hint, null, fid\)/);
assert.match(mapSrc, /onGenNodes\(cur\.id, r, hint, null, fid\)/);
assert.match(app, /const genWorldNodes = async \(wid, regionName, hint, done, forId\)/);
assert.match(app, /\[forChar\.id\]: home/);
assert.match(app, /k !== forChar\.id/);
console.log("node add for ok");
// 地图改版：底下工具栏四格，各开一整页；加地点那页四样分开
assert.match(mapSrc, /"data-wk": "mapworldtools"/);
for (const k of ["place", "people", "layout", "setup"]) assert.ok(mapSrc.includes('["' + k + '", '), k);
assert.match(mapSrc, /const legendItem = function/);
assert.match(mapSrc, /const PersonDot = function/);
assert.match(mapSrc, /\["own", "自己写"\], \["gen", "让模型添"\], \["for", "替谁添"\]/);
assert.ok(!mapSrc.includes('"＋ 地点"'), "顶上那颗「＋ 地点」收进工具栏了");
console.log("map toolbar ok");
