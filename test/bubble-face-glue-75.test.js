// 她 2026-10-14：问号后面的颜文字被拆成单独一泡——应该跟在问号后面
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
const pick = n => src.match(new RegExp("function " + n + "\\([\\s\\S]*?\\n}\\n"))[0];
eval(src.match(/const BUBBLE_ORPHAN_TAIL = [^\n]*\n/)[0].replace("const ", "var ") + pick("bubbleIsFace") + pick("bubbleGlueOrphans"));
assert.deepEqual(bubbleGlueOrphans(["まーた適当に済ませようとしてない？", "(￣ω￣)"]), ["まーた適当に済ませようとしてない？(￣ω￣)"]);
assert.deepEqual(bubbleGlueOrphans(["你吃了吗？", "🥺🥺"]), ["你吃了吗？🥺🥺"]);
assert.deepEqual(bubbleGlueOrphans(["好。", "(っ˘з(˘⌣˘ )"]), ["好。(っ˘з(˘⌣˘ )"]);
assert.deepEqual(bubbleGlueOrphans(["你吃了吗？", "我刚吃完。"]), ["你吃了吗？", "我刚吃完。"], "正常句子不粘");
assert.deepEqual(bubbleGlueOrphans(["真的？", "OK"]), ["真的？", "OK"]);
assert.deepEqual(bubbleGlueOrphans(["そうなの？", "うん"]), ["そうなの？", "うん"], "两个假名的词不算脸");
console.log("ok");
