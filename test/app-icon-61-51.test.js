// v61.51 她 2026-09-04 换了 app 图标，然后报「这个黑色背景做图标会不会有点丑」。
//
// 病因：她给的那张原图【四角是不透明的黑】（0,0,0,255），不是透明。
// 所以「裁掉透明边」什么都没裁掉，垫在底下的纸色也被整块盖住——出来就是黑角图标。
// 办法：往里裁一圈，把那个圆角方块的四段弧整个切掉，只留内接的正方形；
// 再兜一道，近黑的像素一律换成纸色。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

const png = f => {
  const b = fs.readFileSync(f);
  assert.equal(b.slice(1, 4).toString(), "PNG", f + " 不是 PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), kb: b.length / 1024 };
};

test("三个尺寸都在，而且是方的", () => {
  for (const [f, n] of [["icon-192.png", 192], ["icon-512.png", 512], ["icon-512-maskable.png", 512]]) {
    const i = png(f);
    assert.equal(i.w, n, f + " 宽不对");
    assert.equal(i.h, n, f + " 高不对");
  }
});

test("manifest 指到这三张，maskable 用的是留了安全区的那张", () => {
  const m = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  const by = p => m.icons.filter(x => x.purpose === p).map(x => x.src);
  assert.deepEqual(by("any").sort(), ["icon-192.png", "icon-512.png"]);
  // maskable 会被裁成圆形，得用另外那张留了一圈边的——共用 512 的话四角的叶子会被啃掉
  assert.deepEqual(by("maskable"), ["icon-512-maskable.png"]);
  m.icons.forEach(x => assert.ok(fs.existsSync(x.src), "manifest 指了不存在的 " + x.src));
});

test("换图标必须同时换 Service Worker 的壳缓存 key", () => {
  // 静态 png 是【缓存优先】的，文件名又没变——不换 key 的话旧图标会一直被吐出来
  const sw = fs.readFileSync("sw.js", "utf8");
  const idx = fs.readFileSync("index.html", "utf8");
  const rsc = fs.readFileSync("rescue.html", "utf8");
  const n = sw.match(/SW_VERSION = "archive-sw-v(\d+)"/)[1];
  assert.ok(Number(n) >= 6, "SW 版本没往上走，旧图标会留在壳缓存里");
  assert.match(idx, new RegExp('sw\\.js\\?v=' + n + '"'), "index 里注册的版本没跟上");
  assert.match(rsc, new RegExp('sw\\.js\\?v=' + n + '"'), "救援页注册的版本没跟上");
});

test("apple-touch-icon 带版本号", () => {
  // iOS 会把已经加到主屏的图标钉死（只能删了重加），但带上版本号至少能让
  // 【重新添加】和浏览器标签拿到新的那张。
  const idx = fs.readFileSync("index.html", "utf8");
  assert.match(idx, /<link rel="apple-touch-icon" href="icon-192\.png\?v=[0-9.]+" \/>/);
});
