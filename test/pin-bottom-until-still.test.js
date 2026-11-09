// 她 2026-11-02：「弹窗消息点进去会跳到很上面」——刚进来时钉到内容不再长（停长 1.5 秒才撒手，最多 8 秒），她一翻就停
const test = require("node:test"), assert = require("node:assert/strict");
const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
const pinToBottom = new Function(c.slice(c.indexOf("function pinToBottom(el, ms) {"), c.indexOf("// 外语气泡：点一下把气泡撑开")) + "; return pinToBottom;")();
const mkEl = () => { const L = {}; return { isConnected: true, scrollHeight: 1000, scrollTop: 0, L,
  addEventListener: (k, f) => { (L[k] = L[k] || []).push(f); }, removeEventListener: () => {} }; };
test("内容还在长就一直钉：过了 2.5 秒还在长照样落底", t => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"] });
  const el = mkEl(); pinToBottom(el);
  // TA 一条条在发：每 1.2 秒长一截
  [1200, 1200, 1200].forEach((ms, k) => { t.mock.timers.tick(ms); el.scrollHeight = 1200 + k * 200; });
  t.mock.timers.tick(100);
  assert.equal(el.scrollTop, 1600, "3.6 秒时还在长，照样落底（原来 2.5 秒就撒手，这一截会把她顶上去）");
  t.mock.timers.tick(1700); el.scrollHeight = 2000; t.mock.timers.tick(100);
  assert.equal(el.scrollTop, 1600, "停长 1.5 秒以后撒手，不再拽");
});
test("她一翻就停", t => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"] });
  const el = mkEl(); pinToBottom(el);
  t.mock.timers.tick(200); el.L.touchmove.forEach(f => f()); el.scrollTop = 300; el.scrollHeight = 1500; t.mock.timers.tick(200);
  assert.equal(el.scrollTop, 300);
});
