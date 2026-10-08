// 亲密戏不要两拍就写完（她 2026-10-08）：场景进行中，单人和群线下的尾部都补一句节奏
const assert = require("assert");
const eng = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
const i = eng.indexOf("function offlineIntimatePaceLine("), j = eng.indexOf("\nfunction ", i + 10);
const fn = new Function(eng.slice(i, j) + "\nreturn offlineIntimatePaceLine;")();
for (const g of [false, true]) {
  const t = fn(g);
  assert.match(t, /只把它往前推一小步/);
  assert.match(t, /由她的输入带着走/);
  assert.match(t, /不在这一拍里一路写到结束、也不跳到事后/);
}
assert.match(eng, /const intimatePaceTail = !isDigital && !!registerTransition\.active \? offlineIntimatePaceLine\(false\) : "";/);
assert.match(eng, /characterSupplyTail \+ intimatePaceTail \+ flashbackTail/);
assert.match(eng, /offlineCharacterSupplyLine\(true\) \+ offlineIntimatePaceLine\(true\)/);
console.log("offline-intimate-pace ok");
