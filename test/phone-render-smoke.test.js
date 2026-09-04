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
  const keys = P.PHONE_APPS.map(x => x.key);
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

test("每个 app 都真的被 renderPhoneModule 接住了，没有一个掉回 null", () => {
  // v57.54 健康白屏就是这么漏出去的：组件写好了、冒烟测试直接调组件也过了，
  // 但 renderPhoneModule 里那行挂载被我删旧代码时连带切掉，于是这个 key 掉到
  // 函数末尾 return null——整页空白。测组件不等于测路由。
  const { P, t, keys } = renderKeys();
  keys.forEach(k => {
    const node = P.renderPhoneModule(k, FIXTURES[k] || null, { ...ctxBase, t, ...LIVE });
    assert.ok(node && typeof node === "object", k + " 没有被接住，会白屏");
  });
  // 每个自己画整屏的 app 都要挂到自己的组件上，不能只是 wrap 一个列表
  [["wechat", "WeChatViewFull"], ["album", "AlbumView"], ["reading", "ReadingView"],
   ["shopping", "ShoppingView"], ["takeout", "TakeoutView"], ["health", "HealthView"],
   ["bili", "BiliView"], ["latenight", "LateNightView"], ["liked", "PlazaView"], ["calendar", "CalendarView"],
   ["notes", "StickyView"], ["clipboard", "ClipView"], ["browser", "BrowserView"], ["calls", "PhoneCallsView"]]
    .forEach(([k, comp]) => {
      const node = P.renderPhoneModule(k, FIXTURES[k] || null, { ...ctxBase, t, ...LIVE });
      assert.equal(node.type, comp, k + " 挂到了 " + node.type + "，不是 " + comp);
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
  // v58.29 起【组件也算入口】：她要的就是「某些 app 保持图标、某些换成组件」，
  // 换成组件的那几个在页面上没有图标，但组件本身点开就进去了。
  // 所以入口 = dock ∪ 页面图标 ∪ 组件（refresh 和装饰件除外）。
  const decor = P.PHONE_DECOR || [];
  P.PHONE_DESKTOP_LAYOUTS.forEach(L => {
    const placed = L.dock.concat(...L.pages);
    const viaWidget = [].concat(...L.widgets).map(w => w.key)
      .filter(k => k !== "refresh" && decor.indexOf(k) < 0);
    const reach = new Set(placed.concat(viaWidget));
    keys.forEach(k => assert.ok(reach.has(k), L.id + " 布局里找不到 " + k));
    // 不许同一个 app 在同一套布局里出现两次
    assert.equal(new Set(placed).size, placed.length, L.id + " 有重复入口");
    // 小组件引用的 key 必须真实存在：要么是 app，要么是 refresh，要么是登记过的装饰件
    L.widgets.forEach(page => page.forEach(w => {
      assert.ok(w.key === "refresh" || decor.indexOf(w.key) >= 0 || keys.indexOf(w.key) >= 0,
        L.id + " 的小组件引用了不存在的 " + w.key);
    }));
  });
  // 兜底布局也要覆盖全
  const fb = P.PHONE_DOCK_KEYS.concat(...P.PHONE_DESKTOP_PAGES);
  keys.forEach(k => assert.ok(fb.indexOf(k) >= 0, "兜底布局里找不到 " + k));
});

test("新加的这几个 app 都配齐了：推演任务、取材层、避重抽取、假数据", () => {
  const P = loadPhone();
  // v57.50：订单并进购物了（她给的参考稿本来就是一整个购物 app，两个并存必然复读）
  // v57.64：日历改接真数据（App 里那份日历/日程/答应过的事），它的推演任务整个删了
  ["reading", "liked", "shopping", "health", "clipboard", "bili", "latenight", "takeout", "browser"].forEach(k => {
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
    clipboard: FIXTURES.clipboard, health: FIXTURES.health
  }, "notes").join("\n");
  assert.match(lines, /阅读：京华杂谈与消遣/);
  assert.match(lines, /小红书：一个人吃饭的十种办法｜谁懂啊这把刀磨了三个月/);
  assert.match(lines, /购物：古法手作冰镇桂花糖糕组合/);
  assert.match(lines, /剪贴板：其实我/);
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
  assert.deepEqual(P.FULL_BLEED_KEYS, ["wechat", "album", "reading", "shopping", "takeout", "health", "bili", "latenight", "liked", "calendar", "notes", "clipboard", "browser", "calls", "timeline", "tally", "mail", "anon", "forum"]);
  assert.match(SRC, /FULL_BLEED_KEYS\.indexOf\(appKey\) < 0 && h\("div", \{\n    className: "shrink-0 px-4 pb-2 flex items-center gap-2"/);
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
  // v59.38：优惠券整栏不画了（营销位，纯平台部件；生成层留着）
  // v59.48：账户卡撤了（这是他自己的手机，不需要自我介绍）
  ["shipSec", "wishSec", "cartSec", "viewSec", "orderSec",
   "habitSec", "shopSec", "addrSec", "giftSec", "monthSec"].forEach(sec =>
    assert.ok(placed.includes(sec), sec + " 没被分到任何一页，会看不见"));
  // 每一块只出现一次，别在两页里重复
  ["cartSec", "orderSec", "monthSec"].forEach(sec =>
    assert.equal((placed.match(new RegExp(sec, "g")) || []).length, 1, sec + " 在两页里重复了"));
  // 底栏还是那把尺：底部安全区照 COMPOSER_PAD_BOTTOM（见 mobile-ui-layout.md），
  // 列数跟着 PAGES 走（v58.33 起——写死列数的话，哪天加一档就竖着叠成一列）
  const nav = SRC.slice(SRC.indexOf('const nav = h("div", {', SRC.indexOf("function ShoppingView(")));
  assert.match(nav.slice(0, 400), /paddingBottom: COMPOSER_PAD_BOTTOM/);
  assert.match(nav.slice(0, 400), /gridTemplateColumns: "repeat\(" \+ PAGES\.length/);
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
  const keys = P.PHONE_APPS.map(x => x.key).filter(k => P.PHONE_LIVE_KEYS.indexOf(k) < 0);
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
  assert.deepEqual(P.HEALTH_GROUPS.map(g => g.key), ["body", "mind", "private", "intake"]);
  // 分页是按数据里的 group 走的，不靠指标名——指标名是模型按角色世界起的，
  // 写死名字的话，「玉简传信」这种就会掉到页外看不见
  assert.match(SRC, /const byGroup = g => cards\.filter\(c => healthGroupOf\(c\) === g\)/);
  // v58.31：group 先过一遍归位。以前是 (c.group || "body") === g，只认三个 key，
  // 模型回中文或「私密」这种词，整张卡每个 tab 都翻不到（她 2026-08-30 报的）
  assert.doesNotMatch(SRC, /\(c\.group \|\| "body"\) === g/);
  assert.equal(P.healthGroupOf({ group: "私密" }), "private");
  assert.equal(P.healthGroupOf({ group: "谁也不认识" }), "body");
  assert.doesNotMatch(SRC, /c\.name === "睡眠/);
  // v62.53 读数不再是「一项一张卡、窄卡两两并排」，而是【一档一张化验单，一行一项】。
  // 仪表盘卡（白圆角 + 顶上一条 4px 彩带 + 33px 大数）换个健康 app 照样成立，
  // 化验单不会——它只在病历里成立。
  assert.match(SRC, /const labSheet = \(title, list\) => \{/);
  assert.match(SRC, /secs: \(g\.key === "body" \? \[headCard\] : \[\]\)\.concat\(\[labSheet\(g\.zh, byGroup\(g\.key\)\)\]\)/);
});

test("健康的推演任务把「按角色世界改名」和「三项要角色专属」钉死了", () => {
  const P = loadPhone();
  const spec = P.phoneProbeSpec("health", char, [], "", []);
  // 她 2026-08-29：「玉简传信其实是微信，他觉得王爷不用微信就改了个词」
  // v58.35 起指标项本身定死（HEALTH_SLOTS），要改的是【名字】，措辞跟着换了，意思没换
  assert.match(spec.instruction, /这个角色的世界里真会用的名字/);
  assert.match(spec.instruction, /换个角色还照样成立的名字，就是没改/);
  assert.match(spec.instruction, /不要照搬现代体检报告的词/);
  // 她 2026-08-29：「同一个类别每一个角色的那三个计数都是不一样的」
  assert.match(spec.instruction, /它们的名字必须是这个角色专属的，绝不能用通用标签/);
  assert.match(spec.instruction, /换个角色还照样成立的三项，就是写坏了/);
  assert.match(spec.instruction, /一项不多一项不少，每项写一张/);
  assert.match(spec.instruction, /timeline \*\*4-6 条\*\*/);
  // v59.44：记分板那三件撤了（today.score / week / insights），换成病历夹
  ["visits", "since", "cards", "stats", "timeline", "tail"]
    .forEach(k => assert.ok(spec.schemaHint.includes('"' + k + '"'), k + " 不在 schema 里"));
  ["score", "week", "insights"].forEach(k =>
    assert.ok(!spec.schemaHint.includes('"' + k + '"'), k + " 还在生成——那是记分板的部件"));
});

test("外卖照参考稿配齐了十来块，重点几栏都钉死了", () => {
  const P = loadPhone();
  const spec = P.phoneProbeSpec("takeout", char, [], "", []);
  // ⚠️v59.36 撤了两块：
  //   week —— 界面上「这七天」改成从 orders 上开的一扇窗，单独生成一份注定对不上；
  //   together —— 主键是模型现编的称呼，「老周／周叔」认不成一个人。
  //   它俩都是「同一件事生成两遍」或「身份不稳的主键」，撤掉是修法不是减配。
  ["account", "today", "shops", "live", "orders", "taste", "coupons", "addrs", "wish", "monthNote"]
    .forEach(k => assert.ok(spec.schemaHint.includes('"' + k + '"'), k + " 这一块没在 schema 里"));
  ["week", "together"].forEach(k => assert.ok(!spec.schemaHint.includes('"' + k + '"'), k + " 还在生成，界面上早已不用它了"));
  assert.match(spec.instruction, /note 那一栏是这个 app 的重点/);
  // 「送到别人那儿」那一格的全部内容都从这几单里来，所以要求提到两单、且 reason 说清送给谁
  assert.match(spec.instruction, /至少两单是送到别人那儿的/);
  assert.match(spec.instruction, /reason 要说清\*\*送给谁、为什么是这个时候\*\*/);
  // 忌口那组比爱吃的更像人，要求具体
  assert.match(spec.instruction, /这一组比爱吃什么更像人/);
  assert.match(spec.instruction, /别只写食材名/);
  // 地址标签要带括号身份、要有一条是去投喂别人的
  assert.match(spec.instruction, /后面用括号补一句这是谁的地方/);
  assert.match(spec.instruction, /其中一条应当是【他常去投喂的另一个地方】/);
  // 惦记着的那句 when 是最见人的地方
  assert.match(spec.instruction, /什么时候会突然想起它/);
});

test("每个有账号的 app 都给了他自己的平台 ID", () => {
  // 她 2026-08-29：「外卖软件也给他们弄个符合他们在外卖平台的 id，其他软件漏了的话也要」
  const P = loadPhone();
  [["takeout", /"uid"/], ["shopping", /"uid"/], ["bili", /"uid"/], ["latenight", /"uid"/],
   ["reading", /"uid"/], ["liked", /"xhsId"/], ["wechat", /"wechatId"/]]
    .forEach(([k, re]) => assert.match(P.phoneProbeSpec(k, char, [], "", []).schemaHint, re, k + " 没有平台 ID"));
  // 而且要在界面上看得见，不是只存着
  assert.match(SRC, /"UID " \+ me\.uid/);
  assert.match(SRC, /me\.uid \? me\.uid : "未登记"/);
  // v59.38：「会员号」跟着会员等级那枚徽章一起换掉了（平台的分层说法）；
  // 号码本身照旧看得见——核的是【看得见】，不是那两个字。
  // v59.48：账户卡撤了，号落进「合起来看」的一行小字里——核的还是【看得见】
  assert.match(SRC.slice(SRC.indexOf('const SHOP_ACCENT'), SRC.indexOf('const TAKE_ACCENT')), /"账号 " \+ acc\.uid/, "购物页看不见他的账号了");
  assert.match(SRC, /"书友号 " \+ archive\.uid/);
  assert.match(SRC, /"账号 " \+ acc\.uid/);
  assert.match(SRC, /"小红书号：" \+ me\.xhsId/);
  // 账号名要是【他在这个平台上的昵称】，不是本名照抄
  ["takeout", "shopping", "bili", "reading", "liked"].forEach(k =>
    assert.match(P.phoneProbeSpec(k, char, [], "", []).instruction, /不是本名照抄/, k + " 没说清昵称不是本名"));
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

test("指标名再长也不会被压成一条竖字", () => {
  // 她 2026-08-29：「这种竖着的标题不会自己换行，弄的好长一条」
  // 病因：中文任何位置都能断，min-content 就是一个字宽；名字跟别的东西挤在
  // 同一 flex 行就会被压到一个字宽竖下去。
  // v62.53 换成化验单的一行之后，防线换了个形状但同样得在：名字那一列不设
  // flexShrink:0（该断行的是它），数值那一列 flexShrink:0 + nowrap（读数不许拆开），
  // 中间那串引导点吃掉所有剩余宽度。
  const row = SRC.slice(SRC.indexOf("const labRow = "), SRC.indexOf("const labSheet = "));
  assert.match(row, /wordBreak: "break-word"/, "名字那一列不许禁止换行");
  assert.match(row, /flexShrink: 0, whiteSpace: "nowrap"/, "读数被拆成两行就没法读了");
  assert.match(SRC, /const DOTS = \{ flex: 1, minWidth: 14/, "引导点要吃掉剩余宽度，否则名字和数值会顶在一起");
});

test("视频拆成两个独立 app，子版块那套特例整个删掉了", () => {
  const P = loadPhone();
  const keys = P.PHONE_APPS.map(a => a.key);
  assert.ok(keys.includes("bili") && keys.includes("latenight"), "两个新 app 没入册");
  assert.ok(!keys.includes("video"), "旧的 video 还在");
  // 旧的 vtab / isVideo / video_day 那套必须是删掉，不是留着不用
  ["isVideo", "vtab", "video_day", "video_night", "genVideo"].forEach(n =>
    assert.ok(!SRC.includes(n), n + " 还留在源码里"));
  // 全刷不再拆子键
  const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
  assert.doesNotMatch(app, /\["video_day", "video_night"\]/);
});

test("视频（B站）：列表、详情、脏数据都能渲，弹幕是重点", () => {
  const { FIXTURES: F } = require("./helpers/phone-render.js");
  const props = { d: F.bili, char, t: {}, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  assert.doesNotThrow(() => loadPhone().BiliView(props), "列表炸了");
  assert.doesNotThrow(() => loadPhone({ 1: { v: F.bili.items[0], i: 0 } }).BiliView(props), "详情炸了");
  assert.doesNotThrow(() => loadPhone({ 1: { v: {}, i: 0 } }).BiliView(props), "空条目详情炸了");
  [null, {}, { items: "x", tabs: 3, me: 5 }, { items: [{ myDanmaku: "x" }] }].forEach((d, i) =>
    assert.doesNotThrow(() => loadPhone().BiliView({ ...props, d }), "脏数据 " + i + " 炸了"));
  const spec = loadPhone().phoneProbeSpec("bili", char, [], "", []);
  assert.match(spec.instruction, /items \*\*正好 10 条\*\*/);
  assert.match(spec.instruction, /弹幕是他忍不住开口的地方/);
  assert.match(spec.schemaHint, /"myDanmaku"/);
});

test("深夜台：尺度没被改小，仍然是 10 条", () => {
  const { FIXTURES: F } = require("./helpers/phone-render.js");
  const props = { d: F.latenight, char, t: {}, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  assert.doesNotThrow(() => loadPhone().LateNightView(props), "列表炸了");
  assert.doesNotThrow(() => loadPhone({ 0: F.latenight.items[0] }).LateNightView(props), "详情炸了");
  [null, {}, { items: [{ tags: "x" }] }].forEach((d, i) =>
    assert.doesNotThrow(() => loadPhone().LateNightView({ ...props, d }), "脏数据 " + i + " 炸了"));
  const spec = loadPhone().phoneProbeSpec("latenight", char, [], "", []);
  assert.match(spec.instruction, /正好 10 条/);
  // 她 2026-08-29 明确说「尺度不要改」
  assert.match(spec.instruction, /尺度该多大就多大/);
  assert.match(spec.instruction, /不要含糊其辞/);
  assert.match(spec.instruction, /不要写成文艺片/);
  // 同一天她报：所有人都往强势占有那个方向生成。病因不是哪个词写坏了，是这一栏
  // 除了「一个角色 + 深夜看的片」几乎没别的约束，空白由训练先验补上，而这个题材的
  // 先验就是支配。治法是把维度铺开，让他必须先在几根互不相干的轴上各选一头。
  assert.match(spec.instruction, /支配 \/ 占有 \/ 强势/, "没挡住「所有人都往强势占有写」这个默认答案");
  assert.match(spec.instruction, /换成任何一个角色都照样成立的答案/, "没写清判据");
  const axes = spec.instruction.match(/\n· /g) || [];
  assert.ok(axes.length >= 5, "欲望的轴少于 5 根，铺不开就还是会塌回同一个方向（现在 " + axes.length + " 根）");
  // 深夜台整个走 hidden 档转发
  assert.match(SRC, /onPeek\(\{ tier: "hidden", label: "深夜台"/);
});

test("广场：三页、详情、脏数据都能渲", () => {
  const { FIXTURES: F } = require("./helpers/phone-render.js");
  const props = { d: F.liked, char, t: {}, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  ["feed", "follow", "mine"].forEach(k =>
    assert.doesNotThrow(() => loadPhone({ 0: k }).PlazaView(props), k + " 页炸了"));
  assert.doesNotThrow(() => loadPhone({ 1: F.liked.items[0] }).PlazaView(props), "详情炸了");
  [null, {}, { items: "x", mine: 3, follows: 5, me: 1 }, { items: [{ tags: "x", cover: "z" }] }].forEach((d, i) =>
    ["feed", "follow", "mine"].forEach(k =>
      assert.doesNotThrow(() => loadPhone({ 0: k }).PlazaView({ ...props, d }), "脏数据 " + i + " 在 " + k + " 页炸了")));
});

test("日历：月历格子按真实日期落位，推迟多的标红", () => {
  const { FIXTURES: F } = require("./helpers/phone-render.js");
  const props = { d: F.calendar, char, t: {}, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  assert.doesNotThrow(() => loadPhone().CalendarView(props), "月历炸了");
  assert.doesNotThrow(() => loadPhone({ 1: 2 }).CalendarView(props), "选中某天炸了");
  assert.doesNotThrow(() => loadPhone({ 0: F.calendar.items[0] }).CalendarView(props), "详情炸了");
  [null, {}, { items: "x" }, { items: [{ date: "乱写" }, { date: "2026-13-40" }] }].forEach((d, i) =>
    assert.doesNotThrow(() => loadPhone().CalendarView({ ...props, d }), "脏数据 " + i + " 炸了"));
  // 日期必须是 YYYY-MM-DD 才能落格子
  assert.match(SRC, /\/\^\(\\d\{4\}\)-\(\\d\{1,2\}\)-\(\\d\{1,2\}\)\//);
  assert.match(SRC, /const late = x => Number\(x\.postponed\) >= 2 \|\| !!x\.overdue/);
  // v57.64：日历不再自己生成，读 App 里那份真的
  assert.equal(loadPhone().phoneProbeSpec("calendar", char, [], "", []).schemaHint, "{}", "日历还留着推演任务");
  assert.match(SRC, /if \(key === "calendar"\) return h\(CalendarView, \{ d: ctx\.calendar \|\| d/);
});

test("日历接的是 App 里那三份真的：他自己那格、带时刻的日程、答应过的事", () => {
  const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
  const m = app.match(/const phoneCalendarFor = char => \{[\s\S]*?\n  \};/);
  assert.ok(m, "找不到 phoneCalendarFor");
  const fn = m[0];
  assert.match(fn, /calendar && calendar\.chars/, "没读 x_calendar 里他自己那格");
  assert.match(fn, /calEventsRef\.current/, "没读带时刻的日程");
  assert.match(fn, /promisesRef\.current/, "没读他答应过的事");
  assert.match(fn, /schedulesRef\.current/, "没读已经推演过的行程");
  // 三个来源日期写法不一样（"2026-8-31" vs "2026-08-29"），必须统一补零，
  // 否则日历里一半写「8月31日」一半写「08月29日」
  assert.match(fn, /padStart\(2, "0"\)/, "日期没统一补零");
  // 「推迟 N 次」是个具体事实，没有任何地方真数过——不许为了染红就编一个数字
  assert.ok(fn.indexOf("postponed: late ? 3") < 0, "又在用伪造的推迟次数把条目染红");
  assert.match(fn, /overdue: !!late/, "过期该用 overdue 表示");
  assert.match(app, /calendarFor: phoneCalendarFor/, "没接到 PhoneCarry 上");
});

test("token 全放开：runProbe 的默认也不再是 2600", () => {
  const eng = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "engine.js"), "utf8");
  assert.doesNotMatch(eng, /probe\.maxTokens \|\| 2600/);
  assert.match(eng, /probe\.maxTokens \|\| \(window\.StylePresets && window\.StylePresets\.OUT_CEILING\) \|\| 65535/);
  const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
  assert.doesNotMatch(app, /maxTokens: 3600/);
});

test("B站详情页的返回键点得动——铺满的播放按钮不许吃掉点击", () => {
  // 她 2026-08-29：「视频点进去退出键是死的」
  assert.match(SRC, /inset: 0[^}]*pointerEvents: "none"/);
  assert.match(SRC, /position: "absolute", zIndex: 2, left: 6, top: safeTop\(6\)/);
});

test("解析失败会自动重来一次，不用她自己点第二遍", () => {
  const eng = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "engine.js"), "utf8");
  assert.match(eng, /上一次的输出没能解析/);
  assert.match(eng, /parsed = extractJSON\(again\)/);
  // 重试仍失败才报错，且报的是原文
  assert.match(eng, /if \(!parsed\) throw new Error\("解析失败：/);
});

test("手机里那两块大标题都换成紧凑栏了", () => {
  // 她 2026-08-29：「进入手机主页那一大块角色名也删了」「查手机 whose phone 也删了」
  assert.doesNotMatch(SRC, /en: "Whose Phone"/);
  assert.doesNotMatch(SRC, /fontSize: 28, color: t\.ink, lineHeight: 1\.05/);
  assert.match(SRC, /}, "查手机"\),/);
});

test("赞过改名小红书，界面也照小红书来", () => {
  const P = loadPhone();
  assert.equal(P.PHONE_LABEL.liked, "小红书");
  // 顶部是居中的频道 tab，不是一个页名
  assert.match(SRC, /const chans = \["发现"\]\.concat/);
  assert.match(SRC, /borderBottom: i === chan \? "2px solid " \+ PLAZA_RED/);
  // 卡片作者行带小头像
  assert.match(SRC, /width: 17, height: 17, borderRadius: 99/);
  // 详情底部是赞/收藏那条操作栏
  assert.match(SRC, /"★ 收藏"/);
  // 图标换了，不再是心形
  assert.doesNotMatch(SRC, /liked: \[P\("M20\.8 6\.6a5 5 0/);
});

test("便签：备忘录和录音合成一个，两种在数据里分得开", () => {
  const { FIXTURES: F } = require("./helpers/phone-render.js");
  const P = loadPhone();
  const props = { d: F.notes, char, t: {}, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  assert.doesNotThrow(() => P.StickyView(props), "便签墙炸了");
  assert.doesNotThrow(() => loadPhone({ 0: F.notes.items[1] }).StickyView(props), "录音便签详情炸了");
  [null, {}, { items: "x" }, { items: [{ color: "z" }, { kind: "voice" }] }].forEach((d, i) =>
    assert.doesNotThrow(() => loadPhone().StickyView({ ...props, d }), "脏数据 " + i + " 炸了"));
  // 录音那个 app 必须是删掉，不是留着不用
  assert.ok(!P.PHONE_APPS.some(a => a.key === "recordings"), "recordings 还在册");
  assert.equal(P.PHONE_LABEL.notes, "便签");
  assert.equal(P.PHONE_DIGEST_PICK.recordings, undefined);
  // 提示词里把两种的分界写死了
  const spec = P.phoneProbeSpec("notes", char, [], "", []);
  assert.match(spec.instruction, /只有打字打不出来、必须说出口的东西才会被录/);
  assert.match(spec.instruction, /如果两种写出来一个味道，就等于这个 app 白做了/);
  assert.match(spec.schemaHint, /"kind"/);
  assert.match(spec.schemaHint, /"duration"/);
  // 六种便签颜色，字色都压得住
  assert.equal(P.STICKY_COLORS.length, 6);
  P.STICKY_COLORS.forEach((c, i) => {
    const l = hex => { const n = parseInt(hex.slice(1), 16); return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; };
    assert.ok(l(c.bg) - l(c.ink) > 0.4, "第 " + i + " 张便签的字在纸上读不出来");
  });
});

test("剪贴板：没发出去的单独一档，走 hidden", () => {
  const { FIXTURES: F } = require("./helpers/phone-render.js");
  const props = { d: F.clipboard, char, t: {}, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  assert.doesNotThrow(() => loadPhone().ClipView(props), "剪贴板炸了");
  assert.doesNotThrow(() => loadPhone({ 0: F.clipboard.items[0] }).ClipView(props), "详情炸了");
  [null, {}, { items: "x" }, { items: [{}] }].forEach((d, i) =>
    assert.doesNotThrow(() => loadPhone().ClipView({ ...props, d }), "脏数据 " + i + " 炸了"));
  assert.match(SRC, /sec\("差一点就发出去", held, true\)/);
  assert.match(SRC, /tier: isHeld \? "hidden" : "quiet"/);
});

test("小红书「我的」按参考稿来，并且有草稿箱", () => {
  const { FIXTURES: F } = require("./helpers/phone-render.js");
  const props = { d: F.liked, char, t: {}, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  // useState 顺序：0=tab 1=open 2=chan 3=mtab
  ["note", "save", "draft"].forEach(k =>
    assert.doesNotThrow(() => loadPhone({ 0: "mine", 3: k }).PlazaView(props), k + " 这一栏炸了"));
  assert.doesNotThrow(() => loadPhone({ 1: { ...F.liked.drafts[0], _draft: true } }).PlazaView(props), "草稿详情炸了");
  [null, {}, { drafts: "x", me: 3 }].forEach((d, i) =>
    assert.doesNotThrow(() => loadPhone({ 0: "mine" }).PlazaView({ ...props, d }), "脏数据 " + i + " 炸了"));
  // 个人页该有的几样
  assert.match(SRC, /"小红书号：" \+ me\.xhsId/);
  assert.match(SRC, /\[\[me\.following, "关注"\], \[me\.followers, "粉丝"\], \[me\.likes, "获赞与收藏"\]\]/);
  assert.match(SRC, /mineTab\("draft", "草稿", drafts\.length, true\)/);
  // 草稿是他没发出去的 → hidden 档
  assert.match(SRC, /tier: "hidden", label: "小红书草稿箱"/);
  // 提示词里把三者的分野写死了
  const spec = loadPhone().phoneProbeSpec("liked", char, [], "", []);
  assert.match(spec.instruction, /drafts 1-3 条：他写了却一直没发出去的草稿/);
  assert.match(spec.instruction, /可以完全是三个人/);
  assert.match(spec.schemaHint, /"drafts"/);
  assert.match(spec.schemaHint, /"xhsId"/);
});

test("提示词里不许再塞具体的内容示范（.claude/rules/prompt-no-content-samples.md）", () => {
  // 她 2026-08-29：「现在模型都在抄格式了，以后提示词都不要塞特定格式的」
  // 写得越好的例子被抄得越狠——它就是那一栏里唯一可复制的东西。
  const P = loadPhone();
  const keys = P.PHONE_APPS.map(a => a.key).filter(k => P.PHONE_LIVE_KEYS.indexOf(k) < 0);
  const BANNED = ["某位扬言要纳侧房的祖宗", "陆闻那个嘴碎编修", "王府侧院（本人）", "某人的窝（投喂）",
    "走后巷角门敲三声", "门没锁直接推", "宫里宴饮喝了一肚子温吞没味", "御膳房那种绵软膻气的假羊肉",
    "红焖滩羊排配烤馕", "不要香菜", "放门口就行", "麻烦轻一点敲门", "导师以为我在看的论文",
    "凌晨两点的关东煮哲学", "怎么对付某个麻烦精", "改天带你去城南找找", "搜查厢房", "官署苦茶",
    "玉简传信", "调息定神", "情绪与生理强关联", "实用利落兼带几件扎眼红衣", "买东西极快但退换极少",
    "饿到极限才想起吃", "谁懂啊", "西北菜/羊肉", "伙计小赵"];
  keys.forEach(k => {
    const spec = P.phoneProbeSpec(k, char, [], "", []);
    BANNED.forEach(b => {
      assert.ok(spec.instruction.indexOf(b) < 0, k + " 的推演任务里还留着可照抄的内容示范：" + b);
      assert.ok(spec.schemaHint.indexOf(b) < 0, k + " 的 schemaHint 里还留着可照抄的内容示范：" + b);
    });
  });
  // 格式示范照留——照抄「08:24」没问题，它只是在说时长长什么样
  assert.match(P.phoneProbeSpec("bili", char, [], "", []).instruction, /08:24/);
  // 时长、时刻这类【格式示范】照留——照抄「00:18:42」没问题，它只是在说时长长什么样
  assert.match(P.phoneProbeSpec("latenight", char, [], "", []).instruction, /00:18:42/);
});

test("小红书自己的笔记和草稿也有标签", () => {
  const P = loadPhone();
  const spec = P.phoneProbeSpec("liked", char, [], "", []);
  assert.match(spec.instruction, /mine \*\*2-4 条\*\*他自己发出去的笔记：title、excerpt、tags/);
  assert.match(spec.instruction, /title、excerpt、tags（1-3 个）、savedAt/);
  assert.ok(/"mine":\[\{[^\]]*"tags"/.test(spec.schemaHint), "mine 的 schema 里没有 tags");
  assert.ok(/"drafts":\[\{[^\]]*"tags"/.test(spec.schemaHint), "drafts 的 schema 里没有 tags");
  // 卡片上要画出来
  assert.match(SRC, /A\(x\.tags\)\.length \? h\("div", \{ className: "flex flex-wrap"/);
});

test("顶栏的返回和刷新不再套白圆框", () => {
  // 她 2026-08-29：「好多界面的返回和刷新都是在圆框里面的，弄掉弄好看的」
  assert.doesNotMatch(SRC, /borderRadius: 99, background: "rgba\(255,255,255,\.86\)"/);
  assert.doesNotMatch(SRC, /borderRadius: 99, background: "rgba\(255,255,255,\.72\)"/);
  assert.doesNotMatch(SRC, /borderRadius: 99, background: "rgba\(0,0,0,\.32\)"/);
  // 压在封面上的那颗改用一条渐变把图标托住，而不是套个圆
  assert.match(SRC, /linear-gradient\(180deg,rgba\(0,0,0,\.34\),transparent\)/);
});

test("从 app 退回桌面时回到原来那一页，不弹回第一页", () => {
  // 她 2026-08-29：「点开第二页的 app 后退后又回到第一页了，每次都得翻回来好累」
  // 病因：点进 app 时桌面整个卸载，回来重挂 scrollLeft 就是 0。
  assert.match(SRC, /const deskPageRef = useRef\(0\);/);
  assert.match(SRC, /deskPageRef\.current = deskPage;/);
  assert.match(SRC, /deskRef\.current\.scrollLeft = deskRef\.current\.clientWidth \* n;/);
  // ⚠️v59.36：外观设置也是【整页顶掉桌面】的一层，退回来同样会弹回第一页
  // （她 2026-09-01：「外观退出去又跳回第一页」），所以它也得在依赖里。
  // 核的是【每一层会顶掉桌面的东西都在这份依赖里】，不是某一份写死的依赖表。
  assert.match(SRC, /\}, \[open, inList, lookOpen\]\);/);
  assert.match(SRC, /if \(open \|\| inList \|\| lookOpen \|\| !deskRef\.current\) return;/, "归位时没把外观那一层算进去");
  // const 有暂时性死区：读它的 effect 在前、声明在后 = 一渲染就整页白
  assert.ok(SRC.indexOf("const [lookOpen, setLookOpen] = useState(false);") < SRC.indexOf("if (open || inList || lookOpen"),
    "lookOpen 声明在读它的 effect 后面，暂时性死区会让整页白");
});

test("视频和深夜台的账号在界面上看得见", () => {
  // 她 2026-08-29：「视频的 uid 昵称和深夜台的 id 在哪儿呢我没看到」
  // 原来只塞在搜索框的占位文字里，等于没有。
  assert.match(SRC, /他自己的账号条：昵称 \+ 等级 \+ UID/);
  assert.match(SRC, /"LV" \+ me\.level/);
  assert.match(SRC, /"UID " \+ me\.uid/);
  assert.doesNotMatch(SRC, /me\.name \+ " · Lv" \+ \(me\.level \|\| 1\)/);
  // 深夜台那串号单独做成一枚方框标签
  assert.match(SRC, /me\.uid \? me\.uid : "未登记"/);
});

test("浏览器做成真浏览器：标签页 / 搜索 / 书签 / 无痕", () => {
  const { FIXTURES: F } = require("./helpers/phone-render.js");
  const P = loadPhone();
  const props = { d: F.browser, char, t: {}, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  ["tabs", "search", "marks", "priv"].forEach(k =>
    assert.doesNotThrow(() => loadPhone({ 0: k }).BrowserView(props), k + " 这一页炸了"));
  assert.doesNotThrow(() => loadPhone({ 1: { ...F.browser.tabs[0] } }).BrowserView(props), "标签详情炸了");
  assert.doesNotThrow(() => loadPhone({ 1: { ...F.browser.private[0], _priv: true } }).BrowserView(props), "无痕详情炸了");
  [null, {}, { tabs: "x", searches: 3, marks: [{ items: "y" }], private: 5 }].forEach((d, i) =>
    ["tabs", "search", "marks", "priv"].forEach(k =>
      assert.doesNotThrow(() => loadPhone({ 0: k }).BrowserView({ ...props, d }), "脏数据 " + i + " 在 " + k + " 页炸了")));
  // 地址栏 + 四个页签
  assert.match(SRC, /const PAGES = \[\n    \{ key: "tabs", zh: "标签页"/);
  assert.match(SRC, /zh: "无痕"/);
  // 无痕整页走 hidden 档
  assert.match(SRC, /peekBtn\(isPriv \? "hidden" : "quiet"/);
  const spec = P.phoneProbeSpec("browser", char, [], "", []);
  ["tabs", "searches", "marks", "private"].forEach(k =>
    assert.ok(spec.schemaHint.includes('"' + k + '"'), k + " 不在 schema 里"));
  assert.match(spec.instruction, /一堆没关的标签页是这个人脑子的横截面/);
  assert.match(spec.instruction, /至少有一个是开了很久、他自己也说不清为什么不关的/);
  assert.match(spec.instruction, /搜索词比访问过的网页更暴露人/);
  assert.match(spec.instruction, /这是他专门开了不留记录的那几页/);
});

test("设置那个 app 是删掉了，不是留着不用", () => {
  const P = loadPhone();
  assert.ok(!P.PHONE_APPS.some(a => a.key === "settings"), "settings 还在册");
  assert.equal(P.PHONE_ANGLE.settings, undefined);
  assert.equal(P.PHONE_DIGEST_PICK.settings, undefined);
  assert.equal(P.phoneProbeSpec("settings", char, [], "", []).schemaHint, "{}");
  // 桌面小组件里那个「屏幕使用」特例也跟着删了
  assert.doesNotMatch(SRC, /isScreen/);
  assert.doesNotMatch(SRC, /data\.settings && data\.settings\.screenTime/);
});

test("电话：通话 / 短信 / 信箱 / 联系人 四页都能渲", () => {
  const { FIXTURES: F } = require("./helpers/phone-render.js");
  const props = { d: F.calls, char, t: {}, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  ["calls", "sms", "vm", "people"].forEach(k =>
    assert.doesNotThrow(() => loadPhone({ 0: k }).PhoneCallsView(props), k + " 这一页炸了"));
  [{ kind: "call", x: F.calls.calls[1] }, { kind: "sms", x: F.calls.sms[1] }, { kind: "vm", x: F.calls.voicemail[0] }, { kind: "call", x: {} }]
    .forEach((o, i) => assert.doesNotThrow(() => loadPhone({ 1: o }).PhoneCallsView(props), "详情 " + i + " 炸了"));
  [null, {}, { calls: "x", sms: [{ msgs: 3 }], voicemail: 5, frequent: "y", blocked: [{}] }].forEach((d, i) =>
    ["calls", "sms", "vm", "people"].forEach(k =>
      assert.doesNotThrow(() => loadPhone({ 0: k }).PhoneCallsView({ ...props, d }), "脏数据 " + i + " 在 " + k + " 页炸了")));
});

test("电话的重点是没接通的那些，而且每通都有他自己的想法", () => {
  const P = loadPhone();
  const spec = P.phoneProbeSpec("calls", char, [], "", []);
  assert.match(spec.instruction, /真正有东西的是没接通的那些/);
  assert.match(spec.instruction, /\*\*至少三条是没接通的\*\*/);
  assert.match(spec.instruction, /每一条不接的理由都不一样/);
  assert.match(spec.instruction, /\*\*他对这通电话的真实想法\*\*/);
  assert.match(spec.schemaHint, /"thought"/);
  // 未接在界面上要看得出来
  assert.match(SRC, /const missed = x\.answered === false/);
  assert.match(SRC, /color: missed \? CALL_RED/);
  // 语音留言：单向的，所以要有他一直没听的那条
  assert.match(spec.instruction, /留言是单向的，本身就说明对方联系不上他/);
  assert.match(SRC, /他一直没听/);
});

test("短信和微信收发的东西必须区分开", () => {
  // 她 2026-08-29：「可以把短信也做进去。但是要区分开短信和微信会发送和接收到的内容」
  const P = loadPhone();
  const spec = P.phoneProbeSpec("calls", char, [], "", []);
  assert.match(spec.instruction, /短信和微信收发的东西完全不是一回事，别把微信那套搬过来/);
  assert.match(spec.instruction, /短信里\*\*绝大多数不是人\*\*/);
  assert.match(spec.instruction, /熟人一旦出现在短信里，必有一个理由/);
  assert.match(spec.instruction, /日常闲聊属于微信，不属于这里/);
  assert.match(spec.instruction, /几乎没有表情、没有连发、没有撒娇/);
  assert.match(spec.schemaHint, /"kind"/);
  // 界面上「通知」和「人」两种样式分得开
  assert.match(SRC, /const isNotice = x\.kind !== "人"/);
  // 电话和微信的常联系人不是同一批
  assert.match(spec.instruction, /电话打给谁，和微信聊得多的，往往不是同一批人/);
});
