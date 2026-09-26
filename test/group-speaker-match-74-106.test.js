// 群里只有一个人说话（她 2026-09-26）：模型把名字写得不一字不差时，那个人整轮的话都被丢了
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const grab = name => { const i = src.indexOf("function " + name + "("); let d = 0, j = src.indexOf("{", i); for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) break; } return src.slice(i, j + 1); };
const { pickMember } = new Function(grab("memberLabel") + "\n" + grab("pickMember") + "\nreturn {pickMember};")();
const nan = { id: "a", name: "南浮" }, wen = { id: "b", name: "闻雪生", remark: "雪生姐" };
const two = [nan, wen];
assert.equal(pickMember(two, "闻雪生"), wen, "exact");
assert.equal(pickMember(two, "雪生"), wen, "nickname inside the name");
assert.equal(pickMember(two, " 闻雪生 "), wen, "spaces");
assert.equal(pickMember(two, "【闻雪生】"), wen, "brackets");
assert.equal(pickMember(two, "雪生姐"), wen, "remark");
assert.equal(pickMember([nan, { id: "c", name: "闻雪生 " }], "闻雪生").id, "c", "stored name with trailing space");
assert.equal(pickMember(two, "路人"), null, "stranger stays out");
assert.equal(pickMember([{ id: "x", name: "沈白" }, { id: "y", name: "沈白衣" }], "白"), null, "ambiguous: both contain it");
const same = [{ id: "d1", name: "沈屿白", remark: "学长" }, { id: "d2", name: "沈屿白", remark: "邻居" }];
assert.equal(pickMember(same, "沈屿白（邻居）").id, "d2", "duplicate names still by label");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
assert.match(app, /arr = arr\.map\(it => \{[^\n]*pickMember\(members, it\.name\)/, "names normalized before the identity guard");
console.log("group speaker match 74.106 ok");
// 两个人的旁观群＝他俩的私聊：不许再告诉模型「有人一句不说是正常的」；她在别处的线下也不让其中一个「腾不出手」
assert.match(app, /const commonTurn = asPrivate\s*\? common\.replace\(\/【很重要】\[\\s\\S\]\*\?\(\?=\\n【对话连贯\)\/, "【很重要】这是两个人之间的对话：两个人都在/);
assert.match(app, /const gBusyOff = groupSpectating\(group\) \? \[\] :/);
console.log("two-person spectate ok");
