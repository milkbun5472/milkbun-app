// 聊天画成四格漫画 + 照相馆题材 / 换画风（她 2026-10-12：「1和2做吧 45也可以」）
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = rd("app.js"), comp = rd("components.js"), scr = rd("screens.js");
assert.match(comp, /"data-wk": "selcomic"[\s\S]{0,200}"画成漫画"/);
assert.match(app, /onComic: indices =>/);
assert.match(app, /const comicFromMessages = async/);
assert.match(app, /不要任何文字、不要对话气泡/, "字不能交给图像端写");
assert.match(app, /opt && opt\.comic \? await comicCompose/);
assert.match(app, /STUDIO_THEMES/);
assert.match(scr, /"data-wk": "studiothemes"/);
assert.match(scr, /"data-wk": "studiorestyle"/);
console.log("ok studio-comic-themes");
// 自定义题材（她 2026-10-12：「题材要可以自定义」）
assert.match(app, /window\.__studioThemeSave = /);
assert.match(app, /saveJSON\("x_studioThemes"/);
assert.match(app, /const theme = opt && opt\.theme \? studioThemeOf\(opt\.theme\) : null;/);
assert.match(scr, /"data-wk": "studiothemeadd"/);
assert.match(scr, /"\+自己写"|"＋自己写"/);
console.log("ok custom themes");
// 换画风只转原图；墙上分类；重画叠成一摞（她 2026-10-13）
assert.match(app, /const prompt = RESTYLE_ONLY \|\| buildPhotoPrompt/, "换画风不许再走整套拍照提示词");
assert.match(app, /parentId: opt\.restyle\.parent/);
assert.match(scr, /"data-wk": "studiokinds"/);
assert.match(scr, /"data-wk": "studiostack"/);
assert.match(scr, /"data-wk": "studiostackbadge"/);
assert.match(scr, /const stackKey = x =>/);
console.log("ok stack");
// 画风可自定义（她 2026-10-13）
assert.match(scr, /"data-wk": "studiostyleadd"/);
assert.match(scr, /saveJSON\("x_studioStyles"/);
assert.match(scr, /STYLES\.concat\(myStyles\)/);
console.log("ok styles");
// Q版只换了脸（她 2026-10-13 截图）：画风要整张换，身体比例跟着变
assert.match(app, /别出现真人身体顶着一张画风脸/);
assert.match(app, /STYLE_BODY\[opt\.restyle\.style\]/);
console.log("ok body");
// Q版只换了脸、油画发脏（她 2026-10-13 截图）：画风整张换，各画风有自己的要求
assert.match(app, /别出现真人身体顶着一张画风脸/);
assert.match(app, /STYLE_BODY\[opt\.restyle\.style\]/);
assert.match(app, /不要粗糙的刮刀肌理/);
console.log("ok body");
// Q版改成平面贴纸那种，原来那种立体的单独叫「手办」（她 2026-10-13）
assert.match(app, /"手办": "/);
assert.match(app, /平面的 Q 版二次元插画/);
assert.match(scr, /"Q版", "手办"/);
console.log("ok figure");
// 杂志封面：字量着写不出画；挑了衣服题材照穿（她 2026-10-13）
assert.match(app, /const coverCopy = async \(char, kind, title\) =>/);
assert.match(app, /\(!theme \|\| picked\)/);
assert.match(app, /window\.PosterLayout\.compose\(blob, plan, copy, names\)/);
assert.match(app, /editorial: theme.overlay/);
assert.match(require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "engine.js"), "utf8"), /绝对不是自拍/);
console.log("ok cover");
// 大图要整张显示（她 2026-10-13：封面两边的字被截掉——是大图 cover 裁掉了左右）
assert.match(scr, /h\(AlbumPhoto, \{ photo: big, full: true \}\)/);
assert.match(scr, /h\(AlbumPhoto, \{ photo: y, full: true \}\)/);
console.log("ok full");
