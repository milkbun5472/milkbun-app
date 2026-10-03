// 朋友圈配图：自动开关 + 每张只有描述的图可以点开生图（她 2026-09-28）
const fs = require("fs"), assert = require("assert");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
// ⚠️原来钉的是【整串参数表】，v74.611 加了 force（重拍这一张）就断（施工规则/anchor-on-code）。
assert.ok(/const momentGenImage = async \(momentId, quiet/.test(app), "有 momentGenImage");
assert.ok(/const drawFromDesc = async \(char, desc[,)]/.test(app), "画图走共用那一份");
assert.ok(/String\(mom\.image\)/.test(app), "第一次生图取自配图描述");
assert.ok(/already \? String\(mom\.imageDesc\)/.test(app), "重拍取当初那段描述，不是把图当描述");
assert.ok(/image: ref, imageDesc: desc/.test(app), "成图写回 m.image，描述留在 imageDesc");
assert.ok(/if \(!isImgRef\(ref\)\) throw/.test(app), "没存进本机不许装成功");
assert.ok(/loadJSON\("x_momentAutoImg", false\) && imgApiReady\(\)\) setTimeout\(\(\) => momentGenImage\(newMomId\)/.test(app), "开关开着才自动画");
assert.ok(/function MomentAutoImgSwitch/.test(comp) && /h\(MomentAutoImgSwitch, null\)/.test(comp), "朋友圈顶上有开关");
assert.strictEqual((comp.match(/h\(MomentGenImageButton, \{ momentId: imgMid/g) || []).length, 2, "信息流和个人页都有生图键");
assert.strictEqual((comp.match(/setImgMid\(m\.characterId \? m\.id : null\)/g) || []).length, 4,
  "四处：两处描述图（生图）＋两处已成图（重拍也得知道拍的是哪一条）");
assert.ok(/minHeight: 40/.test(comp.slice(comp.indexOf("function DescGenImageButton"), comp.indexOf("function MomentGenImageButton"))), "触控 40px");
console.log("moment-gen-image ok");
