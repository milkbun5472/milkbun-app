// 「第一：」挂在上一泡尾巴上的挪到下一泡开头（她 2026-11-01「这糟糕的切泡」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = { console, window: { addEventListener() {} }, navigator: { userAgent: "" }, document: { addEventListener() {} } };
vm.createContext(ctx);
try { vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8"), ctx); } catch (e) {}
const f = vm.runInContext("moveDanglingLeads", ctx);
const J = x => JSON.stringify(x);
test("列点的起头词挪到下一泡", () => {
  assert.equal(J(f(["那我的诉求可太明确了，第一：", "严正拒绝任何道具，第二：", "如果非要落实"])), J(["那我的诉求可太明确了", "第一：严正拒绝任何道具", "第二：如果非要落实"]));
  assert.equal(J(f(["说三件事 首先", "我饿了"])), J(["说三件事", "首先，我饿了"]));
});
test("不是在列点的不动", () => {
  assert.equal(J(f(["这是第一", "好的"])), J(["这是第一", "好的"]));
  assert.equal(J(f(["我们第一次见面", "嗯"])), J(["我们第一次见面", "嗯"]));
  assert.equal(J(f(["最后一句，第一："])), J(["最后一句，第一："]));   // 后面没泡了就不挪
});
test("单聊群聊都接上", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /words = moveDanglingLeads\(words\);/);
  assert.match(app, /gBubbles = moveDanglingLeads\(gBubbles\);/);
});

// 再者／其次／此外这类前面没标点也挪（她 2026-11-02 截图）；第一、最后照旧要标点
{
  const assert = require("node:assert/strict");
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
  const seg = src.slice(src.indexOf("const DANGLING_LEAD ="), src.indexOf("function splitLongBubble("));
  const mv = new Function(seg + "; return moveDanglingLeads;")();
  assert.deepEqual(mv(["轮不到你在这儿替裴照川充大方再者", "你这铁盒里跳出来的一串数目"]), ["轮不到你在这儿替裴照川充大方", "再者，你这铁盒里跳出来的一串数目"]);
  assert.deepEqual(mv(["这事就这么定了况且", "朕说了算"]), ["这事就这么定了", "况且，朕说了算"]);
  assert.deepEqual(mv(["你可真是到最后", "还嘴硬"]), ["你可真是到最后", "还嘴硬"], "最后：没标点不挪");
  assert.deepEqual(mv(["这是第一", "次"]), ["这是第一", "次"]);
}

// 群里 2026-11-08 截图：列五个理由，「站你旁边不丢人第二」「能找到你第三」——序号前面没标点，前面已经出现过上一个序号
test("正在一条条列：前面有「第一」，句尾光秃秃的「第二」也挪到下一泡；单说「考了第二」不动", () => {
  const fs = require("node:fs");
  const s = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  const f = new Function(s.slice(s.indexOf("const DANGLING_LEAD"), s.indexOf("function splitLongBubble")) + ";return moveDanglingLeads;")();
  const assert = require("node:assert/strict");
  assert.deepEqual(f(["第一，我好看，站你旁边不丢人第二", "我认路，能找到你第三", "我嘴好用"]),
    ["第一，我好看，站你旁边不丢人", "第二，我认路，能找到你", "第三，我嘴好用"]);
  assert.deepEqual(f(["这次考试我考了第二", "还行吧"]), ["这次考试我考了第二", "还行吧"]);
});
