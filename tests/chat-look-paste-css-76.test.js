// 整套美化那一栏贴进来的是一段 CSS（2026-10-29 群里截图）：不报「不是美化文件」，接进「只给 TA 写 CSS」
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("ChatLookPack 的 take 认得裸 CSS，接在原来的 customCSS 后面", () => {
  const a = src.indexOf("function ChatLookPack("), body = src.slice(a, a + 6000);
  assert.match(body, /customCSS: old \? old \+ "\\n\\n" \+ css : css/);
  assert.match(body, /只给这个群写 CSS/);
});
