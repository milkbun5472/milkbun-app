// 她 2026-10-10：「现在必须要设置在谁身边然后再把 npc 连到别的角色身上」——配角页直接新建，一步连好认识谁，在谁身边可以不挂
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const ts = fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8");

function load(chars) {
  const i = app.indexOf("  const addNpcLinked = ({ name, brief, ownerId, links }) => {"), j = app.indexOf("  const addMyNpc = ", i);
  assert.ok(i > 0 && j > i, "抠不出 addNpcLinked");
  const out = { made: [], rels: {} };
  const fn = new Function("characters", "pC", "saveRel", "toast", "CharacterPronoun", app.slice(i, j) + "\nreturn addNpcLinked;")(
    chars, u => { out.made = u(out.made); }, (k, label) => { out.rels[k] = label; }, () => {}, { newCharacter: o => o });
  return { fn, out };
}

test("连好几个人、不挂在谁身边：每条线两头都写，主人留空", () => {
  const { fn, out } = load([{ id: "a" }, { id: "b" }, { id: "n1", npc: true }]);
  const id = fn({ name: "老周", brief: "楼下咖啡店老板", ownerId: "", links: [{ id: "a", label: "常客" }, { id: "n1", label: "老同学" }, { id: "me", label: "邻居" }, { id: "ghost", label: "x" }] });
  assert.ok(id);
  const c = out.made[0];
  assert.equal(c.ownerId, "");
  assert.equal(c.knowsUser, true);
  assert.equal(c.knowsUserNote, "邻居");
  assert.equal(out.rels["a->" + id], "常客"); assert.equal(out.rels[id + "->a"], "常客");
  assert.equal(out.rels["n1->" + id], "老同学");
  assert.equal(out.rels["me->" + id], "邻居"); assert.equal(out.rels[id + "->me"], "邻居");
  assert.equal(out.rels["ghost->" + id], undefined, "不存在的人不连");
});

test("主人只认得「me」或真有的角色；不认识她就不挂 knowsUser", () => {
  const { fn, out } = load([{ id: "a" }]);
  fn({ name: "X", ownerId: "zzz", links: [{ id: "a", label: "同事" }] });
  assert.equal(out.made[0].ownerId, "");
  assert.equal(out.made[0].knowsUser, undefined);
  assert.equal(load([]).fn({ name: "  " }), null);
});

test("配角页：右上角 + 进整页新建，交给 addNpcLinked；不挂的那一组排最后", () => {
  assert.match(comp, /function NpcBook\(\{ npcs, owners, meName, onCreate,/);
  assert.match(comp, /"data-wk": "npcnew"/);
  assert.match(ts, /\["npcnew", /);
  assert.match(comp, /!id \? "不挂在谁身边"/);
  assert.match(app, /onCreateNpc: data => !!addNpcLinked\(data\),/);
  assert.match(comp, /onCreate: onCreateNpc, /);
});
