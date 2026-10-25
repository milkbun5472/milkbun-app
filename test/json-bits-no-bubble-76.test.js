// 群里 2026-10-23 截图：JSON 提前收口，photo 那几格落在大括号外面，一行一个气泡发出来
const assert = require("node:assert/strict");
const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
const grab = name => new RegExp(app.match(new RegExp("const " + name + " = (\\/.*\\/);"))[1].slice(1, -1));
const jsonBitRe = grab("jsonBitRe"), jsonKeyRe = grab("jsonKeyRe");
[',"photo":{"face":true', '"kind":"self"', '"scene":"在高中教室窗边后排', '{"emote":"看你编"'].forEach(w => assert.ok(jsonBitRe.test(w), "该拦：" + w));
["男生黑发碎乱微遮眼睛", "你说的「OK」是啥意思", "早上好：今天吃啥", "\"你认真的？\"他问"].forEach(w => assert.ok(!jsonBitRe.test(w), "不该拦：" + w));
assert.ok(jsonKeyRe.test(',"photo":{"face":true,\n"kind":"self"'));
// 外面那截有字段碎块：先接回去重读，接不回就不当话
assert.match(app, /const _jsonBits = jsonKeyRe\.test\(_outside\);/);
assert.match(app, /JSON\.parse\(repairJSON\(_rs\.slice\(0, _b\) \+ _rs\.slice\(_b \+ 1\)\)\)/);
assert.match(app, /if \(_outside && !_jsonBits && !protocolFieldRe\.test\(_outside\)\) \{/);
assert.match(app, /words = words\.filter\(w => !protocolFieldRe\.test\(String\(w\)\) && !jsonBitRe\.test\(String\(w\)\) && !\(typeof w === "string" && bareKeyRe\.test\(w\)\)\);/);
// 一个气泡只剩一个字段名（她 2026-10-25「emote」那一泡）
const bareKeyRe = (m => new RegExp(m[1], m[2]))(app.match(/const bareKeyRe = \/(.*)\/([a-z]*);/));
["emote", " emote ", "\"emote\"", "Emote:", "voice"].forEach(w => assert.ok(bareKeyRe.test(w), "该拦：" + w));
["emote 一下", "我想你了", "OK", "photo 发我看看"].forEach(w => assert.ok(!bareKeyRe.test(w), "不该拦：" + w));
console.log("ok");
