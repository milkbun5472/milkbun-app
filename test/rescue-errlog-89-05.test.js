// 救援页出错记录（2026-11-03）：白屏时唯一打得开的页面要能看到 x_errlog 并一键复制。
// 锚钉在函数名和常量名上（施工规则/anchor-on-code.md），不钉文案和注释。
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const rescue = fs.readFileSync(path.join(ROOT, "rescue.html"), "utf8");
const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const manual = fs.readFileSync(path.join(ROOT, "js/assistant-manual.js"), "utf8");

test("救援页有 errReport/showErrLog，并读 x_errlog", () => {
  const i = rescue.indexOf("function errReport(");
  const j = rescue.indexOf("function showErrLog(", i);
  assert.ok(i > 0 && j > i, "抠不出 errReport / showErrLog");
  const seg = rescue.slice(i, j);
  assert.ok(seg.includes('localStorage.getItem("x_errlog")'), "errReport 没读 x_errlog");
  assert.ok(seg.includes("navigator.userAgent"), "报告里没带机型，群里还是只能猜");
});

test("救援页只读不写：不许在这一页碰 setItem/removeItem/clear", () => {
  const i = rescue.indexOf("function errReport(");
  assert.ok(i > 0);
  const seg = rescue.slice(i);
  for (const bad of ["localStorage.setItem", "localStorage.removeItem", "localStorage.clear", "indexedDB.deleteDatabase"]) {
    assert.ok(!seg.includes(bad), "救援页出错记录那一段不许写本机数据：" + bad);
  }
});

test("复制有 clipboard 和 execCommand 两条路", () => {
  const i = rescue.indexOf("function showErrLog(");
  assert.ok(i > 0);
  const seg = rescue.slice(i, rescue.indexOf("(async function rescue(", i));
  assert.ok(seg.includes("navigator.clipboard"), "没有 clipboard");
  assert.ok(seg.includes('document.execCommand("copy")'), "没有老浏览器那条退路");
});

test("?log=1 只看记录、不走刷新跳转；刷新失败时自动摊开记录", () => {
  const i = rescue.indexOf("(async function rescue(");
  assert.ok(i > 0);
  const seg = rescue.slice(i);
  const gate = seg.indexOf("/[?&]log=1/");
  const jump = seg.indexOf("index.html?launch=");
  assert.ok(gate > 0 && jump > gate, "?log=1 的闸没有挡在跳回首页之前");
  assert.ok(seg.slice(seg.indexOf("} catch (error)")).includes("showErrLog()"), "刷新失败那一支没摊开记录");
});

test("白屏卡和攻略都指得到这一页", () => {
  assert.ok(index.includes("rescue.html?log=1"), "开机白屏那张卡没给出错记录的入口");
  assert.ok(manual.includes("看出错记录") && manual.includes("?log=1"), "攻略里没写怎么看出错记录");
});

// 2026-11-04：出炉那一版把脚本装订成 js/bundle.js，救援页写死 app.js 导致它永远判
// 「刷新没有完成」。核验必须认得出【两种首页】，而且指纹后面还缀着内容哈希。
test("核验认得出 app.js 和 bundle.js 两种首页，正文判定容得下压缩", () => {
  const TARGET = rescue.match(/TARGET="([\d.]+)"/)[1];
  const src = rescue.slice(rescue.indexOf("(async function rescue("));
  assert.ok(!/["']app\.js\?v=["']\s*\+/.test(src) && !src.includes('"app.js?v="'),
    "还在写死 app.js，装订过的首页会被判成刷新失败");
  const m = src.match(/indexText\.match\((\/[^\n]+?\/)\)/);
  assert.ok(m, "没有从首页里认主脚本那一步");
  const re = new RegExp(m[1].slice(1, -1));
  for (const [tag, line] of [
    ["源码", 'src="js/app.js?v=' + TARGET + '"'],
    ["出炉", 'src="js/bundle.js?v=' + TARGET + '-807b4fa1dc783d69"'],
  ]) {
    const hit = line.match(re);
    assert.ok(hit && hit[1].indexOf(TARGET) === 0, tag + "那种首页认不出来：" + line);
  }
  // 压过的正文没有空格：APP_VERSION="v89.065"
  const body = src.slice(src.indexOf("appText"));
  assert.ok(body.includes("APP_VERSION\\\\s*=\\\\s*") || body.includes('APP_VERSION\\s*=\\s*'),
    "正文判定还在认死空格，minify 过的 bundle 会判失败");
});
