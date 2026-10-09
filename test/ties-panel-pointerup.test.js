// 她 2026-10-09：关系板上「编辑」要点好几次才有反应——松手那下冒到板子上被当成点空白，面板先卸了
const assert = require("assert"), fs = require("fs");
const S = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
assert.match(S, /"data-wk": "tiespanel", onPointerDown: ev => ev\.stopPropagation\(\), onPointerUp: ev => ev\.stopPropagation\(\), onPointerCancel: ev => ev\.stopPropagation\(\)/);
// 板子那头松手确实会收掉选中——这正是面板必须拦住 pointerup 的原因
const i = S.indexOf("function tieBoardPointer("), j = S.indexOf("function TiesBoard(", i);
assert.ok(i > 0 && j > i);
assert.match(S.slice(i, j), /if \(!p\.moved\) setSel\(null\);/);
assert.match(S, /minHeight: 40, padding: "0 16px", borderRadius: 999, border: "1px solid " \+ t\.tint[^}]*\} \}, "编辑"\)/);
console.log("ties panel ok");
