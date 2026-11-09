// 她 2026-11-02：舌钉每段都写，判据管不住 → 代码数：卡上的穿孔/首饰/纹身，最近两拍都写了，这一拍点名别写。
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8");
const F = new Function(eng.slice(eng.indexOf("const PROP_TERM_RE"), eng.indexOf("function spokenLinesOf")) + ";return {propTermsOf, propTailFor};")();
test("从人设里认出身上的东西", () => {
  assert.deepEqual(F.propTermsOf("他有舌钉，耳上几颗银钉，手腕两颗穿刺钉"), ["舌钉", "银钉", "穿刺钉"]);
  assert.deepEqual(F.propTermsOf("温柔的大学生"), []);
});
test("两拍都写了才点名，只写了一拍不管", () => {
  assert.match(F.propTailFor("有舌钉", ["舌钉碰着齿列", "舌钉又响"]), /舌钉前两拍都写到了/);
  assert.equal(F.propTailFor("有舌钉", ["舌钉碰着齿列", "他笑了"]), "");
  assert.equal(F.propTailFor("有舌钉", ["舌钉"]), "");
});
test("单人线下、群线下都接上", () => {
  assert.match(eng, /sayTail \+ propTail \+ /);
  assert.match(eng, /gSayTail \+ gPropTail \+ /);
});
