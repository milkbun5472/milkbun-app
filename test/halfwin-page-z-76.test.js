// 从半窗里打开的整页叠在半窗上面（群里 2026-10-22「查手机和查找记录点不动」）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const comp = R("components.js"), app = R("app.js");
test("整页问 usePageZ 要层数；半窗那棵树包着 HalfWinLayer", () => {
  assert.match(comp, /const HalfWinLayer = React\.createContext\(false\);/);
  assert.match(comp, /function usePageZ\(z\) \{ return useContext\(HalfWinLayer\) \? 935 \+ Math\.max\(0, z - 240\) : z; \}/);
  assert.match(comp, /zIndex: pageZ, background: t\.bg, animation: "fadeUp \.22s ease both"/);
  assert.match(app, /h\(HalfWinLayer\.Provider, \{ value: true \}, mkThread\(\{ key: "half::"/);
  assert.ok(/data-halfwin[\s\S]{0,400}zIndex: 930/.test(app), "半窗还在 930，usePageZ 的 935 得比它高");
});
