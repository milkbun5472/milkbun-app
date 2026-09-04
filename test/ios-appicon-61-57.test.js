// v61.56 她 2026-09-03 起连报「run 了 Xcode 重装还是没变」。
// 病因：她手机上那个是【原生壳】，图标读的是 Assets.xcassets/AppIcon.appiconset 里的
// 那九个文件，跟网页的 manifest 一点关系都没有。v61.54 我只往仓库根目录 assets/ 放了
// 一张 1024——那是个 Xcode 从来不看的地方；而且就算放对了，主屏上显示的是 120/180，
// 光换 1024 也不会变。所以这条钉的是【整套一起换，一张都不许掉队】。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const DIR = "tools/ios-shell/LisaPhone/LisaPhone/Assets.xcassets/AppIcon.appiconset";
const named = () => JSON.parse(fs.readFileSync(path.join(DIR, "Contents.json"), "utf8")).images;

test("Contents.json 点名的每一个文件都真的在", () => {
  const imgs = named().filter(i => i.filename);
  assert.ok(imgs.length >= 9, "尺寸少了，主屏那一档（120/180）尤其不能缺");
  imgs.forEach(i => assert.ok(fs.existsSync(path.join(DIR, i.filename)), "少了 " + i.filename));
});

test("一张都不许带 alpha：透明处会被渲染成纯黑，上架也会被打回", () => {
  for (const i of named()) {
    if (!i.filename) continue;
    const d = fs.readFileSync(path.join(DIR, i.filename));
    assert.equal(d.readUInt32BE(12), 0x49484452, i.filename + " 不是 PNG");
    // IHDR 第 9 字节＝color type；2＝真彩色无 alpha，6＝RGBA
    assert.equal(d[25], 2, i.filename + " 的 color type 是 " + d[25] + "，带 alpha 了");
  }
});

test("宽高跟 Contents.json 里写的尺寸×倍率对得上", () => {
  for (const i of named()) {
    if (!i.filename) continue;
    const want = Math.round(parseFloat(i.size) * parseInt(i.scale));
    const d = fs.readFileSync(path.join(DIR, i.filename));
    assert.equal(d.readUInt32BE(16), want, i.filename + " 宽是 " + d.readUInt32BE(16) + "，该是 " + want);
    assert.equal(d.readUInt32BE(20), want, i.filename + " 高不对");
  }
});

test("仓库根目录不许再留一张 Xcode 看不见的 AppIcon", () => {
  assert.ok(!fs.existsSync("assets/AppIcon-1024.png"),
    "assets/ 不是 Xcode 找图标的地方——放这儿等于没换，v61.54 就是这么错的");
});
