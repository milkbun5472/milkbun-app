// 她 2026-09-04：「这个设置换图标的地方是错的，有些 app 都不在里面没法改，
// 有些在里面但是不是真 app」。
//
// 病根是老一套：主屏那份名单在 components.js 的 REG／dock 里，
// 主题工作台又在 theme-studio.js 里【自己抄了一份】APP_ICONS。两份走散了：
//   · 去处(dwell)、匿名问答(anon) 是真 app，那份名单里没有 → 改不了图标；
//   · 备忘录(memo)、朋友圈(moments) 在那份名单里，主屏上却没有这两个 app；
//   · dock 消息那格 key 是 "messages"，那边写的是 "chat"——名字对不上，
//     所以那一格【换了图标从来就没生效过】。
//
// 这份测试钉的是【只有一份名单】，不是钉名单的内容。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const ts = fs.readFileSync(path.join(root, "js/theme-studio.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "js/theme-studio-ui.js"), "utf8");

// 主屏此刻真正在摆的那些：REG 里 kind==="app" 的 + dock 那四格
const REGBLOCK = comp.slice(comp.indexOf("  const REG = {"), comp.indexOf("\n  };", comp.indexOf("  const REG = {")));
const HOME = [...REGBLOCK.matchAll(/^\s*(\w+): \{ kind: "app", zh: "([^"]+)"/gm)].map(m => m[1]);

test("换图标那一栏不再自己抄名单，问主屏要", () => {
  assert.ok(HOME.length >= 25, "REG 里只剩 " + HOME.length + " 个 app");
  // 名单从 REG + dock 现算，不是另写一份
  assert.match(comp, /if \(REG\[k\] && REG\[k\]\.kind === "app"\) rows\.push\(\[k, REG\[k\]\.zh\]\)/);
  assert.match(comp, /dock\.forEach\(function \(d\) \{ rows\.push\(\[d\.key, d\.zh\]\); \}\)/, "dock 那四格没并进去");
  assert.doesNotMatch(ts, /const APP_ICONS = \[/, "theme-studio 又抄了一份平行名单");
  assert.match(ts, /typeof window\.HomeAppList === "function"\) return window\.HomeAppList\(\)/);
  assert.match(ui, /studio\.appIconList\(\)\.map\(/, "界面没用上那个函数");
});

test("兜底那份故意只留几个——留一份完整副本就等于又抄了一遍", () => {
  const fi = ts.indexOf("const APP_ICONS_FALLBACK = [");
  assert.ok(fi > 0, "没有兜底");
  const fb = ts.slice(fi, ts.indexOf("\n", fi));
  assert.ok((fb.match(/\["/g) || []).length <= 5,
    "兜底那份有 " + (fb.match(/\["/g) || []).length + " 条——太全了，它会变成第二份名单");
});

test("加载时不许裸碰 window（有测试是切一段出来 eval 的）", () => {
  assert.doesNotMatch(comp, /^window\.HomeAppList = /m, "模块层裸写 window，切片 eval 的测试会整份崩");
  assert.match(comp, /if \(typeof window === "undefined"\) return;\s*\n\s*window\.HomeAppList = function/);
});

test("她点名的那两个真 app 现在改得了图标了", () => {
  for (const k of ["dwell", "anon"]) assert.ok(HOME.includes(k), k + " 不在主屏名单里？那这条推理就不成立了，回去重看");
  // 反过来：以前那份平行名单里的幽灵，现在不可能再出现——名单是现算的
  for (const ghost of ["memo", "moments", "chat", "ledger"])
    assert.ok(!HOME.includes(ghost), ghost + " 居然在 REG 里，那它就不是幽灵了");
  // dock 消息那格 key 是 messages 不是 chat（以前对不上，换了图标从来没生效过）
  const dock = comp.slice(comp.indexOf("  const dock = [{"), comp.indexOf("  const clearLP = function"));
  assert.match(dock, /key: "messages"/);
  assert.doesNotMatch(ts, /\["chat",/, "那个对不上的 chat 又回来了");
});

test("「应用前预览」整块删掉了（撤东西是删掉，不是留着）", () => {
  // 她：「这个页面下面的应用前预览也根本没有，删了吧」。
  // 那是 iframe 里自己搭的一套假页面：跟真页面只共享挂点名字，别的全是另写的。
  // 修过两轮（v61.03 补挂点、v61.05 补铺满）还是对不上——她照着它调，调出来上机就不是那样。
  // ⚠️剥掉注释再查：删掉那一块时留了一段说明【为什么】删，那不算它还在。
  const code = ui.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.doesNotMatch(code, /应用前预览/);
  for (const dead of ["previewDoc", "previewBody", "iconImg", "chatPreview", "previewPage", "srcDoc"])
    assert.ok(!new RegExp("\\b" + dead + "\\b\\s*[=(]").test(code), dead + " 还留着，没删干净");
  assert.doesNotMatch(code, /h\("iframe"/, "iframe 还在");
  // 真正管用的那个（改的是真 app 本身）得留着
  assert.match(code, /先预览 30 秒/);
  assert.match(code, /正式应用/);
  assert.match(code, /studio\.PAGES\.map/, "页面 CSS 那个下拉被顺手删了");
});
