// 群里 2026-10-20：回这一轮前面刚说的那条时引用错了别人的另一句——目录是这一轮之前编的，没有这句
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
const a = app.indexOf("        const gQuoteIn = (item, idx) => {"), b = app.indexOf("        for (let i = 0; i < safeArr.length; i++) {", a);
const safeArr = [{ name: "顾朝", text: "连椅子都搬过来了" }, { name: "顾暮", text: "我坐我自己的房间还要跟你报备？", quoteId: "R1" }, { name: "顾暮", text: "x", quoteId: "R5" }];
const members = [{ id: "a", name: "顾朝" }, { id: "b", name: "顾暮" }];
const f = new Function("safeArr", "members", "pickMember", "gQuoteCatalog", "window", app.slice(a, b) + "; return gQuoteIn;")(
  safeArr, members, (ms, n) => ms.find(m => m.name === n), [], {});
assert.deepEqual(f(safeArr[1], 1), { replyTo: "连椅子都搬过来了", replyToId: null, replyToSenderId: "a", replyToSenderName: "顾朝" });
assert.equal(f(safeArr[2], 2).replyTo, null, "指到还没说的那条：不引用，不乱挂");
assert.equal((app.match(/gQuoteIn\(item, i\)/g) || []).length, 2, "文字和语音两处都走这一个");
assert.match(app, /填 R 加它在本数组里的序号（R1 是第一条）/);
console.log("ok");
