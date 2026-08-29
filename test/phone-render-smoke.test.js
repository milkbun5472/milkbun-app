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

test("新加的这几个 app 都配齐了：推演任务、取材层、避重抽取、假数据", () => {
  const P = loadPhone();
  // v57.50：订单并进购物了（她给的参考稿本来就是一整个购物 app，两个并存必然复读）
  ["reading", "liked", "shopping", "health", "clipboard", "calendar"].forEach(k => {
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
    reading: FIXTURES.reading, liked: FIXTURES.liked, shopping: FIXTURES.shopping,
    clipboard: FIXTURES.clipboard, calendar: FIXTURES.calendar, health: FIXTURES.health
  }, "notes").join("\n");
  assert.match(lines, /阅读：京华杂谈与消遣/);
  assert.match(lines, /赞过：一个人吃饭的十种办法/);
  assert.match(lines, /购物：古法手作冰镇桂花糖糕组合/);
  assert.match(lines, /剪贴板：其实我/);
  assert.match(lines, /日历：体检/);
  // 健康 v57.52 起也进避重：指标名是模型自己起的，和别处撞题是有可能的
  assert.match(lines, /健康：睡眠质量/);
});

test("阅读：书架页、我的页、点开一本书的详情页都能渲", () => {
  const { FIXTURES: F } = require("./helpers/phone-render.js");
  const props = { d: F.reading, char, t: { ink: "#111", bg: "#fff", bg2: "#eee", line: "#ddd", fog: "#999", sub: "#555" }, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  assert.doesNotThrow(() => loadPhone().ReadingView(props), "书架页炸了");
  // useState 顺序：0=tab, 1=book
  assert.doesNotThrow(() => loadPhone({ 0: "mine" }).ReadingView(props), "我的页炸了");
  const b = { ...F.reading.shelves[0].books[0], _shelf: "京华杂谈与消遣", _no: 1 };
  assert.doesNotThrow(() => loadPhone({ 1: b }).ReadingView(props), "书详情页炸了");
  // 数据没来／形状不对时也不能炸
  [null, {}, { shelves: "x", archive: 3 }, { shelves: [{ books: "x" }] }].forEach((d, i) =>
    assert.doesNotThrow(() => loadPhone().ReadingView({ ...props, d }), "脏数据 " + i + " 炸了"));
  const { onPeek, ...noPeek } = props;
  assert.doesNotThrow(() => loadPhone({ 1: b }).ReadingView(noPeek), "没有 onPeek 时书详情炸了");
});

// 深色阅读模式（她 2026-08-29：「书架背景做深色阅读模式的颜色，
// 确保书架的书颜色在深色模式下不会打架、不会显示不明显」）
const lum = hex => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255;
};
test("书架是深色阅读底，五档配色齐全", () => {
  const P = loadPhone();
  assert.equal(P.READ_PALETTES.length, 5);
  assert.ok(lum(P.READ_BG) < 0.2, "背景不够深，不像阅读模式：" + P.READ_BG);
  assert.ok(lum(P.READ_INK) > 0.75, "正文色在深底上不够亮：" + P.READ_INK);
  P.READ_PALETTES.forEach((p, i) => {
    assert.ok(p.id && p.accent && p.shelf && p.rail && p.text, "第 " + i + " 档配色不全");
    assert.ok(Array.isArray(p.spine) && p.spine.length === 2, "第 " + i + " 档没有书脊渐变");
  });
});

test("深底上没有一架书会糊掉，书脊上的字也读得出来", () => {
  const P = loadPhone();
  const bg = lum(P.READ_BG);
  P.READ_PALETTES.forEach(p => {
    p.spine.forEach(c => {
      const l = lum(c);
      assert.ok(l !== null, p.id + " 的书脊色不是六位十六进制：" + c);
      // 书脊必须比背景亮一大截，否则整架书糊进深色背景里
      assert.ok(l - bg > 0.35, p.id + " 的书脊 " + c + " 在深底上太暗，会看不见");
    });
    // 浅书脊配深字：书名才读得出来
    assert.ok(lum(p.spine[0]) - lum(p.text) > 0.35, p.id + " 书脊和书名字色对比不够");
    // 五档亮度要拉平，不能有哪一架明显比别人暗
    assert.ok(Math.abs(lum(p.spine[0]) - lum(P.READ_PALETTES[0].spine[0])) < 0.16, p.id + " 这一架和别人亮度差太多，会显得它没内容");
  });
});

