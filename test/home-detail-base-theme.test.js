const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("小组件换了底色/底图：格子里白字，点开的详情页换回原来的主题", () => {
  const fn = new Function("decorGroundDark", "decorGroundStyle", comp.slice(comp.indexOf("function homeWidgetGroundTheme("), comp.indexOf("\n}\n", comp.indexOf("function homeWidgetGroundTheme(")) + 2) + "\nreturn homeWidgetGroundTheme;")(() => true, () => null);
  const base = { ink: "#111", bg: "#eee", bg2: "#fff", sub: "#333", fog: "#999" };
  const dark = fn(base, "#111111");
  assert.equal(dark.ink, "#fffaf1"); assert.equal(dark.homeBaseTheme, base);
  assert.match(comp, /function HomeDetailLayer\(\{ children \}\)/);
  const i = comp.indexOf("const tb = t.homeBaseTheme || t;"), j = comp.indexOf("document.body)", i);
  assert.ok(i > 0); assert.ok(!/(?<![\w.])t\./.test(comp.slice(i + 40, j)), "天气详情页里还有直接用格子主题 t 的地方");
  assert.match(comp, /ReactDOM\.createPortal\(h\(HomeDetailLayer, null, h\("div", \{ "data-wk": "wheelfull"/);
  assert.match(comp, /const t0 = useTheme\(\), t = t0\.homeBaseTheme \|\| t0;/);
});
