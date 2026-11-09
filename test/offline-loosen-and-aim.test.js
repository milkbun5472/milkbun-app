// 她 2026-11-02「试试都做」：线下旧段落只留事和原话 + 每拍篇幅在区间里浮动。单人和群线下共用一份。
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8"), cmp = fs.readFileSync("js/components.js", "utf8");
const a = eng.indexOf("function offlineLoosenOn"), b = eng.indexOf("function offlineHistory(");
const min = eng.slice(eng.indexOf("function offlineMinimumSceneChars"), eng.indexOf("\n}\n", eng.indexOf("function offlineMinimumSceneChars")) + 2);
const F = new Function(min + eng.slice(a, b) + ";return {offlineLoosenOn, offlineLoosenBeat, offlineLoosenOld, offlineWordAimTail};")();
const LONG = "江风往领口里灌，他把外套拉链拉到下巴。“冷不冷？”他侧过头看你。你没答，他就把自己的围巾解下来绕到你脖子上。“别逞强。”他说完又转回去看江面，像什么都没发生过。";
test("旧段落：台词逐字留着，开头那句景和收尾那句不带，也不分段", () => {
  const out = F.offlineLoosenBeat(LONG);
  assert.match(out, /“冷不冷？”/); assert.match(out, /“别逞强。”/);
  assert.match(out, /围巾解下来/);
  assert.doesNotMatch(out, /江风往领口/); assert.doesNotMatch(out, /看江面/);
  assert.doesNotMatch(out, /\n/);
});
test("最近两拍原样，更早的才拆", () => {
  const msgs = [{ role: "user", content: "a" }, { role: "char", content: LONG }, { role: "user", content: "b" }, { role: "char", content: LONG }, { role: "user", content: "c" }, { role: "char", content: LONG }];
  const out = F.offlineLoosenOld(msgs);
  assert.match(out[1].content, /^〔前情·只记事和原话〕/);
  assert.equal(out[3].content, LONG); assert.equal(out[5].content, LONG);
  assert.equal(msgs[1].content, LONG, "不改原存档");
});
test("只在长文时开，开关能关", () => {
  assert.equal(F.offlineLoosenOn({ lengthMode: "natural" }), false);
  assert.equal(F.offlineLoosenOn({ lengthMode: "immersive" }), true);
  assert.equal(F.offlineLoosenOn({ minWords: 800 }), true);
  assert.equal(F.offlineLoosenOn({ minWords: 800, looseOld: false }), false);
});
test("篇幅浮动落在下限到 1.35 倍之间，没设下限不发", () => {
  assert.equal(F.offlineWordAimTail(0), "");
  assert.match(F.offlineWordAimTail(800, 0), /写到 800 字左右/);
  assert.match(F.offlineWordAimTail(800, 1), /写到 1080 字左右/);
});
test("单人和群线下都接上，设置存 looseOld", () => {
  assert.equal((eng.match(/offlineLoosenOn\(session\) \? offlineLoosenOld\((offlineDropStale\()?session\.msgs\)?\)/g) || []).length, 2);
  assert.match(eng, /sayTail \+ [^\n]*offlineWordAimTail\(minimumSceneChars\)/);
  assert.equal((eng.match(/gSayTail \+ [^\n]*?offlineWordAimTail\(session\.minWords\)/g) || []).length, 2);
  assert.equal((app.match(/looseOld: osFor\(/g) || []).length, 2);
  assert.equal((cmp.match(/lengthMode: sLengthMode, looseOld: sLoose/g) || []).length, 2);
});
