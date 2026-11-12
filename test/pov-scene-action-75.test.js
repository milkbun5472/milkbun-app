// TA 帮她拍：动作照描述、不另编（她 2026-10-15）；描述没写从哪儿拍才掷一格方位（她 2026-11-13 点头「没写才掷位置」）
const test = require("node:test");
const assert = require("node:assert/strict");
const eng = require("fs").readFileSync(require("path").join(__dirname, "..", "js/engine.js"), "utf8");
test("pov 分支：不调 photoShotLine，动作照描述，没写才掷方位、不连着一样", () => {
  const i = eng.indexOf("else if (opts.pov) {"), seg = eng.slice(i, eng.indexOf("\n  else {", i));
  assert.ok(i > 0);
  assert.ok(!/photoShotLine\(/.test(seg));
  assert.ok(/【这一张从哪儿拍】/.test(seg) && /不另编动作/.test(seg) && /_lastPov/.test(seg));
});
test("拍她的那几张写死两样看得见的：她手里没手机、离一臂多远（凑近那几格不加）", () => {
  assert.match(eng, /const POV_HANDS_LINE = "手机在拍照的那个人手里，她手里没有手机/);
  assert.match(eng, /POV_HANDS_LINE \+ \(\/凑\|近近\|半张脸\|很近\|肩上\|肩头\/\.test\(pool\[_pi\]\) \? "" : POV_FAR_LINE\)/);
  assert.match(eng, /不是自拍：人物清楚可辨，背景简单干净，画面平静、可公开展示。" \+ POV_HANDS_LINE \+ POV_FAR_LINE/);
});
test("拍她的开头跟别人拍 TA 同一种说法：不是自拍、第三人称、她手里没手机（不再写「视角·拿着手机·镜头是眼睛」）", () => {
  assert.match(eng, /parts\.push\("【这是" \+ pv\.name \+ "帮" \+ cName \+ "拍的照片，不是自拍】第三人称：/);
  assert.ok(!/的视角·" \+ pv\.name \+ "拿着手机拍/.test(eng));
  assert.ok(!/"[^"\n]*镜头就是拍照那个人的眼睛/.test(eng));
});
