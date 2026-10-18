// 每一页最外层都要有挂点，挂点都要登记（她 2026-10-18：「为啥每次让你们去找还有没有其他页面，说都弄好了，其实还是找出来一堆」）
//   以前是人眼翻有 data-wk 的地方——没写的那一层根本翻不到。这条测试反过来数：
//   凡是整页那一格（className 里 h-full / fixed inset-0 + flex-col 的 div），props 里没有 data-wk 就红。
//   新开页面忘了写，当场拦住。
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "../js");
// 不挂的：主屏小组件（施工规则/home-screen-layout.md：主屏一个都不许改）、崩溃兜底页
const SKIP = new Set(["app.js:ScreenBoundaryClass", "components.js:WeatherWidget", "components.js:WheelFull",
  "components.js:WheelWidget", "components.js:MuyuWidget", "recent-widget.js:RecentWidget"]);
function pageRoots() {
  const out = [];
  for (const f of fs.readdirSync(DIR).filter(x => x.endsWith(".js"))) {
    const s = fs.readFileSync(path.join(DIR, f), "utf8");
    const re = /(?:\bh|React\.createElement)\(\s*"div",\s*\{/g; let m;
    while ((m = re.exec(s))) {
      const ls = s.lastIndexOf("\n", m.index) + 1;
      if (/^\s*\/\//.test(s.slice(ls, m.index))) continue;
      let i = m.index + m[0].length - 1, d = 0, j = i, q = null;
      for (; j < s.length; j++) {
        const c = s[j];
        if (q) { if (c === "\\") { j++; continue; } if (c === q) q = null; continue; }
        if (c === '"' || c === "'" || c === "`") { q = c; continue; }
        if (c === "{") d++; else if (c === "}") { d--; if (!d) break; }
      }
      const props = s.slice(i, j + 1), cm = props.match(/className:\s*"([^"]*)"/);
      if (!cm) continue;
      const cls = cm[1];
      if (!((/(^|\s)h-full(\s|$)/.test(cls) || /fixed inset-0/.test(cls)) && /flex-col/.test(cls))) continue;
      const fm = [...s.slice(0, m.index).matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(/g)].pop();
      out.push({ at: f + ":" + s.slice(0, m.index).split("\n").length, key: f + ":" + (fm ? fm[1] : "?"), hooked: /"data-wk"\s*:/.test(props) });
    }
  }
  return out;
}
test("每一页最外层都有挂点", () => {
  const roots = pageRoots();
  assert.ok(roots.length > 100, "一个整页都没数到，扫描坏了");
  const miss = roots.filter(r => !r.hooked && !SKIP.has(r.key)).map(r => r.at + " " + r.key);
  assert.deepStrictEqual(miss, [], "这些整页最外层没有 data-wk，主题 CSS 和秋秋抓不住");
});
test("用到的挂点全都登记在主题工作台名单里", () => {
  const ts = fs.readFileSync(path.join(DIR, "theme-studio.js"), "utf8");
  const reg = new Set([...ts.matchAll(/\[\s*"([a-z0-9_-]+)"\s*,\s*"/gi)].map(m => m[1]));
  const used = new Set();
  for (const f of fs.readdirSync(DIR).filter(x => x.endsWith(".js")))
    for (const m of fs.readFileSync(path.join(DIR, f), "utf8").matchAll(/"data-wk":\s*"([a-z0-9_-]+)"/gi)) used.add(m[1]);
  assert.deepStrictEqual([...used].filter(x => !reg.has(x)), [], "这些挂点没登记，秋秋不知道有它");
});