test("阅读档案有本周目标环，颜色就是完成度", () => {
  const P = loadPhone();
  assert.equal(P.readMinutes("7小时5分"), 425);
  assert.equal(P.readMinutes("5小时"), 300);
  assert.equal(P.readMinutes("20分钟"), 20);
  assert.equal(P.readMinutes(""), 0);
  assert.equal(P.readFmtMin(425), "7 小时 5 分");
  assert.equal(P.readFmtMin(300), "5 小时");
  assert.equal(P.readFmtMin(20), "20 分");
  // 差得远是暖红，接近是琥珀，达标是绿——四档互不相同
  const cols = [0.1, 0.4, 0.8, 1.2].map(P.readGoalColor);
  assert.equal(new Set(cols).size, 4, "目标环的四档颜色应当互不相同");
  assert.equal(P.readGoalColor(1), P.readGoalColor(2), "达标之后就一直是达标色");
  // 环本身要画得出来
  assert.match(SRC, /strokeDashoffset: circ \* \(1 - p\)/);
  assert.match(SRC, /readMinutes\(archive\.weekGoal\) \|\| 300/);
});

test("顶栏写的是「书架 / 阅读档案」，不是角色名", () => {
  assert.match(SRC, /tab === "shelf" \? "书架" : "阅读档案"/);
});

test("内页底栏以主聊天输入栏为标尺，不许再 +Npx 垫高", () => {
  // .claude/rules/mobile-ui-layout.md §2
  const navs = SRC.match(/const nav = h\("div", \{[\s\S]{0,400}?\}\s*\}/g) || [];
  assert.ok(navs.length >= 2, "阅读和相册各该有一条内页底栏");
  navs.forEach(n => {
    assert.ok(n.includes("paddingBottom: COMPOSER_PAD_BOTTOM"), "底栏没用输入栏那把尺：" + n.slice(0, 90));
    assert.ok(!/safe-area-inset-bottom\) \* 0\.4 \+ \d/.test(n), "底栏又在 +Npx 垫高");
    assert.ok(!/minHeight: 5\d/.test(n), "底栏又用 minHeight 垫高");
  });
});

