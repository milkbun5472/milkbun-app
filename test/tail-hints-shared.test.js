// 她 2026-11-02：「为啥线下还是这么爱这个句式」→「线下群聊都接上」。威胁/叮嘱/看穿三种收尾提醒，单聊、群聊、单人线下、群线下共用一份 tailHintsFor。
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8");
test("spokenLinesOf 只取引号里的台词", () => {
  const a = eng.indexOf("function spokenLinesOf"), b = eng.indexOf("\n}\n", a) + 2;
  const f = new Function(eng.slice(a, b) + ";return spokenLinesOf;")();
  assert.deepEqual(f("他放下杯子。“你先吃。”她没动。「记得早点睡」"), ["你先吃。", "记得早点睡"]);
  assert.deepEqual(f("他只是看着她，没说话。"), []);
});
test("四条线都挂上同一份 tailHintsFor，没有第二份", () => {
  assert.equal((eng.match(/function tailHintsFor\(/g) || []).length, 1);
  assert.match(eng, /const sayTail = !isDigital && _said\.length \? tailHintsFor\(/);
  assert.match(eng, /const gSayTail = _gSaid\.length \? tailHintsFor\(/);
  assert.match(eng, /gCharacterTail \+ gSayTail \+ gTail/);
  assert.match(app, /const gSayHint = [\s\S]{0,600}tailHintsFor\(out\[out\.length - 1\]/);
  assert.match(app, /gDramaTail \+ gSayHint \+ /);
  assert.match(app, /tailHintsFor\(_prevTail, _prevTurnText\)/);
});
