// 列表滚到哪儿记住，点进去再出来回原位（群友 2026-10-31：查手机微信、相册、他赞过的）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
const i = core.indexOf("const _keepScrollMem = {};");
const ctx = { requestAnimationFrame: f => f() }; vm.createContext(ctx);
vm.runInContext(core.slice(i) + ";this.keepScroll = keepScroll;", ctx);
const fakeEl = () => { const ls = []; return { isConnected: true, scrollTop: 0, addEventListener: (n, f) => ls.push(f), fire() { ls.forEach(f => f()); } }; };
test("滚过的位置记住，同一个 key 的新列表回到那儿", () => {
  const a = fakeEl(); ctx.keepScroll("k1")(a); a.scrollTop = 640; a.fire();
  const b = fakeEl(); ctx.keepScroll("k1")(b);
  assert.equal(b.scrollTop, 640);
  const c = fakeEl(); ctx.keepScroll("k2")(c);
  assert.equal(c.scrollTop, 0);
});
test("原来挂着的 ref 照样拿得到元素", () => {
  const r = { current: null }, e = fakeEl(); ctx.keepScroll("k3", r)(e);
  assert.equal(r.current, e);
});
test("查手机微信、相册、他赞过的都接上了", () => {
  const ui = fs.readFileSync(path.join(__dirname, "..", "js", "phone-ui.js"), "utf8");
  assert.match(ui, /ref: keepScroll\("phone:wechat:"/);
  assert.match(ui, /ref: keepScroll\("phone:album:"/);
  assert.match(ui, /ref: keepScroll\("phone:liked:"/);
});
