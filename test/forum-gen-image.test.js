// 贴吧配图：自动开关 + 只有描述的那张点开能生（她 2026-09-28）
const fs = require("fs"), assert = require("assert");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
assert.ok(/const forumGenImage = async \(itemId, quiet\)/.test(app));
assert.ok(/await drawFromDesc\(char \|\| null, ph\.desc\)/.test(app), "和朋友圈同一条画图路；NPC/匿名画空景");
assert.ok(/const photo = \{ imageRef: ref, desc: ph\.desc \}/.test(app), "描述留着");
assert.ok(/loadJSON\("x_forumAutoImg", false\) && imgApiReady\(\)\) setTimeout\(\(\) => forumGenImage\(rec\.id\)/.test(app), "开关开着才自动画");
assert.ok(/h\(AutoImgSwitch, \{ storeKey: "x_forumAutoImg" \}\)/.test(scr), "贴吧有开关");
assert.ok(/onGen: !photoView\.imageRef && photoView\.itemId/.test(scr), "只有描述的才给生图键");
assert.ok(/setPhotoView\(\{ \.\.\.ph, itemId: x\.id \}\)/.test(scr));
assert.ok(/onGen && cap \? h\(DescGenImageButton/.test(comp));
console.log("forum-gen-image ok");
