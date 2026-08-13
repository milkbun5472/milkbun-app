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
  assert.ok(rescue.includes("app.js?v=" + version));
  assert.ok(rescue.includes("v" + version));
  assert.ok(rescue.includes("sw.js?v=" + shell));
  assert.ok(rescue.includes("index.html?launch=" + version));
});
