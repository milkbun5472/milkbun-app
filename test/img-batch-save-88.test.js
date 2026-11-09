// 一次存好多张进相册（她 2026-10-31）：公共那一份 + 五处都接上
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const vm = require("vm");
const rd = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const eng = rd("engine.js");

function cut(src, a, b) { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, "抠不出 " + a); return src.slice(i, j); }

function load(ua, opts) {
  const shared = [], clicks = [];
  const code = cut(eng, "async function _imgBlobOf(", "if (typeof window !== \"undefined\") window.saveImgsBatch") +
    "\nconst _isAndroid = () => /android/i.test(navigator.userAgent);\n" + cut(eng, "async function saveFile(", "\n}\n") + "\n}\n";
  const ctx = {
    navigator: { userAgent: ua, share: async p => { shared.push(p); if (opts && opts.cancel) { await new Promise(r => setTimeout(r, 1100)); const e = new Error("x"); e.name = "AbortError"; throw e; } },
      canShare: p => p.files.length <= ((opts && opts.cap) || 99) },
    idbImgGet: async k => k === "img_gone" ? null : new Blob(["x" + k], { type: "image/png" }),
    imgVaultFetchBlob: async k => new Blob(["v"], { type: "image/jpeg" }),
    dataUrlToBlob: () => null, fetch: async () => ({ ok: false }),
    File, Blob, URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} }, setTimeout,
    document: { createElement: () => ({ style: {}, click() { clicks.push(this.download); }, remove() {} }), body: { appendChild() {} } }
  };
  vm.createContext(ctx); vm.runInContext(code + "\nthis.saveImgsBatch = saveImgsBatch; this.saveImgOriginal = saveImgOriginal;", ctx);
  return { ctx, shared, clicks };
}
const items = n => Array.from({ length: n }, (_, i) => ({ id: "a" + i, ref: "img_" + i, name: "照相馆" }));

test("iPhone：一个面板放全部，不带 title（带了 iOS 只给「存储到文件」）", async () => {
  const { ctx, shared } = load("iPhone");
  const r = await ctx.saveImgsBatch(items(5));
  assert.strictEqual(r.n, 5); assert.strictEqual(r.via, "share"); assert.strictEqual(shared.length, 1);
  assert.strictEqual(shared[0].files.length, 5); assert.ok(!("title" in shared[0]));
  assert.notStrictEqual(shared[0].files[0].name, shared[0].files[1].name);
});
test("超过 30 张：这一面板 30 张，剩下的退回去等她再点", async () => {
  const { ctx, shared } = load("iPhone");
  const r = await ctx.saveImgsBatch(items(34));
  assert.strictEqual(shared[0].files.length, 30); assert.strictEqual(r.left.length, 4);
});
test("取不到图的跳过并记数；单张存图也走同一条", async () => {
  const { ctx, shared } = load("iPhone");
  const r = await ctx.saveImgsBatch([{ id: 1, ref: "img_gone" }, { id: 2, ref: "img_1" }]);
  assert.strictEqual(r.n, 1); assert.strictEqual(r.miss, 1);
  assert.strictEqual(await ctx.saveImgOriginal("img_2", "照片"), true); assert.ok(!("title" in shared[1]));
});
test("安卓：不弹分享面板，一张张下载", async () => {
  const { ctx, shared, clicks } = load("Linux; Android 14");
  const r = await ctx.saveImgsBatch(items(3));
  assert.strictEqual(shared.length, 0); assert.strictEqual(clicks.length, 3); assert.strictEqual(r.via, "download");
});
test("她在面板上点了取消：什么都不算存了", async () => {
  const { ctx } = load("iPhone", { cancel: 1 });
  const r = await ctx.saveImgsBatch(items(2));
  assert.strictEqual(r.via, "cancel"); assert.strictEqual(r.n, 0);
});
test("五处都接上公共那一份，不各写一条", () => {
  for (const f of ["stamps.js", "shike.js", "phone-ui.js", "screens.js"]) {
    const s = rd(f); assert.match(s, /const imgPick = useImgPick\(\);/, f); assert.match(s, /h\(ImgPickBar, \{ pick: imgPick/, f); assert.match(s, /h\(ImgPickMark, \{ pick: imgPick/, f);
  }
  const c = rd("components.js");
  assert.strictEqual((c.match(/saveChatSelImgs\(messages, selIds/g) || []).length, 2, "单聊群聊各一个「存图」");
  assert.match(c, /function ImgPickBar\(/); assert.match(c, /window\.saveImgsBatch\(items\)/);
});

// 长按别太容易触发（她 2026-11-02：「我只是想按着下滑也会」）：700ms、页面一滚就作废、容差 8px
{
  const assert = require("node:assert/strict");
  const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
  const seg = c.slice(c.indexOf("function useImgPick()"), c.indexOf("function useImgPick()") + 2500);
  assert.match(seg, /\}, 700\); \};/);
  assert.match(seg, /window\.addEventListener\("scroll", onScroll, \{ capture: true, passive: true \}\)/);
  assert.match(seg, /const onScroll = \(\) => stop\(\);/);
  assert.match(seg, /p\.clientY - f\.y\) > 8\) stop\(\)/);
}
