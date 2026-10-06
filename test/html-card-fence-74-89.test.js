// 她 2026-10-06：「claude 还是发不了 html，我们加的那个世界书还是不管用」
//   Claude 爱把卡片包进 ```html；extractJSON 只削掉反引号，前面剩一个「html」，卡片就认不出来了
const test = require("node:test");
const assert = require("node:assert/strict");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
const a = s.indexOf("const HTML_CARD_MIN"), b = s.indexOf("function splitLongBubble");
const f = new Function(s.slice(a, b) + ";return {htmlCardOf,splitCardsAndLines};")();
const card = '<div style="padding:8px;border-radius:12px;background:#fff"><b>冰箱</b><p>牛奶 鸡蛋 草莓 还有你上次说想吃的布丁</p></div>';
test("包在代码块里、只剩一个 html 标签、前面挂着注释，都认得出是一张卡", () => {
  for (const t of [card, "```html\n" + card + "\n```", "html\n" + card, "<!-- 冰箱 -->\n" + card]) assert.equal(f.htmlCardOf(t), card);
  assert.ok(f.htmlCardOf("<section>" + card + "</section>"));
});
test("先说一句话再跟一个代码块：话归话、卡归卡", () => {
  assert.deepEqual(f.splitCardsAndLines("打开给你看\n```html\n" + card + "\n```"), ["打开给你看", card]);
  assert.deepEqual(f.splitCardsAndLines("打开给你看\nhtml\n" + card), ["打开给你看", card]);
});
test("夹在句子里的尖括号照旧不当卡", () => {
  assert.equal(f.htmlCardOf("<哭>我不管我就要抱一下你听见没有<哭>我不管我就要抱一下你听见没有<哭>我不管我就要抱一下你听见没有"), null);
  assert.equal(f.htmlCardOf("<p>短</p>"), null);
});
