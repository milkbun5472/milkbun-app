// 她 2026-11-01 截图：秋秋连说两遍「文件卡在下面」，一张都没有。文件卡也要：认别名、从坏 JSON 里抠、再问一次、最后照实说
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "assistant.js"), "utf8");
const seg = src.slice(src.indexOf("  const PATCH_KEYS = "), src.indexOf("  // ---- 代码/框架那道门"));
const { salvageField } = new Function(seg + "; return { salvageField };")();
// 坏 JSON 里的 file 抠得回来
const broken = '{"reply":"整份在下面的文件卡里","file":{"name":"世界书.json","text":"{"entries":[1]}\n第二行"}}';
assert.throws(() => JSON.parse(broken));
const chunk = broken.slice(broken.search(/"file"\s*:\s*\{/) + 6);
assert.equal(salvageField(chunk, "name"), "世界书.json");
assert.match(salvageField(chunk, "text"), /"entries":\[1\]\}\n第二行/);
// 机制都在
assert.match(src, /const fileOf = o =>/);
assert.match(src, /o\.files\) \? o\.files\[0\]/);
assert.match(src, /只把这份文件完整地发一遍/);
assert.match(src, /saidFile\(d\.reply \|\| raw\)/);
assert.match(src, /if \(!outFile && saidFile\(reply\)\) reply \+=/);
// 截图里那两句都算「说了有文件」
const saidFile = new Function("return " + src.match(/const saidFile = (r => [^\n]+);/)[1])();
assert.ok(saidFile("改好的整份世界书已经打包整理在下面的文件卡里啦"));
assert.ok(saidFile("点下面的文件卡就能直接复制或者存成文件导入世界书"));
assert.ok(!saidFile("改好了，点应用就行"));
console.log("ok");
