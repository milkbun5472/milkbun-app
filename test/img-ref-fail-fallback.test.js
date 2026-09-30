const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
test("锁不住脸的去留只看 IMG_REF_FAIL_FALLBACK 一处；放开时退到无参考照并标 no-ref", () => {
  assert.match(eng, /^const IMG_REF_FAIL_FALLBACK = (true|false);/m);
  assert.ok(eng.includes("if (!IMG_REF_FAIL_FALLBACK || (opts && opts.singleShot)) throw"));
  assert.ok(eng.includes('softN ? "softened-no-ref" : "no-ref"'));
});
test("一张图只发一次：IMG_ONE_SHOT 开着时各级重试都不走", () => {
  assert.match(eng, /^const IMG_ONE_SHOT = (true|false);/m);
  assert.ok(eng.includes("if (!IMG_ONE_SHOT && !useRef && !slim && r.status >= 400"));
  assert.ok(eng.includes("if (IMG_ONE_SHOT && !(opts && opts.singleShot)) throw"));
  assert.ok(eng.includes("if (IMG_ONE_SHOT) throw e;"));
});
