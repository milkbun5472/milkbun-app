const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

test("查手机桌面是全屏双页、可横滑并保留底部 Dock", () => {
  assert.match(src, /const PHONE_DESKTOP_PAGES = \[/);
  assert.match(src, /scrollSnapType: "x mandatory"/);
  assert.match(src, /scrollSnapAlign: "start"/);
  assert.match(src, /PHONE_DOCK_KEYS\.map/);
  assert.match(src, /deskRef\.current\.scrollTo/);
});

test("原有 11 个可查 App 没在桌面改造里丢入口", () => {
  const all = [...src.matchAll(/key: "(wechat|notes|calls|browser|shopping|album|forum|music|settings|recordings|video)"/g)]
    .map(m => m[1]);
  const declared = [...new Set(all)];
  assert.deepEqual(declared.sort(), ["album", "browser", "calls", "forum", "music", "notes", "recordings", "settings", "shopping", "video", "wechat"]);

  const dock = src.match(/const PHONE_DOCK_KEYS = \[([^\]]+)\]/)[1];
  const pages = src.match(/const PHONE_DESKTOP_PAGES = \[([\s\S]*?)\n\];/)[1];
  declared.forEach(key => assert.ok((dock + pages).includes('"' + key + '"'), key + " 没有桌面入口"));
});

test("桌面组件复用现有数据，不新增模型生成项目", () => {
  assert.match(src, /latestLine\(data\.wechat/);
  assert.match(src, /latestLine\(data\.music/);
  assert.match(src, /latestLine\(data\.album/);
  assert.match(src, /data\.settings && data\.settings\.screenTime/);
});
