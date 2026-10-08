const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const vm = require("vm");
const core = fs.readFileSync(__dirname + "/../js/core.js", "utf8");

// 照 pdf.js getTextContent 的形状造一页：transform[3]＝字号，transform[5]＝基线 y
function run(items) {
  const a = core.indexOf("async function extractPdfText("), b = core.indexOf("if (typeof module !== \"undefined\"", a);
  const box = { loadPdfjs: async () => ({ getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items }) }) }) }) }) };
  vm.createContext(box);
  vm.runInContext(core.slice(a, b) + ";this.f=extractPdfText;", box);
  return box.f(new Uint8Array(1));
}
const it = (str, y, size, eol) => ({ str, transform: [size, 0, 0, size, 0, y], hasEOL: !!eol });

test("单词右上角的小数字贴在词后面，不另起一行", async () => {
  const out = await run([it("deep", 100, 10), it("13", 104, 6), it(" degree", 100, 10), it("24", 104, 6, true), it("下一行", 86, 10)]);
  assert.equal(out, "deep^13 degree^24\n下一行");
});

test("正常换行照旧", async () => {
  const out = await run([it("第一行", 100, 10), it("第二行", 86, 10)]);
  assert.equal(out, "第一行\n第二行");
});
