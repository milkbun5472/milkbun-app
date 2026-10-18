const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const X = require("../js/ext-mem.js");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"),
  cr = fs.readFileSync(__dirname + "/../js/chat-rooms.js", "utf8"), sc = (fs.readFileSync(__dirname + "/../js/screens.js", "utf8") + "\n" + fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8")), idx = fs.readFileSync(__dirname + "/../index.html", "utf8");
const T = (raw, props, req) => ({ name: "m1__" + raw, raw, input_schema: { properties: props, required: req || [] } });
test("认出搜和记那两件、放文字的格子", () => {
  const tools = [T("search_memory", { query: { type: "string" }, limit: { type: "number" } }), T("add_memory", { content: { type: "string" } }), T("delete_memory", { id: { type: "string" } }), { name: "m2__search", raw: "search", input_schema: { properties: { q: { type: "string" } } } }];
  const g = X.guess(tools, "m1");
  assert.equal(g.search, "m1__search_memory"); assert.equal(g.add, "m1__add_memory");
  assert.equal(X.textArg(tools[0], "search"), "query"); assert.equal(X.textArg(tools[1], "add"), "content");
  assert.deepEqual(X.guess([T("weather", { city: { type: "string" } })], "m1"), { search: "", add: "" });
});
test("接进每轮：回复前搜，ctx 带上，提示词摆出来，写回挂在 addMemEntry", () => {
  assert.match(app, /await window\.ExtMem\.prefetch\(char, String\(_q\)\)/);
  assert.match(app, /await window\.ExtMem\.prefetch\(char, String\(\(_oq && _oq\.content\) \|\| ""\)\)/);
  assert.match(app, /extMem: ctxOpts && ctxOpts\.noMemory \? "" : \(window\.ExtMem \? window\.ExtMem\.textFor\(char\.id\) : ""\)/);
  assert.match(app, /if \(window\.ExtMem\) window\.ExtMem\.push\(entry,/);
  assert.equal((eng.match(/【外置记忆库·这一轮搜到的/g) || []).length, 2);
  assert.match(cr, /"memLib", "extMem",/);   // 关了正式记忆的房间不带
  assert.match(sc, /function ExtMemBox\(/); assert.match(idx, /js\/ext-mem\.js\?v=/);
});
