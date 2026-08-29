// 真的把每个 app 渲一遍（不是正则断言）。
// v57.46 相册白屏就是这么漏出去的：改 AlbumView 签名那步 replace 静默没匹配上，
// body 里多了个没声明的 onPeek，语法检查全绿、点开照片当场 ReferenceError。
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadPhone, FIXTURES, LIVE, SRC } = require("./helpers/phone-render.js");

const char = { id: "c1", name: "沈屿白", remark: "阿屿" };
const ctxBase = { char, profile: { name: "Lisa" }, onBack: () => {}, onRefresh: () => {}, refreshing: false, setSheet: () => {}, forumTab: "main", setForumTab: () => {} };

// renderPhoneModule 里 t / setSheet 等由 ctx 传入；h 桩会把整棵树的表达式全部求值
const renderKeys = () => {
  const P = loadPhone();
  const t = { ink: "#111", bg: "#fff", bg2: "#eee", line: "#ddd", fog: "#999", sub: "#555", tint: "#c90", accent: "#c90" };
  const keys = P.PHONE_APPS.reduce((a, x) => a.concat(x.key === "video" ? ["video_day", "video_night"] : [x.key]), []);
  return { P, t, keys };
};

test("每个 app 都能拿着正常数据渲出来，一个都不炸", () => {
  const { P, t, keys } = renderKeys();
  keys.forEach(k => {
    const d = FIXTURES[k];
    assert.ok(d || P.PHONE_LIVE_KEYS.indexOf(k) >= 0, k + " 连假数据都没有，说明这个 app 没接完");
    assert.doesNotThrow(
      () => P.renderPhoneModule(k, d || null, { ...ctxBase, t, ...LIVE }),
      k + " 渲染时抛了"
    );
  });
});

test("数据是空对象时也不炸（模型返回 {} 是常事）", () => {
  const { P, t, keys } = renderKeys();
  keys.forEach(k => assert.doesNotThrow(
    () => P.renderPhoneModule(k, {}, { ...ctxBase, t, ...LIVE }),
    k + " 遇到空数据就炸"
  ));
});

test("字段类型不对时也不炸（items 给成字符串、数字给成 null）", () => {
  const { P, t, keys } = renderKeys();
  const junk = { items: "不是数组", chats: null, songs: 3, week: "x", follows: {}, progress: null, restingHr: null };
  keys.forEach(k => assert.doesNotThrow(
    () => P.renderPhoneModule(k, junk, { ...ctxBase, t, ...LIVE }),
    k + " 遇到脏数据就炸"
  ));
});

test("没有 onPeek 时（比如别处复用）也不炸，只是没有转发键", () => {
  const { P, t, keys } = renderKeys();
  const noPeek = { ...LIVE };
  delete noPeek.onPeek;
  keys.forEach(k => assert.doesNotThrow(
    () => P.renderPhoneModule(k, FIXTURES[k] || {}, { ...ctxBase, t, ...noPeek }),
    k + " 在没有 onPeek 时炸了"
  ));
});

test("相册：列表页和点开照片的详情页都能渲（v57.46 崩的就是后者）", () => {
  const props = { d: FIXTURES.album, char, t: { ink: "#111", bg: "#fff", bg2: "#eee", line: "#ddd", fog: "#999", sub: "#555" }, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  assert.doesNotThrow(() => loadPhone().AlbumView(props), "相册列表页炸了");
  // useState 第 4 个是 photo：强行塞一张照片，走到详情分支
  const photo = FIXTURES.album.items[0];
  assert.doesNotThrow(() => loadPhone({ 3: photo }).AlbumView(props), "照片详情页炸了");
  // 没有 onPeek 时也得能开（onPeek 必须是真参数，不是裸标识符）
  const { onPeek, ...noPeek } = props;
  assert.doesNotThrow(() => loadPhone({ 3: photo }).AlbumView(noPeek), "没有 onPeek 时照片详情页炸了");
});

test("AlbumView 用到的 onPeek 是签名里声明的参数，不是裸标识符", () => {
  const sig = SRC.match(/function AlbumView\(\{([^}]*)\}\)/);
  assert.ok(sig, "找不到 AlbumView 签名");
  assert.ok(sig[1].includes("onPeek"), "onPeek 没在签名里——body 里再用就是 ReferenceError");
});

test("每个 app 的图标都画得出来，没有空图标", () => {
  const P = loadPhone();
  P.PHONE_APPS.forEach(a => {
    const node = P.PGlyph({ k: a.key, size: 24, color: "#111" });
    assert.ok(node && node.kids && node.kids.length > 0, a.key + " 没有图标（会显示成一个空方块）");
  });
});

test("每个 app 在四套桌面布局里都有入口，一个都不许找不到", () => {
  const P = loadPhone();
  const keys = P.PHONE_APPS.map(a => a.key);
  P.PHONE_DESKTOP_LAYOUTS.forEach(L => {
    const placed = L.dock.concat(...L.pages);
    keys.forEach(k => assert.ok(placed.indexOf(k) >= 0, L.id + " 布局里找不到 " + k));
    // 不许同一个 app 在同一套布局里出现两次
    assert.equal(new Set(placed).size, placed.length, L.id + " 有重复入口");
    // 小组件引用的 key 必须真实存在
    L.widgets.forEach(page => page.forEach(w => {
      assert.ok(w.key === "refresh" || keys.indexOf(w.key) >= 0, L.id + " 的小组件引用了不存在的 " + w.key);
    }));
  });
  // 兜底布局也要覆盖全
  const fb = P.PHONE_DOCK_KEYS.concat(...P.PHONE_DESKTOP_PAGES);
  keys.forEach(k => assert.ok(fb.indexOf(k) >= 0, "兜底布局里找不到 " + k));
});

test("新加的六个 app 都配齐了：推演任务、取材层、避重抽取、假数据", () => {
  const P = loadPhone();
  ["reading", "liked", "orders", "health", "clipboard", "calendar"].forEach(k => {
    const spec = P.phoneProbeSpec(k, char, [], "", []);
    assert.notEqual(spec.schemaHint, "{}", k + " 没有自己的推演任务");
    assert.ok(spec.instruction.length > 120, k + " 的推演任务写得太薄");
    assert.ok(P.PHONE_ANGLE[k], k + " 没有取材层");
    assert.match(P.PHONE_ANGLE[k], /【取材层】.*【时间窗】/s, k + " 取材层或时间窗缺一样");
    assert.ok(P.PHONE_DIGEST_PICK[k], k + " 没进避重抽取表");
    assert.ok(FIXTURES[k], k + " 没有渲染冒烟用的假数据");
  });
});

test("避重抽取表能从新 app 的真实形状里抽出东西", () => {
  const P = loadPhone();
  const lines = P.phoneRoundDigest({
    reading: FIXTURES.reading, liked: FIXTURES.liked, orders: FIXTURES.orders,
    clipboard: FIXTURES.clipboard, calendar: FIXTURES.calendar, health: FIXTURES.health
  }, "notes").join("\n");
  assert.match(lines, /阅读：长夜/);
  assert.match(lines, /赞过：一个人吃饭的十种办法/);
  assert.match(lines, /订单：馄饨/);
  assert.match(lines, /剪贴板：其实我/);
  assert.match(lines, /日历：体检/);
  // 健康是纯数字，不参与避重（它跟别的 app 不会撞题）
  assert.doesNotMatch(lines, /健康：/);
});
