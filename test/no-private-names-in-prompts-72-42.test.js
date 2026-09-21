// 提示词里不许出现她的私人角色名（2026-09-20 在公共版产物里抓到）
//
// 两处都不是「写错了」，是「拿真东西当示范」：
//   · phone.js 商品 why 那一栏：「府里那张被陆闻拍裂了一条缝」
//   · trpg.js need 那一条：「浓缩催吐解毒剂(陆衍)」
// 它们跟着 bundle 一路出货到了公共版——别人打开秋秋机，看得到她角色的名字。
// 而且这正是 施工规则/prompt-no-content-samples.md 那条病：
// 那一栏里唯一可复制的东西就是示范，写得越具体被抄得越狠。
//
// ⚠️这份测试只看【会发出去的字符串】，不看注释：
//   注释里提到陆闻/陆衍是事故记录，minify 会去掉，家里该留着。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const NAMES = ["陆闻", "陆衍", "沈屿白", "裴照川"];
const FILES = ["app.js", "engine.js", "phone.js", "components.js", "screens.js", "trpg.js", "read.js", "study.js"];

// 把整行是注释的那些去掉（// 开头、块注释里的 * 开头）——剩下的才是会出货的字
const stripComments = src => src.split("\n")
  .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join("\n");

test("会发出去的字符串里没有她的私人角色名", () => {
  const bad = [];
  FILES.forEach(f => {
    const p = path.join(__dirname, "..", "js", f);
    if (!fs.existsSync(p)) return;
    const code = stripComments(fs.readFileSync(p, "utf8"));
    code.split("\n").forEach((line, i) => {
      NAMES.forEach(n => { if (line.indexOf(n) >= 0) bad.push("js/" + f + ":" + (i + 1) + " " + n); });
    });
  });
  // screens.js 的 placeholder 和 app.js 的 toast 是【她自己界面上的提示】，
  // 发版补丁已经把它们换掉/删掉；这里只拦【提示词】，所以允许这两处留在家里。
  const left = bad.filter(x => !/screens\.js|app\.js/.test(x));
  assert.deepEqual(left, [], "提示词里出现了私人角色名：\n" + left.join("\n"));
});
