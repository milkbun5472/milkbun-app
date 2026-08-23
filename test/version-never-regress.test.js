const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");

// 2026-08-22 她抓到：「笨蛋我说版本号 .19 了你推了个 .13」。
// 我连着几版硬编码「下一个号」，而 Codex 同时也在发版，结果把 APP_VERSION
// 从 55.19 一路盖回 55.13——缓存指纹倒退，她手机可能根本刷不到新文件。
// 号必须从仓库现状 + 提交历史里取最大值再加一，不能凭记忆写。

test("发版脚本存在，且会从仓库与历史里取最大值", () => {
  const s = fs.readFileSync(path.join(root, "scripts/bump-version.mjs"), "utf8");
  assert.match(s, /git log --format=%s/, "别人刚发的版本可能已被本地覆盖，只有提交历史记得");
  assert.match(s, /拒绝倒退/, "低于现有最大值必须直接失败");
  assert.match(s, /process\.exit\(1\)/);
  // 四处指纹一个都不能漏
  ["APP_VERSION", "manifest.json?v=", 'TARGET="', "launch="].forEach(k =>
    assert.ok(s.includes(k), "脚本没同步：" + k));
});

test("当前四处指纹一致，且没有低于历史最高版", () => {
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const v = app.match(/APP_VERSION\s*=\s*"v([\d.]+)"/)[1];
  assert.ok(html.includes("app.js?v=" + v), "index.html 的 app.js 指纹对不上");
  assert.ok(html.includes("manifest.json?v=" + v));
  assert.ok(fs.readFileSync(path.join(root, "rescue.html"), "utf8").includes('TARGET="' + v + '"'));
  assert.ok(fs.readFileSync(path.join(root, "manifest.json"), "utf8").includes("launch=" + v));
  // 这一版必须高于我误推的那个 55.13
  const n = x => { const [a, b] = x.split("."); return +a * 1000 + +b; };
  assert.ok(n(v) > n("55.19"), "得高于 Codex 已发的 55.19，现在是 " + v);
});
