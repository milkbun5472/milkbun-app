// 片刻：自己发的视频能改文案；小号能换头像（群友 2026-10-31）；组件外的 toast 不再被吞
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const R = f => fs.readFileSync(require.resolve("../js/" + f), "utf8");
const sh = R("shua.js"), core = R("core.js"), cmp = R("components.js"), ts = R("theme-studio.js");
test("改文案只给自己发的，评论赞不动", () => {
  assert.equal((sh.match(/onEditText: v\.by === "me" \? \(\) => editText\(v\) : null,/g) || []).length, 2);
  assert.match(sh, /patchV\(v\.id, x => Object\.assign\(\{\}, x, \{ caption: cap, tags:/);
});
test("小号头像：用小号时主页头像能换，存在 me.altAvatar", () => {
  assert.match(sh, /"data-wk": "shuaaltavatar"/);
  assert.match(sh, /me: Object\.assign\(\{\}, dbRef\.current\.me, \{ altAvatar: ref \|\| d \}\)/);
  assert.match(ts, /\["shuaaltavatar",/);
});
test("全局 toast 转给 window.__toast", () => {
  assert.match(core, /function toast\(msg, ms\) \{ try \{ if \(typeof window !== "undefined" && typeof window\.__toast === "function"\) return window\.__toast\(msg, ms\);/);
  assert.match(cmp, /function fileToast\(msg, ms\)/);
});
