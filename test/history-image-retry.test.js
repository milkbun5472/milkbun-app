// 她 2026-11-03 截图：「contents[158].parts[1].inlineData is not supported in text history」——线路不收历史里的图。
//   callAI 照报错退一步重发：先只留最后一条的图，再不行一张不带。
const assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8");
const seg = eng.slice(eng.indexOf("async function callAI(p, system, messages, opts)"), eng.indexOf("const TRANSIENT_ERR", eng.indexOf("async function callAI(")) > 0 ? eng.indexOf("\n}\n", eng.indexOf("async function callAI(")) : 0);
assert.match(seg, /not supported in \(\?:text \)\?history/);
assert.match(seg, /k === lastIdx \|\| !m \|\| !m\.imageDataUrls \? m :/, "先只留最后一条的图");
assert.match(seg, /messages\.map\(m => !m \|\| !m\.imageDataUrls \? m :/, "再不行一张不带");
assert.match("contents[158].parts[1].inlineData is not supported in text history. (request id: x)", /not supported in (?:text )?history/);
// 她 2026-11-25 截图：自己架的模型没开看图（vLLM）——也照这条退一步，去掉图重发
{ const re = new RegExp(seg.match(/test\(msg\)/) ? seg.match(/if \(!streamed && \/(.+?)\/i\.test\(msg\)/)[1] : "x", "i");
  assert.ok(re.test("Received multimodal data but multimodal processing is not enabled. Use --*** flag to enable multimodal processing."), "vLLM 那句也认");
  assert.match(seg, /not supported\|unsupported\|not enabled/, "去掉图重发还报这句就接着退"); }
console.log("ok history-image-retry");
