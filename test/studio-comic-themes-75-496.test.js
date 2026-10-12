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
