// 她 2026-11-02：「新做宠物桌面组件放空白页最后面」
const assert = require("node:assert/strict");
const comp = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
assert.match(comp, /w_pets: \{ kind: "widget", which: "pets", tail: true \},/, "tail：安全网补到最后一页（空白页）");
assert.match(comp, /"companion", "nest", "w_taday", "w_pets"\]\n  \];/, "新档默认排在最后一页最后面");
assert.match(comp, /else if \(it\.which === "pets"\) inner = h\(PetsWidget,/);
assert.match(comp, /taday: "TA在干嘛", pets: "宠物" \};/);
assert.match(comp, /w_wheel: "转盘", w_pets: "宠物" \};/, "移走了能从「＋ 装饰」放回来");
// 数据：每间小镇房一档，跟房间横幅那页同一个 petWatchOf；点开就是同一个监控页
const seg = comp.slice(comp.indexOf("function petWidgetRows("), comp.indexOf("function PetsWidget("));
assert.match(seg, /rooms\.filter\(r => r && r\.garden\)/);
assert.match(seg, /"x_fairyGarden::" \+ CR\.chatKey\(c\.id, r\.id\)/);
assert.match(seg, /petWatchOf\(loadJSON\(key, null\)\)/);
const w = comp.slice(comp.indexOf("function PetsWidget("), comp.indexOf("const GPaw = "));
assert.match(w, /h\(PetWatchSheet, \{ storeKey: sheet\.key,/);
assert.match(w, /window\.__openFromNotif\(x\.charId, "thread", x\.roomId\)/);
assert.doesNotMatch(w, /callAI|runProbe/);
// 跑一遍 petWidgetRows：两间房、一间是小镇
const store = { worlds: { pets: { pets: [{ id: "p1", profile: { name: "团子" }, care: { satiety: 50, energy: 50, mood: 50, bowl: 5 }, life: {} }] } } };
const rows = new Function("window", "loadJSON", comp.slice(comp.indexOf("const PET_TASK_ZH = "), comp.indexOf("function PetWatchSheet(")) + seg + "; return petWidgetRows;")(
  { ChatRooms: { list: () => [{ id: "main", main: true }, { id: "r2", garden: true }], chatKey: (c, r) => c + "::" + r } },
  k => k === "x_fairyGarden::c1::r2" ? store : null)([{ id: "c1", name: "周树生" }]);
assert.equal(rows.length, 1); assert.equal(rows[0].p.name, "团子"); assert.equal(rows[0].roomId, "r2"); assert.equal(rows[0].who, "周树生");
console.log("ok");
