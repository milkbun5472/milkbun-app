// 别家导出的表情包 JSON（群友 2026-11-25）：认对象里的图和名字，不再把字段名当关键词
const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const a = fs.readFileSync("js/app.js", "utf8"), ui = fs.readFileSync("js/screens-ui.js", "utf8");
const i = a.indexOf("  const EMOTE_URL_KEYS"), j = a.indexOf("return out;\n  };", a.indexOf("const parseEmoteImport")) + 16;
const parse = new Function(a.slice(i, j) + "\nreturn parseEmoteImport;")();
test("一个对象一张图：网址优先，名字取 name 这类", () => {
  const out = parse(JSON.stringify({ stickers: [{ name: "开心", imageData: "data:image/png;base64,AAA", originalUrl: "https://x.cn/a.png" }, { title: "哭", imageData: "data:image/gif;base64,BBB" }] }, null, 2));
  assert.deepStrictEqual(out.map(x => [x.keyword, x.url]), [["开心", "https://x.cn/a.png"], ["哭", "data:image/gif;base64,BBB"]]);
  assert.ok(out[1].gif);
});
test("原来那种一行一个的照旧", () => {
  assert.deepStrictEqual(parse("1.不开心\nhttps://pic1.imgdb.cn/i/a.jpg").map(x => x.keyword), ["不开心"]);
});
test("JSON 文件直接导，不进框；data: 图存进本机图库", () => {
  assert.match(ui, /if \(\/\^\\s\*\[\\\[\{\]\/\.test\(text\) && pack && onImport\)/);
  assert.match(a, /url: await imgToVault\(x\.url\)/);
});
