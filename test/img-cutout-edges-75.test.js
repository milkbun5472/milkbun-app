// 秋秋小球：圆角方图、带透明边的方图都不能当抠图原样画成一块方（群里 2026-10-18 两回）
const test = require("node:test"), assert = require("node:assert"), vm = require("vm");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
const start = src.indexOf("const _alphaSeen = {};"), end = src.indexOf("if (typeof window !== \"undefined\") window.useImgCutout");
// 照着真的那段跑：假画布按 alpha(x,y) 回像素
function judge(alpha) {
  let result = null, onload = null;
  const box = {
    useState: init => [typeof init === "function" ? init() : init, v => { result = v; }],
    useEffect: fn => fn(),
    Image: function () { const self = this; Object.defineProperty(this, "src", { set() { onload = self.onload; } }); },
    document: { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: (x, y) => ({ data: [0, 0, 0, alpha(x, y)] }) }) }) }
  };
  vm.createContext(box);
  vm.runInContext(src.slice(start, end) + "\nthis.useImgCutout = useImgCutout;", box);
  box.useImgCutout("img" + Math.random());
  onload && onload();
  return result;
}
const W = 24, solidIn = (m, r) => (x, y) => { const dx = Math.max(m - x, x - (W - 1 - m), 0), dy = Math.max(m - y, y - (W - 1 - m), 0); if (dx || dy) return 0; return 255; };
test("抠好的人/物（四周大片透明）原样画", () => {
  const blob = (x, y) => ((x - 12) ** 2 + (y - 13) ** 2 < 49 ? 255 : 0);
  assert.equal(judge(blob), true);
});
test("外头一圈透明边、里面一整块方图：当普通图裁圆", () => assert.equal(judge(solidIn(2)), false));
test("圆角方头像：当普通图裁圆", () => {
  const rr = (x, y) => { const c = Math.min(x, W - 1 - x), d = Math.min(y, W - 1 - y); return (c < 3 && d < 3 && (3 - c) ** 2 + (3 - d) ** 2 > 9) ? 0 : 255; };
  assert.equal(judge(rr), false);
});
test("普通照片（四角实心）裁圆", () => assert.equal(judge(() => 255), false));
