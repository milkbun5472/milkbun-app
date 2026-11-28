const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
test("发照片说明讲到翻出来的旧照（单聊群聊共用 photoCapLine）", () => {
  const src = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  assert.match(src, /照片也可以是从相册里翻出来的旧照：小时候的、上学时的、以前某一年的；也可以是想象中以后的样子：几年后、几十年后、老了以后。/);
});
