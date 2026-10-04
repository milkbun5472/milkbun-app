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
  const at = o => String.fromCharCode(wav.getUint8(o), wav.getUint8(o + 1), wav.getUint8(o + 2), wav.getUint8(o + 3));
  // v74.803 把 fmt 那一块误注释掉了，编出来的 WAV 哪儿都放不出声——四个块标一个都不许少
  assert.deepStrictEqual([at(0), at(8), at(12), at(36)], ["RIFF", "WAV" + "E", "fmt ", "data"]);
  assert.strictEqual(wav.getUint32(24, true), A.RATE);
});
test("番茄钟接上了：上发条响、暂停停、收桌收，设置桌和专注浮层同一块面板", () => {
  assert.ok(/window\.Ambience\.anyOn\(\)\) window\.Ambience\.play\(\);/.test(pom));
  assert.ok(pom.indexOf("window.Ambience.unlock()") < pom.indexOf("pack = props.active"), "要在 await 模型之前、点击的当下解锁");
  assert.ok(/if \(window\.Ambience\) window\.Ambience\.stop\(\);   \/\/ 收桌/.test(pom));
  assert.strictEqual((pom.match(/h\(AmbiencePanel, \{/g) || []).length, 2);
  assert.ok(fs.readFileSync(__dirname + "/../index.html", "utf8").indexOf('src="js/ambience.js') < fs.readFileSync(__dirname + "/../index.html", "utf8").indexOf('src="js/pomodoro.js'));
});
