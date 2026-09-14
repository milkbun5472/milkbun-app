// 她 2026-09-14：「为啥有人网易云加了 cookies 还是不行，明明有 VIP」。
//
// 网易云是按【请求的来源 IP】判版权的，而公共 API 实例多半部署在海外——
// 于是账号真有 VIP，回来的照样是 30 秒试听或者干脆没有地址。
// 接口本身留了 realIP 这一格（标准参数），带上就当作从那儿来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const ms = fs.readFileSync(path.join(root, "js/music-source.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

test("realIP 只有一份，两处都从它要", () => {
  assert.match(ms, /const REAL_IP = "\d+\.\d+\.\d+\.\d+";/);
  assert.match(ms, /return \{ request, cover, realIP \};/);
  // 搜索、歌词那条链
  assert.match(ms, /extra\.push\("realIP=" \+ REAL_IP\);/);
  // 播放地址那一枪（app.js 自己 fetch，因为要 level 和回退）
  assert.match(app, /MusicSource\.realIP\(\) : "";/);
  assert.ok(!/realIP=\d+\.\d+\.\d+\.\d+/.test(app), "app.js 里又写死了一个 IP");
});

test("播放地址那两条路（v1 和回退）都要带上", () => {
  const seg = app.slice(app.indexOf("const cval = normCookie();"), app.indexOf("const cval = normCookie();") + 1400);
  assert.equal((seg.match(/\+ ck \+ rip \+/g) || []).length, 2, "v1 带了、回退那条漏了（或者反过来）");
  // Cookie 那一层没动
  assert.match(app, /if \(!\/MUSIC_U\\s\*=\/i\.test\(c\)\) c = "MUSIC_U=" \+ c\.replace/);
});

test("搜索那条不带 cookie 的规矩没被破坏", () => {
  // 搜索不该把账号 Cookie 发出去，这条是原来就有的
  assert.match(ms, /if \(config\.cookie && !path\.startsWith\("\/search\?"\)\) extra\.push\("cookie="/);
});
