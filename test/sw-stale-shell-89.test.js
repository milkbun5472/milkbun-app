// 主壳「旧版先进、新版后台下齐再换」（2026-11-21）：钉住三件事
//   1) 新 index 点名的块没齐、手上有旧 index → 先回旧 index；
//   2) 后台补块时不清同路径旧版本，换 index 之后才清；
//   3) __index__ 只在块全齐时才写成新版。
const fs = require("fs"), path = require("path"), assert = require("assert");
const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
const body = (name) => { const i = sw.indexOf("async function " + name); assert.ok(i > 0, name); return sw.slice(i, sw.indexOf("\n}\n", i)); };
const serve = body("serveShell"), install = body("installShell");
assert.match(sw, /event\.respondWith\(serveShell\(event, req\)\)/);
assert.match(serve, /if \(!miss\.length \|\| !cached\)/);
assert.match(serve, /return cached;\s*$/);
const put = install.indexOf('cache.put("__index__"'), del = install.indexOf("cache.delete(k)");
assert.ok(put > 0 && del > put, "换 index 之后才清旧版本");
assert.ok(install.indexOf("missingAssets") < put, "先补齐块再换 index");
console.log("sw-stale-shell ok");
// 上一代留着：更新前就开着的旧标签页还要按旧 ?v= 拿延后加载的代码（2026-11-21 旧标签页白屏）
assert.match(install, /shellAssets\(prevHtml\)/, "换 index 时没留上一代");
assert.match(sw, /!keep\.has\(ku\.href\)\) cache\.delete\(k\)/, "页面现拿新块时把缓存 index 还点名的旧版本删了");
console.log("sw-keep-prev ok");
