// 她 2026-11-19 截图：「…是不是我哪儿弄疼你了怎么」「你突然想试试啊」——「怎么」挂在上一泡尾巴上
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const s = fs.readFileSync(path.resolve(__dirname, "..", "js/engine.js"), "utf8");
const f = new Function(s.slice(s.indexOf("const DANGLING_LEAD"), s.indexOf("function splitLongBubble")) + ";return moveDanglingLeads;")();
test("句尾的怎么／所以挪到下一泡开头；说的是自己那句的不挪", () => {
  assert.deepEqual(f(["第一反应绝对是先问你是不是我哪儿弄疼你了怎么", "你突然想试试啊"]), ["第一反应绝对是先问你是不是我哪儿弄疼你了", "怎么，你突然想试试啊"]);
  assert.deepEqual(f(["你这是要干嘛呢所以", "我该怎么办"]), ["你这是要干嘛呢", "所以，我该怎么办"]);
  assert.deepEqual(f(["我也不知道怎么", "吃饭吧"]), ["我也不知道怎么", "吃饭吧"]);
});
