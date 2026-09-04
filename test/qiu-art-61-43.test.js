// v61.43 她 2026-09-03 给了一张图：「改一下秋秋的头像和图标吧，左边是头像右边是图标」。
// 这一条钉的是【那两个文件真的在、而且是随包装的小文件】——
// 图丢了的话界面上就是两个空框，测试得先红。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

test("两张图都在，而且都小得能跟着 PWA 一起装", () => {
  for (const f of ["img/qiu-avatar.png", "img/qiu-icon.png"]) {
    assert.ok(fs.existsSync(f), "少了 " + f);
    const kb = fs.statSync(f).size / 1024;
    // v61.55 起只许 png：webp 更小（15KB vs 80KB），但 Chromium 的 canvas 导出的是
    // VP8X 扩展格式，iOS WebKit 直接解不了（'WEBP'-_reader->initImage failed err=-50），
    // 手机上就是两个空框。天花板放到 120KB —— 省那 60KB 不值一个解不出来的图。
    assert.ok(kb < 120, f + " 有 " + kb.toFixed(0) + "KB，太大了");
  }
});

test("图得进 Service Worker 的静态缓存，否则离线就是两个空框", () => {
  const sw = fs.readFileSync("sw.js", "utf8");
  assert.match(sw, /\(js\|css\|png\|webp\|json\|ico\)\$/);
});

test("引用的路径和文件名对得上（拼错了页面上不会报错，只会不显示）", () => {
  const a = fs.readFileSync("js/assistant.js", "utf8");
  const c = fs.readFileSync("js/components.js", "utf8");
  const used = new Set();
  [a, c].forEach(s => (s.match(/img\/qiu-[a-z]+\.png/g) || []).forEach(x => used.add(x)));
  assert.deepEqual([...used].sort(), ["img/qiu-avatar.png", "img/qiu-icon.png"]);
  used.forEach(f => assert.ok(fs.existsSync(f), "代码里引了不存在的 " + f));
});

// v61.44 她 2026-09-03：「他在文件夹里文件夹小图显示不出来换上的，还是原来的丑鸟」。
// 同一个形状今天犯了两次：先是文件夹预览不认【她自己换的图标】，修完之后
// 我又把【自带图】只写进了 GlassIcon——于是文件夹里还是线稿。两次都是「一层写在两处」。
test("「这个 app 显示哪张图」只有一个答案，三处都问它", () => {
  const c = fs.readFileSync("js/components.js", "utf8");
  assert.match(c, /function appIconSrc\(appKey\) \{/);
  // 优先级：她自己换的 → 自带图 → 空（调用方去画线稿）
  const i = c.indexOf("function appIconSrc(");
  const fn = c.slice(i, c.indexOf("\n}", i));
  assert.match(fn, /window\.ThemeStudio \? window\.ThemeStudio\.iconRef\(appKey\)/);
  assert.match(fn, /return APP_BUILTIN_ICON\[appKey\] \|\| "";/);
  // 三处调用：主屏磁贴 / 文件夹预览 / 拖动虚影
  assert.equal((c.match(/appIconSrc\(/g) || []).length, 4, "调用处数变了，检查是不是又有一处自己抄了优先级");
  // 别处不许再各自去问 ThemeStudio
  assert.equal((c.match(/ThemeStudio\.iconRef\(/g) || []).length, 1, "又有人绕开 appIconSrc 自己查了");
});

test("文件夹小图和拖动虚影都真的用那张图", () => {
  const c = fs.readFileSync("js/components.js", "utf8");
  // GlassPane 排在 FolderIcon 前面，别拿它当右边界（切出来是空的）
  const a = c.indexOf("function FolderIcon(");
  const fi = c.slice(a, c.indexOf("\nfunction ", a + 10));
  assert.match(fi, /const src = appIconSrc\(a\.key\);/, "文件夹预览没接上");
  assert.match(c, /const src = appIconSrc\(dragKey\);/, "拖动虚影没接上");
});
