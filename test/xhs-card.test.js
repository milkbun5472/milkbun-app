const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const X = require("../js/xhs-card.js");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), idx = fs.readFileSync(__dirname + "/../index.html", "utf8");
test("读两种分享文案", () => {
  const a = X.parse("62 【秋天第一杯奶茶 - 小鹿 | 小红书 - 你的生活指南】 😆 AbC123xyz https://www.xiaohongshu.com/discovery/item/abc?xsec=1");
  assert.equal(a.title, "秋天第一杯奶茶"); assert.equal(a.author, "小鹿"); assert.match(a.url, /discovery\/item\/abc/);
  const b = X.parse("周末去哪玩 http://xhslink.com/a/Xy12，复制本条信息，打开【小红书】App查看精彩内容！");
  assert.equal(b.title, "周末去哪玩"); assert.equal(b.url, "http://xhslink.com/a/Xy12"); assert.equal(b.note, "");
  assert.equal(X.parse("今天好累 https://example.com"), null);
});
test("挑工具：小红书的优先，其次抓网页，要有放链接的格子", () => {
  const sch = k => ({ properties: { [k]: { type: "string" } } });
  const tools = [{ name: "a__fetch", raw: "fetch", input_schema: sch("url") }, { name: "b__xhs_note", raw: "get_xhs_note", input_schema: sch("note_url") }, { name: "c__search", raw: "search", input_schema: sch("q") }];
  assert.equal(X.pickTool(tools).tool.name, "b__xhs_note"); assert.equal(X.pickTool(tools).arg, "note_url");
  assert.equal(X.pickTool([tools[2]]), null);
});
test("从网页或 Markdown 抠封面、标题、正文", () => {
  const d = X.digest('<html><meta property="og:title" content="奶茶 - 小红书"><meta property="og:image" content="https://sns-webpic.xhscdn.com/a.jpg?x=1&amp;y=2"><meta name="description" content="好喝">');
  assert.equal(d.title, "奶茶"); assert.equal(d.cover, "https://sns-webpic.xhscdn.com/a.jpg?x=1&y=2"); assert.equal(d.desc, "好喝");
  const m = X.digest("Title: 奶茶\nURL Source: x\n![](https://ci.xiaohongshu.com/p.jpg)\n正文在这");
  assert.equal(m.title, "奶茶"); assert.equal(m.desc, "正文在这");
  assert.match(X.modelText("原文", { title: "奶茶", desc: "正文在这" }), /原文\n\[这条小红书笔记《奶茶》，正文：正文在这\]/);
});
test("单聊群聊发出去都是卡，卡进公共那张表", () => {
  assert.match(comp, /kind === "xhsshare"\) return window\.XhsCard/);
  assert.equal((app.match(/kind: "xhsshare", xhs: xhs, xid: xid/g) || []).length, 2);
  assert.match(idx, /js\/xhs-card\.js\?v=/);
});
