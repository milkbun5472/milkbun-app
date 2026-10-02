// 她 2026-10-02：颜文字里的假名挂出「译」键；要一个开关整个关掉翻译
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js/engine.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js/screens.js"), "utf8");
const load = store => new Function("localStorage", src.slice(src.indexOf("function _transStrip("), src.indexOf("// iOS 刘海（v56.63）")) + "; return translatableLang;")({ getItem: k => store[k] || null });
test("颜文字不算外语，真日文照旧", () => {
  const T = load({});
  assert.equal(T("老婆晚安 梦里要梦到我(っ˘з(˘⌣˘ )"), "");
  assert.equal(T("好耶(*ﾟ∀ﾟ*)"), "");
  assert.equal(T("今夜も残業"), "日文");
  assert.equal(T("こんにちは"), "日文");
});
test("开关关掉就一条都不挂", () => {
  assert.equal(load({ x_noTranslate: "1" })("こんにちは"), "");
  const comp = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");
  assert.match(comp, /localStorage\.setItem\("x_noTranslate", on \? "" : "1"\)/);
  assert.equal((comp.match(/dispRow\("外语气泡显示「译」键/g) || []).length, 2, "单聊设置和群设置各一颗");
});
