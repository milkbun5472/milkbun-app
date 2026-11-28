const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const ctx = { console, window: { addEventListener() {} }, navigator: { userAgent: "" }, document: { addEventListener() {} } };
vm.createContext(ctx); try { vm.runInContext(R("engine.js"), ctx); } catch (e) {}
const L = vm.runInContext("callerLabelOf", ctx);
// 她 2026-11-28「其他 · $r」：懒加载那几份栈里是「js/xxx.js」，前面没有斜杠
assert.equal(L("Error\n    at callAI (https://a/js/engine.js?v=1:9:9)\n    at $r (js/fanfic-core.js:2799:20)"), "同人");
assert.equal(L("Error\ncallAI@https://a/js/engine.js:9:9\ngenX@js/theater.js:12:3"), "小剧场");
assert.equal(L("Error\n    at callAI (https://a/js/engine.js?v=1:9:9)\n    at x (https://a/js/study.js?v=2:4:4)"), "一起学");
// 每一份会调模型的文件都要认得出是谁（app.js / engine.js 走函数名那张表）
const map = JSON.parse(/const CALL_FILE_LABEL = Object\.freeze\((\{.*?\})\);/.exec(R("engine.js"))[1]);
const miss = fs.readdirSync(path.join(__dirname, "..", "js")).filter(f => /\.js$/.test(f) && !/^(app|engine|screens-ui)\.js$/.test(f))
  .filter(f => /\b(callAI|runProbe)\(/.test(R(f)) && !/function (callAI|runProbe)\b/.test(R(f)) && !map[f.slice(0, -3)]);
assert.deepEqual(miss, [], "这几份调模型但调用记录认不出是谁：" + miss.join(" "));
console.log("ok call-label-lazy");
