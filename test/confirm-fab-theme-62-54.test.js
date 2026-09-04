// v62.54 审美审计还债②之二：两处写死的白（tabs-not-plain-pills.md 那条
// 「深色主题里绝不许写死 #fff」，v59.62 白底白字就是这么来的）。
// ① ConfirmDialog 的确认键：底是 t.ink / t.accent，字原来写死白——
//    深色主题里 t.ink 本身是浅色，白字压上去整颗键读不出字。
// ② 日历右下 FAB 菜单：底原来写死白，里面的字是 t.ink——
//    深色主题里等于浅字压白底，菜单三行全糊。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };

test("确认弹窗的确认键：字色跟着主题走，不写死白", () => {
  const seg = cut(comp, "function ConfirmDialog({", "\n}\n");
  // 键面还是那两种底：danger 用强调色，平时用墨色
  assert.match(seg, /background: danger \? t\.accent : t\.ink/, "确认键的底变了，先弄清为什么");
  // 字色是 t.bg2——跟日历 FAB 那颗 ＋（t.ink 底配 t.bg2 字）同一套写法
  assert.match(seg, /fontWeight: 700, color: t\.bg2, background: danger/, "确认键的字色不是 t.bg2");
  assert.ok(!/color: "#fff"/.test(seg), "确认键的字色又写死回白了");
});

test("日历 FAB 菜单：底色跟着主题走，不写死白", () => {
  const seg = cut(comp, 'fab && h("div"', "setFab(v => !v)");
  assert.match(seg, /background: t\.bg2, borderRadius: 16/, "菜单的底不是 t.bg2");
  assert.ok(!/background: "#fff"/.test(seg), "菜单的底又写死回白了");
  // 菜单里的字本来就是 t.ink、分隔线是 t.line——底换成 t.bg2 之后整套才是一个主题的
  assert.match(seg, /color: t\.ink, padding: "13px 16px"/, "菜单行的字色变了，先弄清为什么");
});
