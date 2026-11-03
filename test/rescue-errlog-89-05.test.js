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
