const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { normRegions, mapBuild } = require("../js/trpg.js");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const map = R("map.js"), app = R("app.js"), trpg = R("trpg.js");
const grab = (src, a, b, cap) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return src.slice(i, j);
};
const add = grab(app, "  const addWorldNode = (wid, regionName, node) => {", "  const genWorldNodes = async");
const gen = grab(app, "  const genWorldNodes = async (wid, regionName, hint, done) => {", "  const saveWorld = (id, name, brief)");

// 她 2026-08-31：「再加一个可以继续往这个地方加地点的功能」。
// 这一版真正的坑不在界面上：跑团那个画图引擎每块地方【只画前 3 个地点】，
// 所以第 4 个加得进存档、画不出来。真机跑才现形。
const RAW = [{ name: "甲", terrain: "城郭", adj: ["乙"], nodes: ["a1", "a2", "a3", "a4", "a5"] },
             { name: "乙", terrain: "水泽", adj: ["甲"], nodes: ["b1", "b2"] }];
test("上限做成可调，但跑团那边的默认值一个字都不许变", () => {
  // 默认 = 跑团现在的行为。改了它，她所有已开的团的图都会变样
  assert.deepEqual(normRegions(RAW).map(r => r.nodes.length), [3, 2], "跑团的默认上限被动了");
  assert.deepEqual(normRegions(RAW, 8, 8).map(r => r.nodes.length), [5, 2], "上限调不动");
  assert.match(trpg, /function normRegions\(raw, maxNodes, maxRegions\) \{\n    const MAXN = maxNodes \|\| 3, MAXR = maxRegions \|\| 6;/, "默认值没兜住");
  assert.match(trpg, /function mapBuild\(seed, regionsRaw, W, H, maxNodes, maxRegions\)/, "mapBuild 没把上限透下去");
  const m = mapBuild("w", RAW, 360, 620, 8, 8);
  assert.deepEqual(m.nodes.map(n => n.name), ["a1", "a2", "a3", "a4", "a5", "b1", "b2"], "放开上限后还是画不全");
});

test("架空地图显式放开上限，加了却画不出来的那道坎要挡在存盘之前", () => {
  assert.match(map, /const WORLD_MAX_NODES = 8, WORLD_MAX_REGIONS = 8;/, "架空地图没放开上限");
  assert.match(map, /K\.mapBuild\(world\.id, world\.regions, 360, 620, WORLD_MAX_NODES, WORLD_MAX_REGIONS\)/, "放开了没传下去");
  // 「加得进去却画不出来」是最难查的一种；所以加之前就挡
  assert.match(add, /if \(rg && \(rg\.nodes \|\| \[\]\)\.length >= 8\)/, "一块地方加满了还让加");
  assert.match(gen, /const room = Math\.max\(0, 8 - /, "让模型添的时候不看还剩几个位置");
  assert.match(gen, /\.slice\(0, Math\.min\(4, room\)\)/, "模型一口气添超了也照收");
});

// 加了地点，图必须跟着重算——memo 的钥匙只有 world.id 的话，骨架变了也不会重画
test("骨架一变图就重算：memo 的钥匙不能只有 world.id", () => {
  const wm = grab(map, "  function WorldMap({", "  // 开世界：整页表单");
  assert.match(wm, /\}, \[world && world\.id, skel\]\);/, "memo 的钥匙里没有骨架指纹——加了地点也不会重画");
  assert.match(wm, /const skel = \(world\.regions \|\| \[\]\)\.map/, "没算骨架指纹");
  assert.match(wm, /\+ \(r\.nodes \|\| \[\]\)\.map\(function \(n\) \{ return n\.name; \}\)\.join\(","\)/, "指纹没把地点名算进去");
});

test("手写一个不花调用；让模型添才走一次", () => {
  assert.ok(!/callAI|runProbe|await /.test(add.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n")), "手写那条也去调模型了");
  assert.match(add, /if \(dup\) \{ toast\("「" \+ nm \+ "」已经在图上了"\); return false; \}/, "重名的照加");
  assert.match(gen, /await callAI\(active, sys/, "让模型添那条没走裸调用");
  assert.match(gen, /【已经有的地方和地点】/, "没把这个世界已经有的递过去,它会编出重样的、或者跟这个世界不搭的");
  assert.match(gen, /!seen\[x\.name\] && \(seen\[x\.name\] = 1\)/, "模型编了个重名的也照收");
  assert.match(map, /"加进「" \+ reg \+ "」（不花调用）"/, "界面上没说清哪条花钱哪条不花");
  assert.match(map, /"让模型往「" \+ reg \+ "」添 2-4 个（一次调用）"/);
  // 位置会挪这件事得先说，不然她会以为图坏了
  assert.match(map, /加完之后，同一块地方里其它地点的位置会挪一挪/, "没提前说位置会变");
});

test("加地点是整页，不是半窗", () => {
  const na = grab(map, "  function NodeAdd({ world, busy, onAdd, onGen, onBack }) {", "  // 开世界：整页表单");
  assert.ok(!/h\(Sheet/.test(na), "用了半窗——见 .claude/rules/no-half-sheet.md");
  assert.match(na, /position: "fixed", inset: 0/);
  assert.match(na, /flex-1 min-h-0 overflow-y-auto/, "正文不是那一个主滚动容器");
});

// 「然后在每一个世界我都可以钉上去」
test("你自己也在名单里，每个世界各记各的", () => {
  const wm = grab(map, "  function WorldMap({", "  // 开世界：整页表单");
  assert.match(wm, /const meRow = \{ id: "__me"/, "名单里没有她自己");
  assert.match(wm, /const roster = \(characters \|\| \[\]\)\.concat\(\[meRow\]\)/, "她没被并进名单");
  // 她不跟着行程走——行程是角色的，她的位置只由她自己钉
  assert.match(wm, /c\.__me \? \{ node: \(world\.pins \|\| \{\}\)\[c\.id\] \|\| "", live: false \}/, "把她也塞进按行程算位置那条路了");
  assert.match(wm, /c\.__me \? \(here \? "你在这儿"/, "她那一行的说明跟角色混了");
  // 每个世界各记各的：钉子存在 world.pins 里，不是一个全局的
  assert.match(app, /const pinWorld = \(wid, charId, node\) => saveWorlds\(\(worlds \|\| \[\]\)\.map\(w => \{/, "钉子不是按世界存的");
});
