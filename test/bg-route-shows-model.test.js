// 她 2026-11-01 群友：后台换了模型，提示里一直是原来那个——线路名字是旧的，实际模型已经换了
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
const line = src.slice(src.indexOf("  const _nm = String((p && p.name)"), src.indexOf("  const bgSay = "));
const f = new Function("p", line + "; return bgRoute;");
assert.equal(f({ name: "gemini-2.5-pro", model: "deepseek-v3" }), "gemini-2.5-pro · deepseek-v3");
assert.equal(f({ name: "我的主线 deepseek-v3", model: "deepseek-v3" }), "我的主线 deepseek-v3");
assert.equal(f({ name: "", model: "deepseek-v3" }), "deepseek-v3");
assert.equal(f(null), "");
assert.match(src, /detail: \{ show: bgShow, route: bgRoute/);
console.log("ok");
// 没生成出来的那声提示要说清是什么活：走线上的活不许再被套成「后台生成」
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
assert.match(src, /new CustomEvent\("gen-failed", \{ detail: \{ tag: [^\n]*route: bgRoute,\n[^\n]*\n\s*label: \(opts && opts\.logLabel\) \|\| LOG_USE/);
assert.match(app, /key = String\(d\.label \|\| d\.tag \|\| _now \|\| "生成"\)/);
assert.doesNotMatch(app, /_now \|\| "后台生成"/);
