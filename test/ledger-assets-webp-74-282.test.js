// 她 2026-09-28：「没办法压缩吗宝宝图片」「家里和公共都要压」。
// 记账那 37 张素材原来是 PNG、一共 19.5MB——记账整页重做（74.229~281）一版版加进来的。
// 换成 WebP：19.5MB → 4.7MB（省 76%）。
// ⚠️不是一刀切有损：逐张把「合成到背景之后」的 PSNR 算出来，≥42dB 才用 q95，
//   过不了线的 10 张退回【像素完全一致】的无损。透明区的 RGB 是随便填的，
//   直接比 RGBA 会得出 13dB 这种吓人的假数字——必须合成到底色上再比。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const dir = path.join(__dirname, "..", "assets", "ledger");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "ledger.js"), "utf8");

test("素材全是 webp，一张 png 都不剩", () => {
  const files = fs.readdirSync(dir);
  const png = files.filter(f => f.endsWith(".png"));
  assert.deepEqual(png, [], "又混进 PNG 了：" + png.join("、"));
  assert.ok(files.filter(f => f.endsWith(".webp")).length >= 30);
});

test("代码里不许再拼 .png", () => {
  assert.equal((src.match(/\.png/g) || []).length, 0, "ledger.js 里还有 .png，线上就是裂图");
  assert.ok(/\.webp/.test(src));
});

test("整包别再胖回去", () => {
  const total = fs.readdirSync(dir).reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0);
  assert.ok(total < 8 * 1024 * 1024, "记账素材又超过 8MB 了（现在 " + (total / 1048576).toFixed(1) + "MB）：新图请照 WebP 出");
});

test("每个被引用的名字都得有真文件（裂图只会在手机上被发现）", () => {
  const have = new Set(fs.readdirSync(dir).filter(f => f.endsWith(".webp")).map(f => f.slice(0, -5)));
  const hard = [...src.matchAll(/assets\/ledger\/([a-z0-9-]+)\.webp/g)].map(m => m[1]);
  const built = [...src.matchAll(/(?:pic|deco)\(\s*"([a-z0-9-]+)"/g)].map(m => m[1]);
  const miss = [...new Set([...hard, ...built])].filter(n => !have.has(n));
  assert.deepEqual(miss, [], "这些名字没有对应文件：" + miss.join("、"));
});

test("换过图就要换缓存号，不然手机拿的还是旧的", () => {
  const vs = [...new Set([...src.matchAll(/"\?v=(\d+)"/g)].map(m => m[1]))];
  assert.equal(vs.length, 1, "几个前缀的版本号不一致：" + vs.join("/"));
  assert.ok(Number(vs[0]) >= 282);
});
