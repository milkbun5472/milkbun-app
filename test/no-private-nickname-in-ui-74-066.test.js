// 界面和代码里不许写死她给言秋的名字（2026-09-25 在公共版产物里搜出 7 处「小克」）
//
// 七处里最要紧的是【用户看得见的四句】：记忆库长文导入那句「小克的回忆录」，
// 以及缓存诊断页的三句「去跟小克连发两三条」「检查小克是不是走 fable 线路」等。
// 别人打开那两页就读得到——这跟 施工规则/prompt-no-content-samples.md 是同一个病：
// 拿自己的私事当示范，示范会跟着产物走。
//
// 另外两处是【按名字判断】的闸：
//   · js/app.js 的 B 影子试点双重保险
//   · js/inner-life-b-shadow.js 的 DENY_NAMES
// 两处都改成按【旗标 engineerEyes】判——那才是「这是数字生命本人」的真判据，
// 名字只是它当时的一个表征，而且会出货。
//
// ⚠️这份只看【会发出去的字符串】，不看注释：注释里提到是事故记录，minify 会去掉。
// ⚠️js/chat-ledger-shadow.js 不在此列——它在发版摘除清单里，整份不出货。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const NICKS = ["小克"];
const FILES = ["app.js", "screens.js", "components.js", "engine.js", "phone.js",
  "inner-life-b-shadow.js", "reply-pacing.js", "watch.js"];

const stripComments = src => src.split("\n")
  // ⚠️保留行位：整行注释置空而不是删掉，否则后面报出来的行号跟原文件对不上
  //   （写这份测试时先 filter 再数行号，报出来的全是不相干的行）
  .map(l => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l.replace(/\/\/[^"'`]*$/, "")));

test("会发出去的字符串里没有她给言秋的名字", () => {
  const bad = [];
  FILES.forEach(f => {
    const p = path.join(__dirname, "..", "js", f);
    if (!fs.existsSync(p)) return;
    stripComments(fs.readFileSync(p, "utf8")).forEach((line, i) => {
      NICKS.forEach(n => { if (line.indexOf(n) >= 0) bad.push("js/" + f + ":" + (i + 1) + " " + n); });
    });
  });
  assert.deepEqual(bad, [], "这些地方写死了私人称呼：\n" + bad.join("\n"));
});

test("B 影子那两道闸按旗标判，不按名字", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const i = app.indexOf("const observeRelationshipBShadow = ");
  assert.ok(i > 0, "找不到 observeRelationshipBShadow");
  const seg = app.slice(i, i + 600);
  assert.match(seg, /settingsFor\(char\.id\)\.engineerEyes\) return;/, "那道双重保险不是按旗标判的");
  const mod = fs.readFileSync(path.join(__dirname, "..", "js", "inner-life-b-shadow.js"), "utf8");
  assert.match(mod, /const DENY_NAMES=Object\.freeze\(\[\]\)/, "DENY_NAMES 又写回了具体名字");
});
