// 心声卡自己写：模板填空、自己加的栏只收定过的、每轮格式要求只在加了栏时出现（群里 2026-10-18）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const comp = read("components.js"), app = read("app.js");
const slice = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
const helpers = slice(comp, "const STATE_TPL_MAX_FIELDS", "function StateTplCard");
const api = new Function("loadJSON", helpers + "; return { cleanStateTpl, stateTplFor, pickStateExtra, stateExtraSpec, stateTplVars, stateTplFill };")(() => null);

test("只收她定过的栏，多的、空的扔掉；最多 5 栏", () => {
  const tpl = api.cleanStateTpl({ html: "", fields: [{ name: "小算盘", desc: "心里在打的算盘" }, { name: "小算盘", desc: "重复" }, { name: "", desc: "x" }] });
  assert.equal(tpl.fields.length, 1);
  assert.deepEqual(api.pickStateExtra(tpl, { 小算盘: " 想约她 ", 别的: "不要" }), { 小算盘: "想约她" });
  assert.equal(api.pickStateExtra(tpl, { 小算盘: "null" }), null);
  const many = api.cleanStateTpl({ fields: Array.from({ length: 9 }, (_, i) => ({ name: "f" + i })) });
  assert.equal(many.fields.length, 5);
  assert.equal(api.cleanStateTpl({ html: "  ", fields: [] }), null);
});

test("没加栏就不往每轮格式里塞东西；加了就点名每一栏", () => {
  assert.equal(api.stateExtraSpec(null), "");
  assert.equal(api.stateExtraSpec({ html: "<b>x</b>", fields: [] }), "");
  assert.match(api.stateExtraSpec({ fields: [{ name: "小算盘", desc: "心里的算盘" }] }), /extra: object[\s\S]*「小算盘」＝心里的算盘/);
});

test("填空会转义，window.STATE 不会把 script 提前关上", () => {
  const vars = api.stateTplVars({ name: "莫弈" }, { thought: "<i>想她</i>", extra: { 小算盘: "a&b" } }, { label: "平静" }, 60);
  const out = api.stateTplFill("<p>{{心声}}|{{小算盘}}|{{好感}}|{{没这栏}}</p>", vars, { now: vars, history: [{ 心声: "</script>" }] });
  assert.ok(out.includes("<p>&lt;i&gt;想她&lt;/i&gt;|a&amp;b|60|</p>"));
  assert.ok(!/<\/script>"/.test(out));
});

test("接线：设置存得住、每轮要、回来存、卡上用", () => {
  assert.match(app, /stateTpl: typeof cleanStateTpl === "function" \? cleanStateTpl\(s\.stateTpl\) : null/);
  assert.match(app, /stateExtraSpec\(stateTplFor\(settingsFor\(charId\)\)\)/);
  assert.match(app, /st\.extra = pickStateExtra\(_tp, parsed\.extra\)/);
  assert.match(app, /tpl: roomCard \|\| typeof stateTplFor !== "function" \? null : stateTplFor\(settingsFor\(scc\.id\)\)/);
  assert.match(comp, /h\(StateTplCard, \{ tpl, character, state, mood: dm, affinity: aff, history: hist \}\)/);
  assert.match(comp, /stateTpl: cleanStateTpl\(stateTpl\),/);
});
