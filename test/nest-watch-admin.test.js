// 秋秋小窝 · 管理员的新消息提醒（她 2026-10-18：「通知里面有，app 外面也有红点，新发的都会提醒」）
//   真跑 js/nest-watch.js：假的小窝墙 + 假的 localStorage（照 nest-watch 自己读写的那几把 qq_ 键）。
//   钉住四件事：没口令什么都不拉；第一次只记「现在」不把墙上原有的当新的；新发的算进红点、横幅同一批只弹一次；
//   点进小窝就清零。再钉接线：红点走主屏那一份 appBadgeOf，文件夹盖子和展开里都挂；横幅走同一个 queueBanner。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

function boot(walls) {
  const store = {};
  const calls = [];
  const g = {
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  };
  const fetch = async url => {
    calls.push(url);
    const items = /kind=post/.test(url) ? walls.post : walls.all;
    return { ok: true, json: async () => ({ items: items.slice() }) };
  };
  new Function("window", "globalThis", "fetch", "qqDeviceId", R("js/nest-watch.js"))(g, g, fetch, () => "dev1");
  return { W: g.NestWatch, store, calls };
}

test("没有管理口令：一次都不去拉，什么都不亮", async () => {
  const { W, calls } = boot({ all: [{ id: "a", created: 100 }], post: [] });
  const r = await W.check();
  assert.deepEqual(r, { fresh: [], untold: [] });
  assert.equal(calls.length, 0);
});

test("第一次只记下现在：墙上原有的不当成新的报", async () => {
  const walls = { all: [{ id: "a", created: 100 }], post: [{ id: "p", created: 90 }] };
  const { W, store } = boot(walls);
  store.qq_nestAdmin = "k";
  const r = await W.check();
  assert.equal(r.fresh.length, 0);
  assert.equal(store.qq_nestAdminSeen, "100");
});

test("新发的进红点；横幅同一批只弹一次；作品墙和留言板两面都看", async () => {
  const walls = { all: [{ id: "a", created: 100 }], post: [] };
  const { W, store, calls } = boot(walls);
  store.qq_nestAdmin = "k";
  await W.check();
  walls.all.unshift({ id: "b", created: 200, title: "新主题" });
  walls.post.unshift({ id: "p2", created: 300, kind: "post", title: "反馈" });
  const r1 = await W.check();
  assert.deepEqual(r1.fresh.map(x => x.id), ["p2", "b"], "新的在前，两面墙都算");
  assert.deepEqual(r1.untold.map(x => x.id), ["p2", "b"]);
  assert.ok(calls.some(u => /kind=post/.test(u)) && calls.some(u => !/kind=/.test(u)));
  const r2 = await W.check();
  assert.equal(r2.fresh.length, 2, "没点进去之前红点一直在");
  assert.equal(r2.untold.length, 0, "同一批不再弹横幅");
});

test("点进小窝就算看过：红点清零；撤掉口令游标一起清", async () => {
  const walls = { all: [{ id: "a", created: 100 }], post: [] };
  const { W, store } = boot(walls);
  store.qq_nestAdmin = "k";
  await W.check();
  walls.all.unshift({ id: "b", created: 200 });
  await W.check();
  W.markSeen();
  assert.equal((await W.check()).fresh.length, 0);
  W.forget();
  assert.ok(!("qq_nestAdminSeen" in store) && !("qq_nestAdminTold" in store));
});

test("接线：开机就加载、小窝页面从它拿地址和口令、红点和横幅各走公共那一份", () => {
  const html = R("index.html"), app = R("js/app.js"), comp = R("js/components.js"), nest = R("js/nest.js");
  assert.match(html, /<script src="js\/nest-watch\.js\?v=/, "提醒要在点进小窝之前就响，得开机加载");
  assert.ok(html.indexOf("js/nest-watch.js") < html.indexOf("js/app.js"));
  assert.match(nest, /const NEST = window\.NestWatch\.NEST;/);
  assert.match(nest, /const adminToken = window\.NestWatch\.adminToken;/);
  assert.doesNotMatch(nest, /"https:\/\/qiuqiu-machine\.pages\.dev\/nest"/, "地址又抄了一份");
  // 红点：主屏图标、文件夹盖子、文件夹展开都问同一个 appBadgeOf
  assert.match(comp, /if \(key === "nest"\) return \(notif && notif\.nest\) \|\| 0;/);
  assert.match(comp, /badge: appBadgeOf\(key\), onClick/);
  assert.match(comp, /badge: fApps\.reduce\(function \(s, a\) \{ return s \+ appBadgeOf\(a\.key\); \}, 0\)/);
  assert.match(comp, /badgeOf: appBadgeOf,/);
  // 横幅：聊天来的和 App 来的同一个 queueBanner；点开去那个 App
  assert.match(app, /const queueBanner = b => \{/);
  assert.match(app, /pushAppBanner\("nest", \{ name: "秋秋小窝", tag: "管理", G: window\.GNest/);
  assert.match(app, /if \(b\.type === "app"\) setScreen\(b\.app\); else openChatById/);
  // 点进小窝清零；正在小窝里不弹不亮
  assert.match(app, /if \(screen === "nest"\) \{ if \(window\.NestWatch\) window\.NestWatch\.markSeen\(\); clearAppNotif\("nest"\); [^\n]*window\.Notify\.badge\(0\); \}/, "点进小窝：红点、桌面图标上的数一起清");
  assert.match(app, /if \(screenRef\.current === "nest"\) \{ window\.NestWatch\.markSeen\(\); return; \}/);
});

// 她 2026-10-19「我还是收不到小窝提醒」：十分钟那一拍原来只在前台查，后台永远轮不到系统通知那一支
test("后台也查；人不在 app 里走系统通知，在就弹横幅；桌面图标挂同一个数；切回来 focus 也认", () => {
  const app = R("js/app.js"), notify = R("js/notify.js"), nest = R("js/nest.js"), sw = R("tools/ios-shell/LisaPhone/LisaPhone/AppDelegate.swift");
  assert.match(app, /const iv = setInterval\(\(\) => nestWatchRun\(true\), 10 \* 60000\);/, "十分钟那一拍又只在前台跑了");
  assert.match(app, /if \(document\.visibilityState === "hidden"\) \{ if \(window\.Notify\) window\.Notify\.push\(\{ title: "秋秋小窝", body: text, tag: "nest-new", screen: "nest" \}\); \}\n\s*else pushAppBanner/);
  assert.match(app, /window\.Notify\.badge\(r\.fresh\.length\)/);
  assert.match(app, /window\.addEventListener\("focus", kick\);/);
  assert.match(notify, /async function badge\(n\)/);
  assert.match(notify, /ask\(\{ action: "badge", count: n \}\)/);
  assert.match(sw, /case "badge":/, "壳那头接 badge 的那一支");
  // 管理中那一行：看得见最近一次查得怎么样，能就地再查
  assert.match(nest, /adminToken\(\) \? h\(WatchLine, \{ t(?:, onGate: \(\) => push\(\{ v: "gate" \}\))? \}\) : null,/);
  assert.match(nest, /W\.lastCheck \? W\.lastCheck\(\) : null/);
});

test("最近一次查的结果记下来：成了记时间和墙上最新那条，失败记原因", async () => {
  const walls = { all: [{ id: "a", created: 100 }], post: [] };
  const { W, store } = boot(walls);
  assert.equal(W.lastCheck(), null);
  store.qq_nestAdmin = "k";
  await W.check();
  const L = W.lastCheck();
  assert.equal(L.ok, true); assert.equal(L.top, 100);
});
