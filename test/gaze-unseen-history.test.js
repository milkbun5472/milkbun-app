const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// gaze.js 是个 IIFE，挂在 window 上；给它一套最小的桩就能把纯逻辑跑起来
function loadGaze() {
  const store = {};
  const ctx = {
    React: { useState: () => [null, () => {}] },
    ReactDOM: { createPortal: () => null },
    document: { body: {} },
    F_BODY: "", F_DISPLAY: "",
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "gaze.js"), "utf8"), ctx);
  return { G: ctx.Gaze, store };
}

// 她 2026-08-27：「可以有变化的时候红点提示」
test("角色改过、她还没看 → 算未读；看过就灭", () => {
  const { G } = loadGaze();
  assert.equal(G.unseenCount("c1"), 0, "空卡不该有红点");
  G.apply("c1", "me", "person", "她比看起来能扛");
  assert.equal(G.unseenKeys("c1").join(","), "me.person");
  G.markSeen("c1", "me.person");
  assert.equal(G.unseenCount("c1"), 0, "看过就该灭");
  // 他又改了同一块 → 再次亮起。这一条是靠「改写即清已读」保证的，不是靠比时间戳：
  // 同一毫秒内改写会让 ts 和 seen 相等，光比大小红点就永远亮不起来。
  G.apply("c1", "me", "person", "她比看起来能扛，但扛完会自己缩起来");
  assert.equal(G.unseenKeys("c1").join(","), "me.person", "改了就该重新亮");
});

test("只亮改过的那一块，别的块不受连累", () => {
  const { G } = loadGaze();
  G.apply("c2", "me", "person", "甲");
  G.apply("c2", "us", "what", "乙");
  G.markSeen("c2", "me.person");
  assert.equal(G.unseenKeys("c2").join(","), "us.what");
});

test("已读只存本机：不进印象卡，也不许用会云同步的 x_ 前缀", () => {
  const { G, store } = loadGaze();
  G.apply("c3", "me", "soft", "怕被丢下");
  G.markSeen("c3", "me.soft");
  assert.ok(store.lisa_gaze_seen_v1, "该有自己的一份");
  assert.ok(!Object.keys(store).some(k => /^x_.*[sS]een/.test(k)), "别用 x_ 前缀——那个会被云同步捡走");
  assert.ok(!/seen/i.test(store.x_gaze || ""), "印象卡里不该出现已读字段");
});

// 她 2026-08-27：「怎么样收纳可以看到每一种以前写过的历史」
test("历次改写：现行版 + 全部旧版，按时间倒序摊平", () => {
  const { G } = loadGaze();
  G.apply("c4", "me", "person", "第一版");
  G.apply("c4", "me", "person", "第二版");
  G.apply("c4", "us", "what", "关系第一版");
  const revs = G.revisions("c4");
  assert.equal(revs.length, 3, "两块共三版");
  assert.equal(revs.filter(x => x.now).length, 2, "每块的现行版各一条");
  assert.ok(revs.every((x, i) => i === 0 || revs[i - 1].ts >= x.ts), "要按时间倒序");
  assert.ok(revs.some(x => x.text === "第一版" && !x.now), "旧版要留着");
});

test("界面：红点在她点进去之前就看得见，展开信纸就算看过", () => {
  const gaze = fs.readFileSync(path.join(__dirname, "..", "js", "gaze.js"), "utf8");
  const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(comp, /window\.Gaze\.unseenCount\(character\.id\) > 0/, "「Ta 眼里」那个页签上没有红点");
  assert.match(gaze, /const openBlock = k => \{ setOpenK\(k\); markSeen\(charId, k\); setSeenTick/, "展开信纸没标已读");
  assert.match(gaze, /unseen\.has\(fk\) \? dot\(/, "卡片上没红点");
  assert.match(gaze, /\[\.\.\.unseen\]\.some\(x => x\.indexOf\(k \+ "\."\) === 0\)/, "关于我/关于我们 那两颗上没红点");
});

test("界面：一个总入口能看全部历史，单块历史不再只给 6 条", () => {
  const gaze = fs.readFileSync(path.join(__dirname, "..", "js", "gaze.js"), "utf8");
  assert.match(gaze, /他从前都怎么写的 · 共 " \+ revs\.length \+ " 版/, "没有总入口");
  assert.ok(!/filter\(x => x\.k === openK\)\.slice\(0, 6\)/.test(gaze), "单块历史还卡在 6 条");
  assert.match(gaze, /改过 " \+ box\.hist\.filter\(x => x\.k === openK\)\.length \+ " 次/, "没写改过几次");
});

test("改写即清已读——别靠时间戳，同一毫秒会失效", () => {
  const gaze = fs.readFileSync(path.join(__dirname, "..", "js", "gaze.js"), "utf8");
  assert.match(gaze, /if \(mine && mine\[k\] != null\) \{ delete mine\[k\]/, "apply 里没清这一块的已读");
  assert.match(gaze, /同一毫秒内改写会让 ts 和 seen 相等/, "把这个坑写在代码里，免得下次有人改回去比时间戳");
});