test("自己画整屏的 app 不再套外层 Head，免得两层标题栏", () => {
  const P = loadPhone();
  assert.deepEqual(P.FULL_BLEED_KEYS, ["wechat", "album", "reading", "shopping", "takeout", "health"]);
  assert.match(SRC, /FULL_BLEED_KEYS\.indexOf\(appKey\) < 0 && h\(Head, \{/);
  assert.match(SRC, /FULL_BLEED_KEYS\.indexOf\(appKey\) >= 0 \? "flex-1 min-h-0 overflow-hidden"/);
});

test("阅读的推演任务把书架名、真书、批注三条都钉死了", () => {
  const P = loadPhone();
  const spec = P.phoneProbeSpec("reading", char, [], "", []);
  assert.match(spec.instruction, /正好 5 个书架、正好 30 本书/);
  assert.match(spec.instruction, /书架名\*\*不是分类标签\*\*/);
  assert.match(spec.instruction, /不许写「历史」「科幻」「文学」「哲学」/);
  assert.match(spec.instruction, /是他在他所处的时代和世界里拿得到的/);
  assert.match(spec.instruction, /不许写读后感/);
  assert.match(spec.instruction, /换个角色也说得通的批注就是写坏了/);
  assert.match(spec.schemaHint, /"shelves"/);
  assert.match(spec.schemaHint, /"archive"/);
  // 30 本带批注，输出上限不能还留在默认的 2600
  assert.ok(spec.maxTokens >= 20000, "上限只有 " + spec.maxTokens + "，30 本书会被截断");
});

test("购物：四个页签、想买详情、脏数据、无 onPeek 都能渲", () => {
  const { FIXTURES: F } = require("./helpers/phone-render.js");
  const props = { d: F.shopping, char, t: { ink: "#111", bg: "#fff", bg2: "#eee", line: "#ddd", fog: "#999", sub: "#555" }, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  // useState 顺序：0=tab, 1=sheet
  ["home", "cart", "order", "mine"].forEach(k =>
    assert.doesNotThrow(() => loadPhone({ 0: k }).ShoppingView(props), k + " 这一页炸了"));
  // 想买清单的详情弹层
  assert.doesNotThrow(() => loadPhone({ 1: { kind: "wish", it: F.shopping.wish[0] } }).ShoppingView(props), "想买详情炸了");
  assert.doesNotThrow(() => loadPhone({ 1: { kind: "wish", it: {} } }).ShoppingView(props), "想买详情遇到空条目炸了");
  [null, {}, { account: 3, cart: "x", orders: [{ items: "x", tags: 5 }], addrs: [{}] }].forEach((d, i) =>
    ["home", "cart", "order", "mine"].forEach(k =>
      assert.doesNotThrow(() => loadPhone({ 0: k }).ShoppingView({ ...props, d }), "脏数据 " + i + " 在 " + k + " 页炸了")));
  const { onPeek, ...noPeek } = props;
  assert.doesNotThrow(() => loadPhone({ 1: { kind: "wish", it: F.shopping.wish[0] } }).ShoppingView(noPeek), "没有 onPeek 时炸了");
});

test("购物分成四页，每一块内容都落在某一页里，没有孤儿", () => {
  const m = SRC.match(/const PAGES = \[[\s\S]*?\n  \];/);
  assert.ok(m, "找不到分页表");
  const placed = m[0];
  ["accountCard", "shipSec", "wishSec", "cartSec", "couponSec", "viewSec", "orderSec",
   "habitSec", "shopSec", "addrSec", "giftSec", "monthSec"].forEach(sec =>
    assert.ok(placed.includes(sec), sec + " 没被分到任何一页，会看不见"));
  // 每一块只出现一次，别在两页里重复
  ["accountCard", "cartSec", "orderSec", "monthSec"].forEach(sec =>
    assert.equal((placed.match(new RegExp(sec, "g")) || []).length, 1, sec + " 在两页里重复了"));
  // 底栏还是那把尺
  assert.match(SRC, /className: "shrink-0 grid grid-cols-4",\n    style: \{ padding: "5px 12px", paddingBottom: COMPOSER_PAD_BOTTOM/);
});

test("列表项点开是看，不是发——转发只在详情里那颗按钮上", () => {
  // 她 2026-08-29：「想买清单我怎么点开想看全部备注直接发送了」
  // 转发是不可逆动作，绝不能挂在列表项的 onClick 上
  assert.match(SRC, /onClick: \(\) => setSheet\(\{ kind: "wish", it: it \}\)/);
  assert.doesNotMatch(SRC, /onClick: \(\) => onPeek && onPeek\(/);
  // 换页要回到顶部，但同一页开关详情不该把位置弄丢
  assert.match(SRC, /useEffect\(\(\) => \{ if \(scrollRef\.current\) scrollRef\.current\.scrollTop = 0; \}, \[tab\]\)/);
});

test("购物的推演任务把「为什么想买」和「不是自己家的地址」钉死了", () => {
  const P = loadPhone();
  const spec = P.phoneProbeSpec("shopping", char, [], "", []);
  // 十一块内容都要点到名
  ["account", "shipping", "cart", "wish", "orders", "habit", "shops", "coupons", "viewed", "addrs", "gifts", "monthNote"]
    .forEach(k => assert.ok(spec.schemaHint.includes('"' + k + '"'), k + " 这一块没在 schema 里"));
  // 每块的条数都要写死，不然模型爱给几条给几条
  assert.match(spec.instruction, /shipping 在途包裹 \*\*2-3 件\*\*/);
  assert.match(spec.instruction, /cart 购物车 \*\*4-6 件\*\*/);
  assert.match(spec.instruction, /wish 想买清单 \*\*4-6 件\*\*/);
  assert.match(spec.instruction, /orders 我的订单 \*\*6-8 单\*\*/);
  assert.match(spec.instruction, /shops 常逛店铺 \*\*3-4 家\*\*/);
  assert.match(spec.instruction, /coupons 优惠券 \*\*2-3 张\*\*/);
  assert.match(spec.instruction, /viewed 最近浏览 \*\*5-7 条\*\*/);
  assert.match(spec.instruction, /addrs 收货地址 \*\*2-3 条\*\*/);
  assert.match(spec.instruction, /gifts 相关往来 \*\*3-5 条\*\*/);
  // 值钱的那几栏
  assert.match(spec.instruction, /why 这一栏是整个 app 里最重要的东西/);
  assert.match(spec.instruction, /不许写「质量好」「性价比高」这种/);
  assert.match(spec.instruction, /绝不买什么.*这一条比常买更像人/s);
  assert.match(spec.instruction, /其中一条应当是「他常去的另一个地方」/);
  assert.match(spec.instruction, /看了没买的东西和购物车里的要错开/);
});

test("购物里非默认地址走 hidden 档——那不是购物信息，是他常去谁家", () => {
  assert.match(SRC, /!a\.isDefault \? h\("div", null, peekBtn\("hidden", "收货地址"/);
});

test("查手机所有推演的输出天花板统一给满，不再一个 app 一个数", () => {
  const P = loadPhone();
  const keys = P.PHONE_APPS.reduce((a, x) => a.concat(x.key === "video" ? ["video_day", "video_night"] : [x.key]), [])
    .filter(k => P.PHONE_LIVE_KEYS.indexOf(k) < 0);
  keys.forEach(k => assert.equal(P.phoneProbeSpec(k, char, [], "", []).maxTokens, 65535, k + " 的天花板不是给满的"));
  // 各 app 自己那行 maxTokens 必须是删掉，不是留着被覆盖
  assert.doesNotMatch(SRC, /maxTokens: \d+\n/);
  assert.match(SRC, /const PHONE_OUT_CEILING = 65535;/);
});

test("外卖：三页、脏数据、无 onPeek 都能渲", () => {
  const { FIXTURES: F } = require("./helpers/phone-render.js");
  const props = { d: F.takeout, char, t: { ink: "#111", bg: "#fff", bg2: "#eee", line: "#ddd", fog: "#999", sub: "#555" }, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  ["home", "order", "mine"].forEach(k =>
    assert.doesNotThrow(() => loadPhone({ 0: k }).TakeoutView(props), k + " 这一页炸了"));
  [null, {}, { live: "x", orders: [{ items: 3 }], addrs: [{}], taste: 5 }].forEach((d, i) =>
    ["home", "order", "mine"].forEach(k =>
      assert.doesNotThrow(() => loadPhone({ 0: k }).TakeoutView({ ...props, d }), "脏数据 " + i + " 在 " + k + " 页炸了")));
  const { onPeek, ...noPeek } = props;
  assert.doesNotThrow(() => loadPhone().TakeoutView(noPeek), "没有 onPeek 时炸了");
});

test("健康：四页、脏数据、无 onPeek 都能渲", () => {
  const { FIXTURES: F } = require("./helpers/phone-render.js");
  const props = { d: F.health, char, t: { ink: "#111", bg: "#fff", bg2: "#eee", line: "#ddd", fog: "#999", sub: "#555" }, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  ["body", "mind", "intake", "track"].forEach(k =>
    assert.doesNotThrow(() => loadPhone({ 0: k }).HealthView(props), k + " 这一页炸了"));
  [null, {}, { cards: "x", timeline: 3, insights: [{}], today: 7 },
   { cards: [{ stats: "x", week: "y" }, { wide: true }, {}] }].forEach((d, i) =>
    ["body", "mind", "intake", "track"].forEach(k =>
      assert.doesNotThrow(() => loadPhone({ 0: k }).HealthView({ ...props, d }), "脏数据 " + i + " 在 " + k + " 页炸了")));
  const { onPeek, ...noPeek } = props;
  assert.doesNotThrow(() => loadPhone().HealthView(noPeek), "没有 onPeek 时炸了");
});

test("健康卡按 group 分页，窄卡两两并排、宽卡整行", () => {
  const P = loadPhone();
  assert.deepEqual(P.HEALTH_GROUPS.map(g => g.key), ["body", "mind", "intake"]);
  // 分页是按数据里的 group 走的，不靠指标名——指标名是模型按角色世界起的，
  // 写死名字的话，「玉简传信」这种就会掉到页外看不见
  assert.match(SRC, /const byGroup = g => cards\.filter\(c => \(c\.group \|\| "body"\) === g\)/);
  assert.match(SRC, /if \(buf\.length === 2\)/);
  assert.doesNotMatch(SRC, /c\.name === "睡眠/);
});

test("健康的推演任务把「按角色世界改名」和「三项要角色专属」钉死了", () => {
  const P = loadPhone();
  const spec = P.phoneProbeSpec("health", char, [], "", []);
  // 她 2026-08-29：「玉简传信其实是微信，他觉得王爷不用微信就改了个词」
  assert.match(spec.instruction, /指标名要长成他世界里的样子/);
  assert.match(spec.instruction, /玉简传信/);
  assert.match(spec.instruction, /不要照搬现代体检报告的词/);
  // 她 2026-08-29：「同一个类别每一个角色的那三个计数都是不一样的」
  assert.match(spec.instruction, /它们的名字必须是这个角色专属的，绝不能用通用标签/);
  assert.match(spec.instruction, /搜查厢房 \/ 官署穿行 \/ 日常散步/);
  assert.match(spec.instruction, /换个角色还照样成立的三项，就是写坏了/);
  assert.match(spec.instruction, /cards \*\*12-14 张指标卡\*\*/);
  assert.match(spec.instruction, /timeline \*\*4-6 条\*\*/);
  assert.match(spec.instruction, /insights \*\*正好 3 条\*\*/);
  ["today", "cards", "stats", "week", "timeline", "insights", "tail"]
    .forEach(k => assert.ok(spec.schemaHint.includes('"' + k + '"'), k + " 不在 schema 里"));
});

test("外卖的推演任务把「备注那一栏」钉死了", () => {
  const P = loadPhone();
  const spec = P.phoneProbeSpec("takeout", char, [], "", []);
  assert.match(spec.instruction, /note 那一栏是这个 app 的重点/);
  assert.match(spec.instruction, /麻烦轻一点敲门，家里有人在睡/);
  assert.match(spec.instruction, /至少有一单是深夜的/);
  assert.match(spec.instruction, /绝对不吃什么/);
  assert.match(spec.instruction, /其中一条应当是【他常去的另一个地方】/);
});

test("想买清单的封面色不再洗白到近白", () => {
  const P = loadPhone();
  // 她 2026-08-29：「第四个框颜色没盖住」——原来第二档统一渐变到 #f2f2f6
  assert.equal(P.WISH_COVERS.length, 5);
  P.WISH_COVERS.forEach((pair, i) => {
    assert.equal(pair.length, 2, "第 " + i + " 档封面不是两档色");
    const l = hex => { const n = parseInt(hex.slice(1), 16); return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; };
    assert.ok(l(pair[1]) < 0.95, "第 " + i + " 档的浅端 " + pair[1] + " 太接近白，看着像没铺满");
    assert.ok(l(pair[1]) > l(pair[0]), "第 " + i + " 档应当是深→浅");
  });
  assert.doesNotMatch(SRC, /\+ ",#f2f2f6\)"/);
});

test("健康窄卡的指标名独占一行，不会被 flex 压成一条竖字", () => {
  // 她 2026-08-29：「这种竖着的标题不会自己换行，弄的好长一条」
  // 病因：中文任何位置都能断，min-content 就是一个字宽；窄卡里名字和图标、分数
  // 挤在同一 flex 行，就被压到一个字宽竖下去了。
  assert.match(SRC, /narrow\n\s*\? h\("div", null,/);
  // 宽卡那一支必须给标题 flex:1 + minWidth:0，不能只写 minWidth:0
  assert.match(SRC, /h\("div", \{ style: \{ flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: 15\.5/);
  // 两支都要允许长词换行
  assert.equal((SRC.match(/wordBreak: "break-word"/g) || []).length, 2);
});
