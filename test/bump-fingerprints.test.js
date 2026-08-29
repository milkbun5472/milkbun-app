// 发版指纹：改了模块却不换 ?v=，等于没发出去。
// 她 2026-08-29「查手机页面直接崩了」——查下来 phone.js 的 ?v= 从 v57.43 起
// 十八个版本一个字没变，浏览器一直吃缓存里那份旧的，用户手上就成了
// 【新 app.js + 旧 phone.js】的混合体，崩在最意想不到的地方。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const stamp = f => {
  const m = new RegExp("js/" + f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\.js\\?v=([\\d.]+)").exec(html);
  return m ? m[1] : null;
};

test("每个被 index.html 引用的 js 都带 ?v= 指纹", () => {
  const refs = [...html.matchAll(/src="js\/([a-z0-9-]+)\.js(\?v=[\d.]+)?"/g)];
  assert.ok(refs.length > 20, "只找到 " + refs.length + " 个脚本引用，正则怕是失效了");
  refs.forEach(m => assert.ok(m[2], "js/" + m[1] + ".js 没有 ?v= 指纹，浏览器会一直吃缓存"));
});

test("查手机那一套的指纹跟得上主版本，不再落在后面", () => {
  const app = stamp("app");
  assert.ok(app, "app.js 没有指纹");
  // phone.js 从此跟着主版本走（已进 bump 脚本的 CORE）
  assert.equal(stamp("phone"), app, "phone.js 的指纹落后于 app.js —— 这正是 v57.61 崩的原因");
});

test("bump 脚本会给「改了但不在 CORE 里」的模块也换指纹", () => {
  const src = fs.readFileSync(path.join(root, "scripts", "bump-version.mjs"), "utf8");
  assert.match(src, /const CORE = \[[^\]]*"phone"/, "phone 没进 CORE");
  assert.match(src, /git diff --name-only HEAD -- js\//, "没有兜底：改了别的模块照样会漏");
  assert.match(src, /extra\.forEach\(f => \{ html = html\.replace/);
  assert.match(src, /顺带换指纹/);
});

test("工作区里改过的 js，指纹必须已经换成最新版（发版前自检）", () => {
  let touched = [];
  try {
    touched = execSync("git diff --name-only HEAD -- js/", { cwd: root, encoding: "utf8" })
      .split("\n").map(x => x.trim()).filter(x => x.endsWith(".js"));
  } catch (e) { return; }   // 不在 git 环境里就跳过
  const app = stamp("app");
  touched.forEach(f => {
    const name = f.replace(/^js\//, "").replace(/\.js$/, "");
    const v = stamp(name);
    if (!v) return;         // 没被 index.html 引用（测试桩之类）
    assert.equal(v, app, name + ".js 改了但指纹还停在 " + v + "，发出去她刷不到");
  });
});
