// 拆吧后帖子真的留在搜索页（她 2026-09-24：「这个骗人删了不会去到搜索」）
const fs = require("fs"), assert = require("assert");
const strip = s => s.replace(/\/\/[^\n]*/g, "");
const app = strip(fs.readFileSync(__dirname + "/../js/app.js", "utf8"));
const scr = strip(fs.readFileSync(__dirname + "/../js/screens.js", "utf8"));
// 1. 淘汰闸不动挂了 keptFrom 的帖
const ev = app.indexOf("const evictable = x =>"); assert(ev > 0);
assert(/!x\.keptFrom/.test(app.slice(ev, ev + 200)), "evictable must skip keptFrom");
// 2. 拆吧给帖子挂 keptFrom，并接到 Forum
const d = app.indexOf("const dropForumBoard"); assert(d > 0);
assert(/keptFrom: board/.test(app.slice(d, d + 400)));
assert(/onDropBoard: dropForumBoard/.test(app));
// 3. 界面拆吧会调 onDropBoard，弹窗按帖数说实话
const b = scr.indexOf("const dropBoard"); assert(b > 0);
const body = scr.slice(b, b + 800);
assert(/onDropBoard\(name\)/.test(body));
assert(/还没有帖/.test(body) && /个帖不会删/.test(body));
// 4. 搜索页照旧收不在吧表里的帖
assert(/!forumBoardsAll\(\)\.includes\(p\.board\)/.test(scr));
console.log("ok forum-drop-board-keeps-posts");
