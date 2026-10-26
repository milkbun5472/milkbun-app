// 一起听：「Cookie 去哪儿拿？」写在填 Cookie 那一栏底下（她 2026-10-25），攻略同一句话
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const ui = fs.readFileSync(path.join(__dirname, "../js/screens-ui.js"), "utf8"), man = fs.readFileSync(path.join(__dirname, "../js/assistant-manual.js"), "utf8");
test("填 Cookie 那栏底下有怎么拿：先扫码，扫不了再从浏览器复制 MUSIC_U", () => {
  assert.match(ui, /"data-wk": "neteasecookiehelp"/);
  assert.match(ui, /找到名字叫 MUSIC_U 的那一行/);
  assert.match(man, /\*\*Cookie 怎么拿：\*\*/);
});
