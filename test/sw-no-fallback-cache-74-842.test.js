// 漏发的文件不许被缓存成「首页 HTML」（她 2026-10-05：绒绒小镇公共版「为啥还是不行」）
//
// 托管方（CF Pages / GitHub Pages）对不存在的路径不给 404，而是把首页原样发回来：
//   200 + text/html。于是「文件漏发了」在网络层看起来跟「拿到了」一模一样。
// sw.js 这一层又是【缓存优先】、只看 res.ok 就存——坏响应被按同一个 ?v= 存住之后，
//   之后每次都命中它，服务器那边修好了也没用，用户那头永远是坏的。
//   （那天真实发生的：漏发的几个 .mjs/.json 缓存成了首页 HTML，模块一解析就炸，
//     卡在「正在打开小街区…」；我把服务器补齐、重发了三次，她那儿还是不行。）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const sw = fs.readFileSync("sw.js", "utf8");
const live = sw.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("① 认得出兜底页：资源路径拿到 html 就是它", () => {
  assert.match(live, /function looksLikeFallback\(url, res\)/, "没有这一层判断");
  assert.match(live, /ASSET_EXT\.test\(url\.pathname\)/, "没按【请求的是不是资源】来判断");
  assert.match(live, /text\\\/html/i, "没看 content-type");
  // 导航请求本来就该是 html，别误伤：这一支只在资源后缀上生效
  ["m?js", "json", "glb", "css", "png"].forEach(e =>
    assert.ok(new RegExp(e.replace("?", "\\?")).test(live), "资源后缀表里少了 " + e));
});

test("② 兜底页不许存进缓存", () => {
  assert.match(live, /&& !looksLikeFallback\(url, res\)\) \{\s*\n\s*cache\.put\(req, res\.clone\(\)\)/,
    "还是只看 res.ok 就存，坏响应照样被存住");
});

test("③ 已经存住的坏条目：当没命中，并就地删掉", () => {
  assert.match(live, /if \(hit && !looksLikeFallback\(url, hit\)\) return hit;/,
    "命中就直接返回，坏的也返回了");
  assert.match(live, /cache\.delete\(req\)/, "坏条目没删掉，下次还会命中它");
});

test("④ SW 版本号跟着换，旧的才会让位", () => {
  const m = live.match(/const SW_VERSION = "archive-sw-v(\d+)"/);
  assert.ok(m, "找不到 SW 版本号");
  assert.ok(Number(m[1]) >= 8, "改了缓存行为就要换版本号，否则旧 SW 继续当家");
});
