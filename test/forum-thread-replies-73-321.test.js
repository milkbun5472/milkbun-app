// 楼中楼要有不同的人接，不再「大多数楼 replies 留空」（她 2026-09-23：「只是一人一层楼」）。
const assert = require("assert");
const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
const code = app.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
assert(!/大多数楼 replies 留空/.test(code));
assert(/【大约一半的楼】底下要有人接——2~5 条，来自【不同的人】/.test(code));
assert(/不因为楼中楼变多就少开楼/.test(code), "楼层数不变");
assert.strictEqual((code.match(/FORUM_THREAD_LINE/g) || []).length, 3, "首刷续刷共用一句");
console.log("forum-thread-replies ok");
// 论坛额度全部开满（她 2026-09-23：「上限给65535吧」）
const ft = app.slice(app.indexOf("const FTOK = {"), app.indexOf("};", app.indexOf("const FTOK = {")));
assert.deepStrictEqual((ft.match(/:\s*(\d+)/g) || []).map(x => x.replace(/\D/g, "")).filter((v, i, a) => a.indexOf(v) === i), ["65535"]);
console.log("forum FTOK 65535 ok");
