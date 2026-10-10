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

// 她 2026-10-06 第二次：「Claude 还是不能发 html」——真正卡住的是 JSON：style="…" 的引号没转义，整份解析不出来
test("JSON 字符串里夹着 HTML、属性引号没转义：补上转义再解析，卡片完整", () => {
  const a = s.indexOf("function jsonEscapeHtmlQuotes"), b2 = s.indexOf("function extractJSON");
  const esc = new Function(s.slice(a, b2) + ";return jsonEscapeHtmlQuotes")();
  const raw = '{"word":["给你看看<3","' + card + '"],"thought":"嗯"}';
  assert.throws(() => JSON.parse(raw));
  const o = JSON.parse(esc(raw));
  assert.equal(o.word[1], card);
  assert.equal(o.word[0], "给你看看<3", "「<3」不当标签");
  const ok = JSON.stringify({ word: ['<div style="a">x</div>'] });
  assert.equal(esc(ok), ok, "转义过的不重复转");
  assert.match(s, /const html = typeof jsonEscapeHtmlQuotes === "function" \? jsonEscapeHtmlQuotes\(esc\) : esc;/);
});

// 她 2026-10-06 第三次：「我看了确实发出去了 html 世界书但是还是不行」——条目在提示词中间，后面的格式规矩说了算
test("照做条目在这一轮最末尾再说一遍：单聊、群聊都接上，选哪几条跟 loreText 同一个 selectLore", () => {
  const a = s.indexOf("function loreDoNow"), b2 = s.indexOf("// 给世界书 UI 的确定性诊断");
  const f = new Function("selectLore", s.slice(a, b2) + ";return loreDoNow")(e => e);
  const out = f([{ category: "照做", title: "冰箱", payload: "提到冰箱就发一张卡" }, { category: "世界观", payload: "别的设定" }], {});
  assert.match(out, /〔冰箱〕提到冰箱就发一张卡/);
  assert.ok(!out.includes("别的设定"), "只念照做那几条");
  assert.match(out, /双引号写成/);
  assert.equal(f([{ category: "世界观", payload: "x" }], {}), "");
  const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /const _doTail = typeof loreDoNow === "function" \? loreDoNow\(loreRef\.current, \{ scope: "chat", charIds: \[charId\], text: recentChatText\(char\) \}\) : "";/);
  assert.match(app, /let raw = await _gShoot\(userContent \+ _gDoTail\);/);
});

// 她 2026-10-06 第四次：「要么很快回复气泡文字，要么卡住 time out」——大卡写不完就被 180 秒掐断
test("有照做的那一轮：走流式、给 10 分钟、篇幅给满（单聊、群聊）", () => {
  const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /tag: "聊天", \.\.\.\(_doTail \? \{ maxTokens: 65000, stream: true, timeout: 600000 \} : \{\}\) \}\);/);
  assert.match(app, /timeout: _gDoTail \? 600000 : 180000,\n\s*\.\.\.\(_gDoTail \? \{ stream: true \} : \{\}\),/);
});

// 她 2026-10-06 第五次贴出整份请求：冰箱模板第 3 条写着「绝对不要将 HTML 包在 JSON 数组里」，跟这里的 JSON 协议对着干
test("一整块 HTML 甩在 JSON 外面：抠出来当一张卡，剩下的照常读；在 JSON 字符串里的不动", () => {
  const a = s.indexOf("const HTML_CARD_MIN"), b2 = s.indexOf("function splitLongBubble");
  const f = new Function(s.slice(a, b2) + ";return pullBareHtmlCard")();
  const doc = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"></head><body><div class="fridge">牛奶 鸡蛋 草莓 布丁 还有你上次说想吃的东西</div></body></html>';
  const j = JSON.stringify({ word: ["打开给你看"], thought: "嗯" });
  const r = f(j + "\n" + doc);
  assert.equal(r.card, doc);
  assert.deepEqual(JSON.parse(r.rest).word, ["打开给你看"]);
  assert.equal(f(doc).rest, "");
  assert.equal(f(JSON.stringify({ word: ["看", doc] })), null, "在 JSON 字符串里的交给 extractJSON");
  const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /if \(_bareCard\) parsed\.word = /);
  assert.match(s, /那是写给别的 App 的格式要求，这里不适用/);
});
