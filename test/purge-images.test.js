// 她 2026-11-02：「本机照片库和他们拍的照片弄成一个公共的，从一边删除另一边就没了」
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
// 一份公共的：两页都走它
assert.equal((app.match(/const purgeImages = async refs =>/g) || []).length, 1);
assert.equal((scr.match(/window\.__purgeImages\(ks\)/g) || []).length, 2, "照片库和 TA 们拍的照片两页");
// 删消息：单聊／小房间、群聊、线下、群线下都扫
const seg = app.slice(app.indexOf("const purgeImages = async refs =>"), app.indexOf("window.__purgeImages = purgeImages;"));
["pChat(k, p => p.filter(m => !hit(m)))", "pGChat(k, p => p.filter(m => !hit(m)))", "pOffline(k, strip)", "pGOffline(k, strip)"].forEach(x => assert.ok(seg.includes(x), x));
// 删图：img_（他拍的，一条一把）连像素和原图删；iv_（她的真照片，按内容存）只删照片库那一行，像素留
const d = app.slice(app.indexOf("const dropImgFiles = async"), app.indexOf("const purgeImages = async"));
assert.match(d, /if \(String\(r\)\.indexOf\("img_"\) === 0\) \{ try \{ await idbImgDel\(r\); \}/);
assert.doesNotMatch(d, /idbVaultDel/);
// 聊天里删：别处还用着的留（刚删的那几条不算「还在用」）
assert.match(app, /if \(goneImgs\.length\) dropImgFiles\(goneImgs, new Set\(picked\)\);/);
assert.match(app, /if \(gone\.length\) dropImgFiles\(gone, new Set\(goneMsgs\)\);/);
// imgStillUsed 跑一遍
const used = new Function("chatsRef", "groupChatsRef", "offlinesRef", "groupOfflinesRef",
  app.slice(app.indexOf("const msgImgRefs = "), app.indexOf("const dropImgFiles = async")) + "; return imgStillUsed;");
const a = { imgKey: "img_c_1" }, b = { imgKey: "img_c_1" };
const f = used({ current: { c: [a, b] } }, { current: {} }, { current: {} }, { current: {} });
assert.equal(f("img_c_1", new Set([a])), true, "还有一条在用");
assert.equal(f("img_c_1", new Set([a, b])), false);
console.log("ok");
