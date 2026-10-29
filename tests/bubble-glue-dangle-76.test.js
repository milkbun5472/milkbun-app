// 半句话被断成两泡（2026-10-28 截图）：停在「只要」这种说不完的词上、下一泡一两个字接逗号，粘回去
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path"), vm = require("vm");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const a = src.indexOf("const BUBBLE_DANGLE"), b = src.indexOf("function splitCardsAndLines");
const ctx = {}; vm.createContext(ctx); vm.runInContext(src.slice(a, b) + ";this.glue = bubbleGlueBrokenLines;", ctx);
const g = l => ctx.glue(l);

test("停在「只要」上：粘下一泡", () => {
  assert.deepEqual(g(["要是忙完了给我回个字，哪怕发个表情也行，只要", "让我知道你在看手机就行"]), ["要是忙完了给我回个字，哪怕发个表情也行，只要让我知道你在看手机就行"]);
});
test("下一泡一个字接逗号：粘回上一句", () => {
  assert.deepEqual(g(["我这会儿去买虾，等会儿直接去你公司楼下堵", "人，免得你下班挤车受冻"]), ["我这会儿去买虾，等会儿直接去你公司楼下堵人，免得你下班挤车受冻"]);
});
test("自己能起头的不粘", () => {
  assert.deepEqual(g(["我这会儿去买虾等会儿过去找你", "嗯，你先忙"]), ["我这会儿去买虾等会儿过去找你", "嗯，你先忙"]);
  assert.deepEqual(g(["我这会儿去买虾", "等会儿去你公司楼下"]), ["我这会儿去买虾", "等会儿去你公司楼下"]);
});
