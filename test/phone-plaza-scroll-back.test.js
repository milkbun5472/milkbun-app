const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
test("查手机小红书：详情和列表外框各带 key，点进笔记再出来回到原位", () => {
  const src = fs.readFileSync(__dirname + "/../js/phone-ui.js", "utf8");
  assert.match(src, /const detailPage = open \? h\("div", \{ key: "pdetail",/);
  assert.match(src, /return h\("div", \{ key: "plist", className: "h-full min-h-0 flex flex-col relative", "data-wk": "papp", "data-app": "liked"/);
});
