// 她 2026-09-14：「查手机能不能也接翻译，包括标题和内容还有心里想法，
// 任何可能出现别的语言的地方」。
//
// ⚠️不自己写第二套翻译：聊天气泡那套（TransText）现成的——探得出外语才挂「译」键，
// 中文原样返回。译文缓存、翻译线路、「直接显示／点击显示」那个全局开关也跟着一起有了。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const phone = fs.readFileSync(path.join(root, "js/phone.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

test("只包一层壳，不另起一套翻译", () => {
  assert.match(phone, /function PTX\(v\) \{/);
  assert.match(phone, /typeof TransText === "function" \? h\(TransText, \{ text: s \}\) : s/);
  // 空字符串原样返回：别给空行挂一颗「译」键
  assert.match(phone, /if \(!s\) return s;/);
  // TransText 得真是全局的（phone.js 拿得到）——照抄用法却没带定义，进页面就白屏
  assert.match(comp, /^function TransText\(/m);
});

test("时间线那张详情卡：标题、正文、TA心里想的，三样都接上了", () => {
  // 这一张卡是二十来个 app 的条目共用的出口，接这一处等于全接上
  assert.ok(phone.includes('} }, PTX(sheet.title)),'));
  assert.ok(phone.includes('} }, PTX(sheet.text)),'));
  assert.ok(phone.includes('}, PTX(sheet.thought)),'));
});

test("各 app 自己那几处正文也接了", () => {
  const want = [
    /PTX\(m\.text\)/,            // 微信气泡
    /PTX\(m\.content\)/,         // 朋友圈正文
    /PTX\(x\.text\)/,            // 朋友圈评论
    /PTX\(it\.body\)/,           // 便签／录音
    /PTX\(article\.title\)/,     // 公众号
    /PTX\(article\.summary\)/,
    /PTX\(article\.thought\)/,
    /PTX\(photo\.thought\)/,     // 相册
    /PTX\(x\.thought\)/,         // 通话／短信
    /PTX\(S\(open\.thought\)\)/  // 邮件
  ];
  want.forEach(re => assert.match(phone, re, "漏了 " + re));
  // 列表上那些标题（购物、浏览器、广场…）也一起换了
  assert.ok((phone.match(/PTX\(it\.title\)/g) || []).length >= 5);
});

test("接上之后别把空值画成 undefined", () => {
  // PTX 里统一转成字符串再判空，所以 it.title 为 undefined 时返回的是 ""
  assert.match(phone, /const s = String\(v == null \? "" : v\);/);
  assert.ok(!/PTX\(\)/.test(phone));
});
