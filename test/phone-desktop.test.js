const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

test("查手机桌面是全屏双页、可横滑并保留底部 Dock", () => {
  assert.match(src, /const PHONE_DESKTOP_PAGES = \[/);
  assert.match(src, /scrollSnapType: "x mandatory"/);
  assert.match(src, /scrollSnapAlign: "start"/);
  assert.match(src, /layout\.dock\.map/);
  assert.match(src, /deskRef\.current\.scrollTo/);
});

test("16 个可查 App 一个都没在桌面上丢入口", () => {
  // v57.60 设置删了（她：「设置感觉没啥用了可以删了」）
  // v57.56 录音并进便签（本来就是同一件事的两种载体）
  // v57.47 加了阅读/赞过/订单/健康/剪贴板/日历六个；
  // v57.50 订单并进购物（参考稿本来就是一整个购物 app，两个并存必然复读）；
  // v57.52 加了外卖（吃什么、几点吃、送到谁那儿，和网购不重叠）
  const block = src.match(/const PHONE_APPS = \[([\s\S]*?)\n\];/)[1];
  const declared = [...new Set([...block.matchAll(/key: "([a-z]+)"/g)].map(m => m[1]))];
  assert.deepEqual(declared.sort(), ["album", "browser", "calendar", "calls", "clipboard", "forum", "health",
    "liked", "music", "notes", "reading", "shopping", "takeout", "wechat"]
    .concat(["bili", "latenight"]).sort());

  const dock = src.match(/const PHONE_DOCK_KEYS = \[([^\]]+)\]/)[1];
  const pages = src.match(/const PHONE_DESKTOP_PAGES = \[([\s\S]*?)\n\];/)[1];
  declared.forEach(key => assert.ok((dock + pages).includes('"' + key + '"'), key + " 没有桌面入口"));
});

test("桌面组件复用现有数据，不新增模型生成项目", () => {
  assert.match(src, /const widgetData = key/);
  assert.match(src, /return latestLine\(widgetData\(key\)/);
  // v57.60 删了设置那个 app，「屏幕使用」这个小组件特例也跟着删掉
});

test("角色会稳定选中不同桌面性格，而不是每次随机换位", () => {
  assert.match(src, /const PHONE_DESKTOP_LAYOUTS = \[/);
  assert.match(src, /id: "social"/);
  assert.match(src, /id: "archive"/);
  assert.match(src, /id: "media"/);
  assert.match(src, /id: "wander"/);
  assert.match(src, /const phoneStableHash =/);
  assert.match(src, /const phoneDesktopLayout = char/);
  assert.doesNotMatch(src, /Math\.random\(\).*PHONE_DESKTOP_LAYOUTS/);
});

test("不同布局可改变 Dock、分页和组件尺寸，但都保留全部 App", () => {
  const block = src.match(/const PHONE_DESKTOP_LAYOUTS = \[([\s\S]*?)\n}\];/)[1];
  for (const key of ["wechat", "notes", "calls", "browser", "shopping", "album", "forum", "music", "bili", "latenight"]) {
    assert.ok(block.includes('"' + key + '"'), key + " 没有出现在角色布局池");
  }
  assert.match(block, /size: "hero"/);
  assert.match(block, /size: "wide"/);
  assert.match(src, /layout\.dock\.map/);
  assert.match(src, /layout\.pages\.map/);
  assert.match(src, /layout\.widgets\[pageIndex\]/);
});
