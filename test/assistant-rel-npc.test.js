// 她 2026-10-10：「秋秋能不能编辑一下角色关系和创建 npc 啊然后把各种 npc 串联起来」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const src = fs.readFileSync("js/assistant.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");

function load(out) {
  const start = src.indexOf("(function () {\n  const useState = React.useState;");
  const end = src.indexOf("// ============================================================\n// 界面：");
  assert.ok(start >= 0 && end > start, "抠不出 Assistant");
  const sb = { console, React: { useState: () => [] }, h: () => null, Svg: null,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, loadJSON: (_k, f) => f,
    callAI: async () => JSON.stringify(out), parseJSONLoose: s => JSON.parse(s), extractJSON: s => JSON.parse(s) };
  sb.window = sb;
  vm.runInNewContext(src.slice(start, end), sb);
  return sb.Assistant;
}
const mkCtx = () => {
  const rels = { "a->n1": { label: "老板", note: "旧备注" } }, made = [];
  return { rels, made, ctx: { characters: [{ id: "a", name: "陆闻" }], allChars: [{ id: "a", name: "陆闻" }, { id: "b", name: "顾暮" }, { id: "n1", name: "阿七", npc: true, ownerId: "a" }],
    profile: { name: "Lisa" }, relsOf: () => rels,
    onSaveRel: (k, label, note) => { if (!label) delete rels[k]; else rels[k] = { label, note }; },
    onCreateNpc: o => { made.push(o); return true; } } };
};

test("关系卡：名字认得出、两个方向一起写、空着就删、备注不丢", async () => {
  const A = load({ reply: "好", patches: [
    { target: "rel", id: "陆闻->阿七", text: "发小", both: true },
    { target: "rel", id: "顾暮 → 我", text: "前任" },
    { target: "rel", id: "a->n1" }] });
  const { rels, ctx } = mkCtx();
  const r = await A.ask({}, ctx, [], "陆闻和阿七其实是发小");
  assert.equal(r.patches.length, 3);
  A.apply(r.patches[0], ctx);
  assert.deepEqual({ ...rels["a->n1"] }, { label: "发小", note: "旧备注" });
  assert.equal(rels["n1->a"].label, "发小");
  A.apply(r.patches[1], ctx);
  assert.equal(rels["b->me"].label, "前任");
  A.apply(r.patches[2], ctx);
  assert.equal(rels["a->n1"], undefined, "text 空着＝删掉");
  assert.throws(() => A.apply({ target: "rel", id: "谁->我", text: "x" }, ctx), /认得出的人/);
});

test("建配角：一张卡建好、连好，认识谁按名字认；一轮可以出到 12 张", async () => {
  const many = Array.from({ length: 14 }, (_, i) => ({ target: "rel", id: "陆闻->顾暮", text: "第" + i }));
  const A = load({ reply: "好", patches: [{ target: "npc", id: "new", text: JSON.stringify({ name: "老周", brief: "咖啡店老板", owner: "", links: [{ who: "陆闻", label: "常客" }, { who: "我", label: "邻居" }, { who: "不存在", label: "x" }] }) }].concat(many) });
  const { made, ctx } = mkCtx();
  const r = await A.ask({}, ctx, [], "建个咖啡店老板");
  assert.equal(r.patches.length, 12);
  A.apply(r.patches[0], ctx);
  assert.equal(made[0].name, "老周");
  assert.equal(made[0].ownerId, "");
  assert.equal(made[0].links.map(l => l.id).join(","), "a,me");
});

test("快照里有配角和关系；两处秋秋都接上了写入口", () => {
  assert.match(src, /配角: npcs\.length \? npcs : \["（还没有配角）"\], 关系: relRows\.length/);
  assert.equal((app.match(/onCreateNpc: data => !!addNpcLinked\(data\),/g) || []).length, 3, "配角页 + 秋秋整页 + 悬浮屏");
  assert.equal((app.match(/relsOf: \(\) => rels,/g) || []).length, 2);
});
