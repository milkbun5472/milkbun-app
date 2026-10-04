const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const A = require("../js/ambience.js");
const pom = fs.readFileSync(__dirname + "/../js/pomodoro.js", "utf8");
test("背景音：每层合成得出来、循环接得上、几层能叠", () => {
  A.LAYERS.forEach(([k]) => { const a = A._layer(k); assert.strictEqual(a.length, A.RATE * A.SEC, k); assert.ok(a.every(Number.isFinite), k + " 有坏样本"); });
  assert.strictEqual(A._mix({}), null, "全拖到零就什么都不放");
  const m = A._mix({ rain: .6, fire: .4, clock: .3, brown: 1, waves: 1 });
  assert.ok(m.every(x => Math.abs(x) <= 1), "叠多了也不许爆音");
  const wav = new DataView(A._wavOf(m));
  assert.strictEqual(String.fromCharCode(wav.getUint8(0), wav.getUint8(1), wav.getUint8(2), wav.getUint8(3)), "RIFF");
});
test("番茄钟接上了：上发条响、暂停停、收桌收，设置桌和专注浮层同一块面板", () => {
  assert.ok(/window\.Ambience\.anyOn\(\)\) window\.Ambience\.play\(\);/.test(pom));
  assert.ok(/if \(window\.Ambience\) window\.Ambience\.stop\(\);   \/\/ 收桌/.test(pom));
  assert.strictEqual((pom.match(/h\(AmbiencePanel, \{/g) || []).length, 2);
  assert.ok(fs.readFileSync(__dirname + "/../index.html", "utf8").indexOf('src="js/ambience.js') < fs.readFileSync(__dirname + "/../index.html", "utf8").indexOf('src="js/pomodoro.js'));
});
