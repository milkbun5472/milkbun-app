const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const grab = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, "抠不出：" + a); return src.slice(i, j); };
const APPS = new Function(grab("const PHONE_APPS = [{", "const PHONE_LABEL") + "\nreturn PHONE_APPS;")().map(a => a.key);
const { PHONE_DESKTOP_LAYOUTS: LS, PHONE_DECOR: DECOR } =
  new Function(grab("const PHONE_DECOR = [", "const phoneStableHash") + "\nreturn { PHONE_DESKTOP_LAYOUTS, PHONE_DECOR };")();
const iconsOf = (l, p) => (l.pages[p] || []).filter(k => !(l.widgets[p] || []).some(w => w.key === k));

// 她 2026-08-30：「加了一堆新功能之后这四种分别怎么排比较好」
test("每一种桌面，每个 app 都够得到", () => {
  LS.forEach(l => {
    const seen = new Set(l.dock);
    l.pages.forEach(p => p.forEach(k => seen.add(k)));
    l.widgets.forEach(ws => ws.forEach(w => { if (w.key !== "refresh" && DECOR.indexOf(w.key) < 0) seen.add(w.key); }));
    const miss = APPS.filter(k => !seen.has(k));
    assert.deepEqual(miss, [], l.id + " 这一种里够不到：" + miss.join("、"));
  });
});

// 第一页图标多一行就是一百来像素，正好把整排图标顶到屏幕外面（实测量出来的）
test("第一页图标不许超过一行（4 个）", () => {
  LS.forEach(l => {
    const n = iconsOf(l, 0).length;
    assert.ok(n <= 4, l.id + " 第一页有 " + n + " 个图标，第二行会被顶出屏幕：" + iconsOf(l, 0).join("、"));
  });
});

test("同一页里，已经有组件的 app 不再摆图标", () => {
  LS.forEach(l => l.pages.forEach((keys, p) => {
    const dup = keys.filter(k => (l.widgets[p] || []).some(w => w.key === k));
    assert.deepEqual(dup, [], l.id + " 第 " + (p + 1) + " 页重复摆了：" + dup.join("、"));
  }));
});

test("四种桌面的节奏真的不一样，不是换几个名字", () => {
  const shape = l => (l.widgets[0] || []).map(w => (w.span || 1) + (w.size || "s")).join(",");
  const shapes = LS.map(shape);
  assert.equal(new Set(shapes).size, LS.length,
    "有两种桌面的第一页骨架一模一样，换的只是里面的名字：\n" + LS.map((l, i) => l.id + " → " + shapes[i]).join("\n"));
  // 每种至少得有一个别人没有的组件，不然四种看起来还是同一部手机
  LS.forEach(l => {
    const mine = new Set([].concat.apply([], l.widgets).map(w => w.key));
    const others = new Set([].concat.apply([], LS.filter(x => x !== l).map(x => [].concat.apply([], x.widgets))).map(w => w.key));
    const only = [...mine].filter(k => !others.has(k));
    assert.ok(only.length, l.id + " 没有一个自己独有的组件");
  });
});

test("装饰件不是 app：点表什么都不做，相框去相册，一句话去便签", () => {
  DECOR.forEach(k => assert.ok(APPS.indexOf(k) < 0, k + " 跑进 PHONE_APPS 了，它不是一个能打开的 app"));
  const w = grab("const deskWidget = spec => {", "  const pages = layout.pages.map(");
  assert.match(w, /if \(key === "clock"\) return;/, "点表会去开一个不存在的 app");
  assert.match(w, /key === "frame" \? "album"/, "相框没有落点");
  assert.match(w, /key === "saying" \? "notes"/, "一句话没有落点");
  // 装饰件也得真的被用上，不然写了等于没写
  const used = new Set([].concat.apply([], [].concat.apply([], LS.map(l => l.widgets))).map(x => x.key));
  DECOR.forEach(k => assert.ok(used.has(k), k + " 一个桌面都没用到"));
});

// 以前所有组件共用一套「一行灰标签 + 一行黑字」，音乐健康相册日历长得一模一样
test("认得出来的那几个组件各有各的长相，不是一起走兜底", () => {
  const body = grab("  function deskBody(key, dark, hero) {", "  const deskWidget = spec => {");
  ["timeline", "wechat", "music", "health", "album", "calendar", "notes", "reading", "tally", "mail", "clock", "frame", "saying"]
    .forEach(k => assert.ok(body.indexOf('key === "' + k + '"') > 0, k + " 还在走通用的那一套，摆出来跟别的组件一个样"));
  assert.match(body, /return h\("div", \{ style: \{ fontFamily: F_DISPLAY[\s\S]{0,200}widgetCopy\(key\)\)/, "兜底那一支没了，没写长相的组件会整块空掉");
});

test("刷新是一条细通栏，不是一整块组件", () => {
  const w = grab('if (key === "refresh") return h("button"', "const decor = PHONE_DECOR");
  assert.match(w, /gridColumn: "span 2"/, "刷新还占半行，旁边会空一块");
  const mh = w.match(/minHeight: (\d+)/);
  assert.ok(mh && Number(mh[1]) <= 60, "刷新还是一整块组件的高度（" + (mh && mh[1]) + "），会把图标顶出屏幕");
});

test("两个把图标顶出屏幕的坑：相册别用 aspectRatio，健康别摆英文字段名", () => {
  const body = grab("  function deskBody(key, dark, hero) {", "  const deskWidget = spec => {");
  // ⚠️先把注释行剥掉再找——这一段的注释里就写着「别用 aspectRatio」，
  // 直接 indexOf 会命中自己的注释，测试永远红（第一版就是这样自摆乌龙的）
  const noComment = x => x.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  const album = noComment(body.slice(body.indexOf('if (key === "album")'), body.indexOf('if (key === "calendar")')));
  assert.ok(!/aspectRatio\s*:/.test(album), "相册又用了 aspectRatio：两列宽的格子里 1:1 会撑到 240px 高");
  assert.match(album, /repeat\(4,1fr\)/, "相册不是固定四格，照片少的时候会变成两条大色块");
  const health = body.slice(body.indexOf('if (key === "health")'), body.indexOf('if (key === "album")'));
  assert.match(health, /steps: "步数"/, "健康会把 steps/sleep 这种字段名原样摆出来");
  assert.match(health, /ZH\[k2\]/, "没有过滤认不出来的字段，schema 会露到脸上");
});
