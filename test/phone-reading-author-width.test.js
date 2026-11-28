const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
test("查手机书架：作者最多占四成宽，不把书名挤成一列", () => {
  const src = fs.readFileSync(__dirname + "/../js/phone-ui.js", "utf8");
  assert.match(src, /b\.author \? h\("div", \{ style: \{ flexShrink: 1, minWidth: 0, maxWidth: "42%", textAlign: "right", wordBreak: "break-word"/);
});
