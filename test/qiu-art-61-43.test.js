// v61.43 她 2026-09-03 给了一张图：「改一下秋秋的头像和图标吧，左边是头像右边是图标」。
// 这一条钉的是【那两个文件真的在、而且是随包装的小文件】——
// 图丢了的话界面上就是两个空框，测试得先红。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

test("两张图都在，而且都小得能跟着 PWA 一起装", () => {
  for (const f of ["img/qiu-avatar.webp", "img/qiu-icon.webp"]) {
    assert.ok(fs.existsSync(f), "少了 " + f);
    const kb = fs.statSync(f).size / 1024;
    // 同一张画 png 要 80KB，webp 只要 15KB。留 60KB 的天花板：
    // 谁哪天换回 png 或者塞一张原图进来，这里先红。
    assert.ok(kb < 60, f + " 有 " + kb.toFixed(0) + "KB，太大了（webp 应该在 20KB 上下）");
  }
});

test("webp 得进 Service Worker 的静态缓存，否则离线就是两个空框", () => {
  const sw = fs.readFileSync("sw.js", "utf8");
  assert.match(sw, /\(js\|css\|png\|webp\|json\|ico\)\$/);
});

test("引用的路径和文件名对得上（拼错了页面上不会报错，只会不显示）", () => {
  const a = fs.readFileSync("js/assistant.js", "utf8");
  const c = fs.readFileSync("js/components.js", "utf8");
  const used = new Set();
  [a, c].forEach(s => (s.match(/img\/qiu-[a-z]+\.webp/g) || []).forEach(x => used.add(x)));
  assert.deepEqual([...used].sort(), ["img/qiu-avatar.webp", "img/qiu-icon.webp"]);
  used.forEach(f => assert.ok(fs.existsSync(f), "代码里引了不存在的 " + f));
});
