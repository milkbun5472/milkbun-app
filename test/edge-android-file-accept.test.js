// 安卓选文件只给相册／选不了文件（群里 2026-10-18 Edge、10-19 再报、10-29 夸克、10-29 又一台安卓）：
//   安卓那一支一律不写 accept，系统文件选择器才开得出来。原来是「只写大类 application/*,text/*」，
//   那还是一份清单、还是得一个浏览器一个浏览器加，2026-10-29 换掉了。
const test = require("node:test"), assert = require("node:assert");
const core = require("fs").readFileSync(require("path").join(__dirname, "../js/core.js"), "utf8");
test("安卓那一支不写 accept，别处还是全部放行", () => {
  const m = core.match(/const ANY_FILE = [^?]+\?\s*([^\n]+)\n\s*:\s*"([^"]*)";/);
  assert.ok(m, "找不到 ANY_FILE");
  assert.strictEqual(m[1].trim(), "undefined", "安卓那一支必须是 undefined，属性才会整个省掉");
  assert.strictEqual(m[2], "*/*", "安卓以外还得是全部放行");
  assert.match(core, /ANDROID_NO_ACCEPT/, "安卓那条没集中成一处");
});
