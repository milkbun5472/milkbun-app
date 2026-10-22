// 从半窗里打开的整页叠在半窗上面（群里 2026-10-22「查手机和查找记录点不动」）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const comp = R("components.js"), app = R("app.js");
test("整页问 usePageZ 要层数；半窗那棵树包着 HalfWinLayer", () => {
  assert.match(comp, /const HalfWinLayer = React\.createContext\(false\);/);
  assert.match(comp, /function usePageZ\(z\) \{ return useContext\(HalfWinLayer\) \? 935 \+ Math\.max\(0, z - 240\) : z; \}/);
  assert.match(comp, /"data-page": "1", ref: pageShellPin, style: pageShellStyle\(pageZ, /);
  assert.match(app, /h\(HalfWinLayer\.Provider, \{ value: true \}, mkThread\(\{ key: "half::"/);
  assert.ok(/data-halfwin[\s\S]{0,400}zIndex: 930/.test(app), "半窗还在 930，usePageZ 的 935 得比它高");
});

// 她 2026-10-22「为什么不把这些页面收成公共的」：整页外壳只一份；app 自己的进场动画用专用名 qqIn
test("整页外壳收成 pageShellStyle，动画不再叫 fadeUp", () => {
  assert.match(comp, /function pageShellStyle\(z, extra\) \{ return Object\.assign\(\{ position: "fixed", inset: 0, zIndex: z, animation: "qqIn \.22s ease both" \}, extra \|\| \{\}\); \}/);
  assert.equal((comp.match(/"data-page": "1"/g) || []).length >= 6, true);
  const all = require("fs").readdirSync(require("path").join(__dirname, "..", "js")).filter(f => f.endsWith(".js")).map(f => R(f)).join("\n");
  assert.ok(!/animation: ?"?fadeUp /.test(all), "还有地方用 fadeUp 当自己的动画名，美化一撞就看不见");
  assert.match(require("fs").readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8"), /@keyframes qqIn \{/);
});

// 群里 2026-10-23「这套还是不行点不动」：美化里 [data-wk="pagesheet"]{position:relative !important} 把整页挤到屏幕外——位置用内联 !important 钉死
test("整页外壳挂 pageShellPin：位置和层级钉成内联 !important", () => {
  assert.match(comp, /function pageShellPin\(el\) \{/);
  assert.match(comp, /el\.style\.setProperty\("position", "fixed", "important"\);/);
  const shells = (comp.match(/"data-page": "1", ref: pageShellPin,/g) || []).length;
  assert.equal(shells, (comp.match(/"data-page": "1"/g) || []).length, "有整页外壳没挂上钉子");
});
