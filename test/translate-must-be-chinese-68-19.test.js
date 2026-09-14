// 她 2026-09-14：「为啥查手机日语会被翻译成英文而不是中文啊啊啊」。
//
// 病根是 MyMemory：它的日→中其实是【绕道英语】，绕到一半就把英文交回来了，
// 而我们这头照单全收、还存进了缓存。
// 与其给它写一条特例，不如立一条谁都得过的判据：**没有汉字的译文不算译文**。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js/engine.js"), "utf8");

// 把那个判据抠出来真跑
const looksChinese = (() => {
  const i = eng.indexOf("function _looksChinese(zh) {");
  const j = eng.indexOf("async function translateToZh(");
  assert.ok(i > 0 && j > i, "抠不出那道闸");
  return new Function(eng.slice(i, j) + "\nreturn _looksChinese;")();
})();

test("英文译文一律不算数", () => {
  assert.equal(looksChinese("Tonight is overtime again."), false);
  assert.equal(looksChinese(""), false);
  assert.equal(looksChinese("   "), false);
  assert.equal(looksChinese("???"), false);
});

test("正常中文当然算，夹几个英文单词也算", () => {
  assert.equal(looksChinese("今晚又要加班。"), true);
  assert.equal(looksChinese("我在用 VSCode 写代码"), true);
  assert.equal(looksChinese("他说 ok，然后就走了"), true);
});

test("一半中文一半英文的半成品不算——那正是绕道绕废的样子", () => {
  assert.equal(looksChinese("今天 I went to the office and finished the report early"), false);
});

test("判据写在跑链条那一处，每一级都要过", () => {
  const seg = eng.slice(eng.indexOf("async function translateToZh("), eng.indexOf("// 日语汉字 → 假名读音"));
  assert.match(seg, /if \(!_looksChinese\(zh\)\) throw new Error\("翻出来的不是中文：/,
    "只挡某一家＝换一家就再出一次同样的事故");
  // 挡下来之后要继续往下退，而不是整个失败
  assert.match(seg, /catch \(e\) \{ errs\.push\(names\[i\] \+ "：" \+/);
});

test("日/韩/俄这类源直接跳过 MyMemory，省一次白跑", () => {
  const seg = eng.slice(eng.indexOf("async function translateToZh("), eng.indexOf("// 日语汉字 → 假名读音"));
  assert.match(seg, /const myMemoryOk = src === "en" \|\| src === "auto";/);
  assert.match(seg, /myMemoryOk \? _transMyMemory\(text, src\) : Promise\.reject/);
  // Google 和模型那两级没被动
  assert.match(seg, /_transGoogle\(text, src\)/);
  assert.match(seg, /_transModel\(text\)/);
});
