// 贴吧配图：自动开关 + 只有描述的那张点开能生（她 2026-09-28）
const fs = require("fs"), assert = require("assert");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
assert.ok(/const forumGenImage = async \(itemId, quiet\)/.test(app));
// ⚠️原来这儿钉的是 drawFromDesc 的【整串参数表】，v74.435 加了第三个参数 ph.who
//   （让发帖的人自己说画面里有没有人）就断了——参数表不该当锚（施工规则/anchor-on-code）。
//   现在只认「走的是同一条公共画图路」这件事，参数怎么加都不再误报。
assert.ok(/await drawFromDesc\(char \|\| null, ph\.desc/.test(app), "和朋友圈同一条画图路；NPC/匿名画空景");
assert.ok(/const photo = \{ imageRef: ref, desc: ph\.desc \}/.test(app), "描述留着");
assert.ok(/loadJSON\("x_forumAutoImg", false\) && imgApiReady\(\)\) setTimeout\(\(\) => forumGenImage\(rec\.id\)/.test(app), "开关开着才自动画");
assert.ok(/h\(AutoImgSwitch, \{ storeKey: "x_forumAutoImg" \}\)/.test(scr), "贴吧有开关");
assert.ok(/onGen: !photoView\.imageRef && photoView\.itemId/.test(scr), "只有描述的才给生图键");
assert.ok(/setPhotoView\(\{ \.\.\.ph, itemId: x\.id \}\)/.test(scr));
assert.ok(/onGen && cap \? h\(DescGenImageButton/.test(comp));
console.log("forum-gen-image ok");
