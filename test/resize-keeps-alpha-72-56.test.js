// 她 2026-09-22 转来的反馈：「这个保存了怎么还是黑色的」「换了一个样式的卡片又变成黑色的了」。
// 她拿的是手账素材那种抠好的透明底 PNG。resizeImageFile 最后一步是 toDataURL("image/jpeg")，
// **JPEG 没有透明通道**——画布上透明的地方编码完变成纯黑，存进去就是一块黑方块。
// 贴纸 v63.88 单开了一条保 alpha 的路，可全 app 还有二十多处在走 JPEG 那条；
// 「记得传保透明」是人的事，二十多处里总有忘的那几处，所以判据换成【这张图身上有没有 alpha】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const fn = name => { const i = engine.indexOf("function " + name + "("); return engine.slice(i, engine.indexOf("\n}", i) + 2); };

// 桩照【真的调用方】写：调用方给的是一个 File，拿回来的是一个 dataURL 字符串。
// alpha 参数决定这张图有没有透明像素；throws 模拟浏览器不让读画布。
function run(fnName, alpha, opts) {
  opts = opts || {};
  const calls = [];
  const ctx = {
    Promise, Math, Error, setTimeout,
    FileReader: function () { this.readAsDataURL = () => this.onload({ target: { result: "data:x" } }); },
    window: { Image: function () { setTimeout(() => this.onload(), 0); this.width = 1800; this.height = 900; } },
    document: { createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({
        drawImage: () => {},
        getImageData: (x, y, w, h) => {
          if (opts.throws) throw new Error("tainted");
          const d = new Array(w * h * 4).fill(255);
          if (alpha) d[3] = 0;
          return { data: d };
        }
      }),
      toDataURL(type, q) { calls.push([type, q, this.width, this.height]); return type; }
    }) }
  };
  vm.createContext(ctx);
  vm.runInContext([fn("_resizeImageCore"), fn("_canvasHasAlpha"), fn("resizeImageAlpha"), fn("resizeImageFile")].join("\n")
    + "\nthis.go = (n, f, d, q) => (n === 'alpha' ? resizeImageAlpha(f, d) : resizeImageFile(f, d, q));", ctx);
  return ctx.go(fnName, {}, opts.maxDim || 900, 0.84).then(out => ({ out, calls }));
}

test("有透明像素就留 PNG，没有才压 JPEG", async () => {
  assert.equal((await run("file", true)).out, "image/png", "透明底的图又被压成一块黑了");
  assert.equal((await run("file", false)).out, "image/jpeg", "不透明的图也走 PNG，二十多处的体积一起翻几倍");
});

test("读不出画布就退回 JPEG，不是宁可全 PNG", async () => {
  assert.equal((await run("file", true, { throws: true })).out, "image/jpeg");
});

test("贴纸那条不看脸色：不问有没有 alpha，一律 PNG", async () => {
  assert.equal((await run("alpha", false)).out, "image/png");
});

test("缩图只有这一个核，两条路都从它长出来", () => {
  assert.match(engine, /function resizeImageAlpha\(file, maxDim = 360\) \{ return _resizeImageCore\(file, maxDim, 1, true\); \}/);
  assert.match(engine, /function resizeImageFile\(file, maxDim = 400, q = 0\.85\) \{ return _resizeImageCore\(file, maxDim, q, false\); \}/);
  assert.equal((engine.match(/toDataURL\(/g) || []).length, 1, "又有第二处自己编码了");
  assert.ok(!/fillStyle|fillRect/.test(fn("_resizeImageCore")), "铺了底色＝自己把透明去掉了");
});

test("长边照旧缩到 maxDim，短边按比例", async () => {
  // ⚠️原来 resizeImageFile 是 width>height 分两支写的，合并时最容易把比例算反：
  //   1800×900 缩到 900，结果必须是 900×450。
  const { calls } = await run("file", false, { maxDim: 900 });
  assert.deepEqual(calls[0].slice(2), [900, 450]);
});
