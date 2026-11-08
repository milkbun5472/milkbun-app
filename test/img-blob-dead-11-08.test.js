// 她 2026-11-08 群友的出错记录：30 条全是「asset 没加载成功：<uuid> @blob:…」，同一秒一起没。
// 从 IndexedDB 取出来的 blob，背后是仓库里那份文件：连接一关、系统一回收，这个 blob: 地址就作废，
// 而内存缓存（window.__imgUrlCache）里还好端端挂着它——于是整屏的图同时变裂图，刷新也不回来。
// 所以 <img> 报错时要就地自愈：把作废的那条摘掉、回仓库重取一张、通知界面重画。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const engine = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");

test("blob 地址作废了要摘掉重取，不是只摘不补", () => {
  const f = engine.slice(engine.indexOf("function imgBlobBroken"), engine.indexOf("function resolveImg"));
  assert.ok(f, "没有自愈那一段");
  assert.match(f, /c\.delete\(key\)/, "没把作废的那条从缓存里摘掉");
  assert.match(f, /_imgPull\.failAt\.delete\(key\)/, "没清掉冷却，重取会被挡回去");
  assert.match(f, /_imgPullMiss\(key\)/, "摘了却没回仓库重取——界面只会从裂图变空白");
  assert.match(f, /revokeObjectURL/, "作废的地址没放掉");
});

test("图片报错那一刻就要接上，不是只记一行日志", () => {
  const seg = engine.slice(engine.indexOf('const u = el.src || el.href;'), engine.indexOf('window.addEventListener("unhandledrejection"'));
  assert.match(seg, /indexOf\("blob:"\) === 0/, "没认出 blob 地址");
  assert.ok(seg.indexOf("imgBlobBroken") < seg.indexOf('log("asset"'), "自愈要排在记日志前面");
});

test("重取那条路本来就会通知界面重画（别另造一条）", () => {
  const seg = engine.slice(engine.indexOf("function _imgPullMiss"), engine.indexOf("function imgBlobBroken"));
  assert.match(seg, /img-vault-filled/, "_imgPullMiss 不再通知重画了，自愈也就白做");
});
