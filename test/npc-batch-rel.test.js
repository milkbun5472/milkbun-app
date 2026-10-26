// 一次生成几位配角（她 2026-10-26「这几个 npc 为啥不是单独写是谁的」）：每一位各写各的关系
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");
const src = eng.slice(eng.indexOf("function npcSysOf("), eng.indexOf("async function generateNpc("));
const npcSysOf = new Function(src + "\nreturn npcSysOf;")();

test("几位一起写：每一位一个对象，各自带 relFromHost、relToHost，明说不许共用", () => {
  const sys = npcSysOf({ name: "阿岚", persona: "一个人设" }, "", [], 3);
  assert.match(sys, /每一位都要单独写清TA跟主角色是什么关系/);
  const m = sys.match(/\{"npcs":\[([\s\S]*)\]\}/);
  assert.ok(m, "没摆出几位的格式");
  const objs = JSON.parse("[" + m[1] + "]");
  assert.equal(objs.length, 3, "格式里该摆三位");
  objs.forEach((o, i) => { assert.match(o.relFromHost, new RegExp("第" + (i + 1) + "位")); assert.match(o.relToHost, new RegExp("第" + (i + 1) + "位")); });
});

test("格式里没有内容示范；一位时照旧一个对象", () => {
  const one = npcSysOf({ name: "阿岚" }, "她师姐", [], 1);
  assert.ok(!/副将|死人堆|（如：/.test(one), "又放了内容示范");
  assert.match(one, /\{"name":"这位配角的名字/);
  assert.ok(!/"npcs"/.test(one));
});

test("这两枪都给足 65000", () => {
  assert.match(eng, /content: "生成这 " \+ k \+ " 位配角。" \}\], \{ maxTokens: 65000/);
  assert.match(eng, /content: "生成这位配角。" \}\], \{ maxTokens: 65000/);
});
