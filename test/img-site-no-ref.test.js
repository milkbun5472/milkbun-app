const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("这个站不锁脸：开了就只发文字、一次请求、图上标没锁脸；没开的站失败时告诉她可以开", () => {
  const top = eng.slice(eng.indexOf("async function generateSelfieImage("), eng.indexOf("async function generateSelfieImage(") + 2200);
  assert.ok(/if \(hasRef && a0\.noRef\) \{\s*const out = await generateSelfieImage\(prompt, null, inner\);/.test(top), "开了就不带参考照、只走一次");
  assert.ok(/out\.degraded = "site-no-ref"/.test(top));
  assert.ok(/打开「这个站不锁脸」/.test(top), "没开的站报错里带出路");
  assert.ok(/noRef: false \};/.test(eng), "默认关");
  assert.ok(/h\(Toggle, \{ on: !!c\.noRef, onChange: \(\) => set\(\{ noRef: !c\.noRef \}\) \}\)/.test(scr));
  assert.ok(/m\.noLock \? h\("span"/.test(comp));
  assert.strictEqual((app.match(/noLock: !!\(out && out\.degraded === "site-no-ref"\)/g) || []).length, 3);
});
