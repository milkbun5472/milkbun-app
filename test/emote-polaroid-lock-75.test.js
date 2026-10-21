// 他的表情包、拍立得、他的锁屏（她 2026-10-13）
const assert = require("node:assert");
const fs = require("node:fs"), path = require("node:path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = rd("app.js"), scr = (rd("screens.js") + "\n" + rd("screens-ui.js")), comp = rd("components.js");
// 表情包：九宫格切开，进抠图那一组；抠图存表情时关键词别再被包名盖掉
assert.match(app, /const makeEmoteSet = async \(charId, setOpt\) =>/);
assert.match(app, /你的表情包里已经有这些了/);
assert.match(app, /window\.__addSelfSticker\(cv\.toDataURL\("image\/png"\), char\.id, items\[k\]\.name, true, !!\(setOpt && setOpt\.caption\)\)/);
assert.match(app, /const packName = /);
assert.match(scr, /"data-wk": "emomakeset"/);
// 拍立得：显影前哪儿都是灰白相纸，长按甩一甩
assert.match(app, /polaroid: true, developAt: Date\.now\(\) \+ 2 \* 3600000/);
assert.match(scr, /const developing = !!\(photo && photo\.polaroid && Number\(photo\.developAt\) > Date\.now\(\)\)/);
assert.match(scr, /"data-wk": "studiopolaroid"/);
// 锁屏：只在她刚发图／他刚发照片那一轮提
assert.match(app, /const _lockHint = _lockSrc \?/);
assert.match(app, /_lockSrc && \(parsed\.lockscreen === true \|\| Number\(parsed\.lockscreen\) > 0\)/);
assert.match(comp, /m\.kind === "locknote"/);
console.log("ok");
assert.match(app, /是你自己画的那套 Q 版/);
// 图上印字（她 2026-10-13）
assert.match(app, /if \(setOpt && setOpt\.caption\) paintEmoteCaption\(/);
assert.match(app, /const captionEmotePack = async packId =>/);
assert.match(scr, /onMakeSet\(c\.id, \{ caption: setCaption \}\)/);
