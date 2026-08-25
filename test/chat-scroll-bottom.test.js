const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

const pinToBottom = new Function(
  comp.slice(comp.indexOf("function pinToBottom"), comp.indexOf("// 外语气泡：点一下把气泡撑开"))
  + "\nreturn pinToBottom;")();

const mkEl = () => ({
  scrollHeight: 800, scrollTop: 0, isConnected: true, _h: {},
  addEventListener(k, f) { (this._h[k] = this._h[k] || []).push(f); },
  removeEventListener(k, f) { this._h[k] = (this._h[k] || []).filter(x => x !== f); },
  fire(k) { (this._h[k] || []).forEach(f => f()); }
});
const wait = ms => new Promise(r => setTimeout(r, ms));

// 她 2026-08-25：「点进聊天框不是在最下面，还得手动往下翻会才能看到最新消息」。
// 旧写法是「立刻 + 60ms + 280ms」三枪定时器，而头像/自拍/表情/贴纸/聊天背景/
// 网页字体全是异步的：它们加载完内容变高时，那三枪早打完了。

test("图片陆续加载完，还要跟着落到底", async () => {
  const el = mkEl();
  const stop = pinToBottom(el);
  assert.equal(el.scrollTop, 800, "进入就该在底部");
  await wait(120); el.scrollHeight = 1600; await wait(120);
  assert.equal(el.scrollTop, 1600, "80ms 轮询要兜住没有 load 事件的（字体/布局）");
  el.scrollHeight = 2400; el.fire("load"); await wait(20);
  assert.equal(el.scrollTop, 2400, "img 的 load 冒到 capture 上是最准的一枪");
  stop();
});

// ⚠️比落底更重要的是别跟她抢滚动条
test("她一往上翻就立刻停手", async () => {
  const el = mkEl();
  const stop = pinToBottom(el);
  el.fire("touchmove");
  el.scrollTop = 300;
  el.scrollHeight = 2400;      // 之后又有图片加载完
  await wait(200);
  assert.equal(el.scrollTop, 300, "绝不许把她拽回底部");
  stop();
});

test("进入窗口过了就彻底停，别永远钉着", async () => {
  const el = mkEl();
  const stop = pinToBottom(el, 150);
  await wait(220);
  el.scrollHeight = 5000;
  await wait(120);
  assert.equal(el.scrollTop, 800);
  stop();
});

test("卸载后不许留下定时器和监听", async () => {
  const el = mkEl();
  const stop = pinToBottom(el);
  stop();
  Object.keys(el._h).forEach(k => assert.equal(el._h[k].length, 0, k + " 没摘干净"));
  el.scrollHeight = 5000;
  await wait(160);
  assert.equal(el.scrollTop, 800, "停了就不该再动");
});

test("单聊和群聊两处都换成了同一个帮手", () => {
  assert.equal((comp.match(/return pinToBottom\(el\)/g) || []).length, 2);
  // 三枪定时器的老写法不许再有（注释里提它没关系）
  const code = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.doesNotMatch(code, /scrollTop = ref\.current\.scrollHeight; \}, 280\)/);
  // 纯 touchstart（点一下气泡看翻译）不该算「她在翻」
  const fn = comp.slice(comp.indexOf("function pinToBottom"), comp.indexOf("// 外语气泡"))
    .split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.match(fn, /addEventListener\("touchmove"/);
  assert.doesNotMatch(fn, /addEventListener\("touchstart"/);
});
