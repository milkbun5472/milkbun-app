const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const map = fs.readFileSync(__dirname + "/../js/map.js", "utf8");
// 她 2026-10-03 群友：「地图搞了删除，能不能再搞编辑」
const src = app.slice(app.indexOf("  const editWorldNode = "), app.indexOf("  const genWorldNodes = "));
function run(worlds, wid, nm, patch) {
  let saved = null, msg = "";
  const f = new Function("worldsRef", "worlds", "saveWorlds", "toast", src + "; return editWorldNode;")({ current: worlds }, worlds, w => { saved = w; }, m => { msg = m; });
  return { r: f(wid, nm, patch), saved, msg };
}
const W = () => [{ id: "w", pins: { a: "酒馆", __me: "酒馆", b: "码头" },
  route: { a: { home: "酒馆", places: [{ doing: "喝一杯", node: "酒馆" }, { doing: "看船", node: "码头" }] } },
  regions: [{ name: "东区", nodes: [{ name: "酒馆", kind: "城镇", hook: "有人在赌钱" }, { name: "市集", kind: "城镇" }] },
    { name: "港口", nodes: [{ name: "码头", kind: "地标" }] }] }];

test("改名：钉在那儿的人（含她自己）、行程里的落脚点和去处一起改过来", () => {
  const { r, saved } = run(W(), "w", "酒馆", { name: "老灯酒馆", kind: "地标", hook: "今晚有人唱歌" });
  assert.equal(r, "老灯酒馆");
  const nd = saved[0].regions[0].nodes[0];
  assert.deepEqual([nd.name, nd.kind, nd.hook], ["老灯酒馆", "地标", "今晚有人唱歌"]);
  assert.deepEqual(saved[0].pins, { a: "老灯酒馆", __me: "老灯酒馆", b: "码头" });
  assert.equal(saved[0].route.a.home, "老灯酒馆");
  assert.deepEqual(saved[0].route.a.places.map(q => q.node), ["老灯酒馆", "码头"]);
});

test("不许跟别的地点重名、不许空名字", () => {
  assert.equal(run(W(), "w", "酒馆", { name: "码头" }).r, false);
  assert.equal(run(W(), "w", "酒馆", { name: "  " }).r, false);
  assert.ok(run(W(), "w", "酒馆", { name: "酒馆", hook: "换件事" }).r, "只改眼下的事、名字不变也行");
});

test("节点页有「编辑」，三处入口都接上", () => {
  assert.match(map, /setEditing\(\{ name: sel\.name, kind: sel\.kind, hook: sel\.hook \|\| "" \}\)/);
  assert.match(map, /const r = onEditNode\(sel\.name, editing\);/);
  assert.match(map, /onEditNode: o\.onEditNode \?/, "嵌在「我们的城市」里的那张也要能改");
  assert.match(map, /onEditNode: onEditNode \? function \(nm, p\) \{ return onEditNode\(cur\.id, nm, p\); \}/);
  assert.match(app, /onEditNode: editWorldNode,/);
  assert.match(app, /onDelNode: delWorldNode, onEditNode: editWorldNode[,}]/);
});

// 她 2026-10-03：「加吧」——一块地方本身也能改（名字、地形）
const rsrc = app.slice(app.indexOf("  const editWorldRegion = "), app.indexOf("  const genWorldNodes = "));
function runR(worlds, wid, nm, patch) {
  let saved = null;
  const f = new Function("worldsRef", "worlds", "saveWorlds", "toast", rsrc + "; return editWorldRegion;")({ current: worlds }, worlds, w => { saved = w; }, () => {});
  return { r: f(wid, nm, patch), saved };
}
const W2 = () => [{ id: "w", regions: [{ name: "东区", terrain: "平原", adj: ["港口"], nodes: [{ name: "酒馆" }] }, { name: "港口", terrain: "水泽", adj: ["东区"], nodes: [{ name: "码头" }] }] }];
test("改一块地方：名字地形都改，别的块「挨着谁」跟着改；重名、空名不许", () => {
  const { r, saved } = runR(W2(), "w", "东区", { name: "灯市", terrain: "城郭" });
  assert.equal(r, "灯市");
  assert.deepEqual([saved[0].regions[0].name, saved[0].regions[0].terrain], ["灯市", "城郭"]);
  assert.deepEqual(saved[0].regions[1].adj, ["灯市"]);
  assert.deepEqual(saved[0].regions[0].nodes, [{ name: "酒馆" }], "块里的地点跟着它，不用动");
  assert.equal(runR(W2(), "w", "东区", { name: "港口" }).r, false);
  assert.equal(runR(W2(), "w", "东区", { name: "" }).r, false);
  assert.match(map, /"改这一块"/);
  assert.match(map, /onEditRegion: o\.onEditRegion \?/);
  assert.match(app, /onEditRegion: editWorldRegion,/);
});
