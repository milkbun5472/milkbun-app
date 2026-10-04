// 动态形象库（她 2026-10-05）：一个角色一本，平时 / 专注时 / 通话时各一格；旧番茄钟视频自动搬家
const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "../js/video-api.js"), "utf8");
function load(seed) {
  const store = Object.assign({}, seed || {});
  const ctx = { window: {}, cleanBaseUrl: v => String(v || ""), loadJSON: (k, d) => (store[k] ?? d), saveJSON: (k, v) => { if (v == null) delete store[k]; else store[k] = JSON.parse(JSON.stringify(v)); return true; },
    setTimeout, clearTimeout, AbortController, DOMException, URL, Blob, Uint8Array, TypeError, console };
  vm.createContext(ctx); vm.runInContext(src, ctx); return { api: ctx.window.VideoApi, store };
}
test("旧的番茄钟视频搬成「专注时」那格，旧键和旧任务名一起改掉", () => {
  const { api, store } = load({ x_pomodoro_media: { c1: { videoRef: "pvideo_1", imageRef: "iv_a" } }, x_pomodoro_video_jobs: { c2: { taskId: "9" } } });
  assert.equal(api.slotFor("c1", "focus").videoRef, "pvideo_1");
  assert.equal(store.x_pomodoro_media, undefined, "旧键没删，同一份东西活在两处");
  assert.ok(store.x_pomodoro_video_jobs["c2|focus"], "旧任务记录没改名");
});
test("哪格空着就退回「平时」，「平时」也空就是 null（画头像）", async () => {
  const { api } = load({ x_charMotion: { c1: { default: { imageRef: "iv_d" } } } });
  assert.equal(api.slotFor("c1", "call").imageRef, "iv_d");
  assert.equal(api.slotFor("c9", "call"), null);
  await api.useImage("c1|call", "iv_call");
  assert.equal(api.slotFor("c1", "call").imageRef, "iv_call", "只挂图（纯图陪伴）没生效");
  api.copySlot("c1|default", "c1|focus");
  assert.equal(api.slotOwn("c1", "focus").imageRef, "iv_d");
});
test("视频进「导出全部数据」，导入只增量写回", () => {
  const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  assert.match(app, /videos: videos/, "备份里没带视频");
  assert.match(app, /window\.VideoApi\.restoreVideo\(k, b\)/, "导入没写回视频");
});
test("番茄钟和视频通话都从同一本库取，播放首尾淡接", () => {
  const pom = fs.readFileSync(path.join(__dirname, "../js/pomodoro.js"), "utf8"), comp = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
  assert.match(pom, /VideoApi\.slotFor\(c\.id, "focus"\)/);
  assert.match(comp, /window\.VideoApi\.slotFor\(c\.id, "call"\)/);
  assert.match(src, /const SEAM = /);
});
test("动态形象里生新图也带外貌原文：参考照锁不住时靠文字兜底", () => {
  assert.match(src, /的外貌（务必贴合）：" \+ look/);
});
