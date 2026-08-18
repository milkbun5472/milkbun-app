const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("App 显示、核心资源和 PWA 启动地址使用同一发布版本", () => {
  const version = app.match(/APP_VERSION\s*=\s*"v([^"]+)"/)[1];
  assert.match(html, new RegExp("engine\\.js\\?v=" + version.replace(".", "\\.")));
  assert.match(html, new RegExp("app\\.js\\?v=" + version.replace(".", "\\.")));
  assert.match(html, new RegExp("manifest\\.json\\?v=" + version.replace(".", "\\.")));
  assert.equal(manifest.start_url, "./index.html?launch=" + version);
});

test("Service Worker 文件版本与注册查询版本同步", () => {
  const shell = sw.match(/SW_VERSION\s*=\s*"archive-sw-v(\d+)"/)[1];
  const registration = html.match(/serviceWorker\.register\("\.\/sw\.js\?v=(\d+)"/)[1];
  assert.equal(registration, shell);
});

test("救援页与当前发布目标同步", () => {
  const version = app.match(/APP_VERSION\s*=\s*"v([^"]+)"/)[1];
  const shell = sw.match(/SW_VERSION\s*=\s*"archive-sw-v(\d+)"/)[1];
  const rescue = fs.readFileSync(path.join(root, "rescue.html"), "utf8");
  // 救援页的目标版本收敛成了单一常量 TARGET，别再逐个字面量地找。
  // 散在多处时其中两处是转义正则（53\.26），逐版 bump 的 sed 匹配不到，
  // 于是它们停在旧版号上、救援页永远校验失败——这个坑踩过两次。
  assert.ok(rescue.includes('const TARGET="' + version + '"'), "救援页目标版本要等于当前发布版本");
  assert.equal((rescue.match(/\b5\d\.\d{2}\b/g) || []).filter(function (x) { return x !== version; }).length, 0,
    "救援页里不该再出现别的版本号字面量");
  assert.ok(rescue.includes("sw.js?v=" + shell));
});
