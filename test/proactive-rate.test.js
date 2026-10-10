// 她 2026-10-03：「现在这套算法能不能做中频或者低频，然后调整成更快更慢，给它整套乘以几倍速」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const P = require("../js/auto-refresh-policy.js");
const app = R("js/app.js"), scr = R("js/screens.js");

test("主动私聊有低中高三档，缺省中频＝原来那套；存进去读回来不丢", () => {
  const p0 = P.normalize({});
  assert.equal(p0.features.proactive.rate, "mid");
  assert.equal(P.rateX(p0, "proactive"), 1);
  const p1 = P.setRate(p0, "proactive", "low");
  assert.equal(P.rateX(P.normalize(JSON.parse(JSON.stringify(p1))), "proactive"), 0.75);
  assert.equal(P.rateX(P.setRate(p0, "proactive", "high"), "proactive"), 2);
  assert.equal(P.rateX(p0, "diary"), 1, "没有档位的一律 1");
});

test("倍速乘在想念的钟上、冷却跟着缩放；阈值和算法不动", () => {
  assert.match(app, /const mins = \(now - baseTs\) \/ 60000 \* _px;/);
  assert.match(app, /crossed = baseTs \+ done \/ _px \* 60000/, "补记的时间戳要换回真实时间");
  assert.match(app, /const _cool = 25 \* 60000 \/ proactiveX\(cid\);/);   // 按这个人自己的档（v75.303 起每人能单独挑）
  assert.match(scr, /f\.rates && cfg\.global && props\.onSetRate/);
});
