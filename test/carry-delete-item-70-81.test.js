// 她 2026-09-18：「角色随身物这些能不能也都可以单个删除啊」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

const run = (carry, pins, charId, key, name) => {
  const i = app.indexOf("  const carryItemName = it =>");
  const src = app.slice(i, app.indexOf("\n  // 随身物的素材：", i));
  const st = { carry: JSON.parse(JSON.stringify(carry)), pins: JSON.parse(JSON.stringify(pins || {})) };
  const ctx = {
    carryRef: { current: st.carry }, carryPinsRef: { current: st.pins },
    setCarry: fn => { st.carry = fn(st.carry); },
    setCarryPins: fn => { st.pins = fn(st.pins); },
    saveJSON: () => {}
  };
  vm.createContext(ctx);
  vm.runInContext(src + "\nthis.__r = carryDeleteItem(" + JSON.stringify(charId) + ", " + JSON.stringify(key) + ", " + JSON.stringify(name) + ");", ctx);
  return { ok: ctx.__r, carry: st.carry, pins: st.pins };
};
// 桩照【写这份存档的那段】写：平的那几栏是 {items:[]}，衣柜是 {closet:[{occasion,sets}]}
const BOX = () => ({ c1: {
  bag: { items: [{ name: "旧怀表", note: "他爹留的" }, { name: "半包烟" }] },
  pocket: { items: [{ name: "钥匙" }] },
  outfit: { closet: [
    { occasion: "日常", sets: [{ name: "月白常服" }, { name: "青灰直裰" }] },
    { occasion: "上朝", sets: [{ name: "绯色官袍" }] }
  ] }
} });

test("平的那几栏：删一件，别的不动", () => {
  const r = run(BOX(), {}, "c1", "bag", "半包烟");
  assert.equal(r.ok, true);
  assert.deepEqual(r.carry.c1.bag.items.map(x => x.name), ["旧怀表"]);
  assert.deepEqual(r.carry.c1.pocket.items.map(x => x.name), ["钥匙"], "串到别的栏了");
});

test("衣柜：删一身，回到它原来挂的那一格里删", () => {
  const r = run(BOX(), {}, "c1", "outfit", "青灰直裰");
  assert.equal(r.ok, true);
  assert.deepEqual(r.carry.c1.outfit.closet[0].sets.map(x => x.name), ["月白常服"]);
  assert.deepEqual(r.carry.c1.outfit.closet[1].sets.map(x => x.name), ["绯色官袍"]);
});

test("一格里的衣服删光了，那个空场合也收掉", () => {
  const r = run(BOX(), {}, "c1", "outfit", "绯色官袍");
  assert.deepEqual(r.carry.c1.outfit.closet.map(g => g.occasion), ["日常"], "留了一排空场合");
});

// ⚠️这一条是【删了会自己回来】的那个坑：钉住的那几件由 carryEvolveMerge 的
//   missingPins 原样补回去。只删条目、钉子留着的话，下次刷新它就回来了，
//   而她会以为是删除坏了。
test("删钉住的那件，钉子必须一起拔掉", () => {
  const r = run(BOX(), { c1: { bag: ["旧怀表", "半包烟"] } }, "c1", "bag", "旧怀表");
  assert.equal(r.ok, true);
  assert.deepEqual(r.pins.c1.bag, ["半包烟"], "钉子还在——下次刷新它会被补回来");
  // 补回来那条路认的就是这个名单，钉子拔了才真的删得掉
  assert.match(scr, /const missingPins = oldItems\.filter\(it => pins\.has\(carryItemKey\(it\)\)/);
});

test("名字里的空格不算数（存档里两边写法可能不一致）", () => {
  const b = BOX(); b.c1.bag.items[0].name = "旧 怀 表";
  const r = run(b, { c1: { bag: ["旧怀表"] } }, "c1", "bag", "旧怀表");
  assert.equal(r.ok, true);
  assert.deepEqual(r.carry.c1.bag.items.map(x => x.name), ["半包烟"]);
  assert.deepEqual(r.pins.c1.bag, []);
});

test("点不着的就什么都不做——别写一次空盘，也别把整栏清掉", () => {
  [["c1", "bag", "根本没有这件"], ["c1", "bag", ""], ["", "bag", "旧怀表"], ["c1", "", "旧怀表"], ["c9", "bag", "旧怀表"]]
    .forEach(([a, b, c]) => {
      const r = run(BOX(), {}, a, b, c);
      assert.equal(r.ok, false, [a, b, c].join("/"));
      assert.equal(r.carry.c1.bag.items.length, 2, "把在的东西也删了：" + [a, b, c].join("/"));
    });
});

test("界面：每一件详情里都有那颗删除键，而且先问一句", () => {
  assert.match(app, /onDeleteItem: carryDeleteItem,/, "app 没接上");
  assert.match(scr, /onTogglePin, onDeleteItem, onPeek, onGen, onGenClosetMore/, "CarryAll 没往下传");
  assert.match(scr, /function CarrySection\(\{[^}]*onTogglePin, onDeleteItem,/, "CarrySection 没收");
  assert.match(scr, /requestAppConfirm\("删掉「" \+ sheet\.name \+ "」？"/, "删东西不问一句");
  assert.match(scr, /onDeleteItem\(char\.id, sectionKey, sheet\.name\); setSheet\(null\);/);
  // 钉住的那件要在确认里说清楚钉子也会拔——不然她会以为钉住还在
  assert.match(scr, /isPinned\(sheet\) \? "这一件是钉住的，删掉时钉子也一起拔掉/);
  // 只开删除、没有钉住和摆出来时，那一块也得出得来
  assert.match(scr, /const pinRow = \(onTogglePin \|\| onPeek \|\| onDeleteItem\)/);
});
