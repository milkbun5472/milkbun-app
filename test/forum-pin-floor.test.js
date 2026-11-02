// 她 2026-11-02 转群友：论坛评论置顶。她在自己帖子下钉一楼；楼主角色回帖时自己决定钉哪一楼；楼里的人都看得见
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
// 存：一帖一楼，空＝取消
assert.match(app, /const pinForumFloor = \(postId, floorId, by\) => \{/);
assert.match(app, /pinFloor: floorId \|\| null, pinBy: floorId \? \(by \|\| "me"\) : null/);
assert.match(app, /onPinFloor: pinForumFloor,/);
// 模型：楼主角色那一栏，0／没填不动；两个 round2 调用点都接上
const seg = app.slice(app.indexOf("  const forumPinFromModel = "), app.indexOf("  const forumPinLine = "));
const calls = [];
const f = new Function("isForumCharAuthor", "pinForumFloor", seg + "; return forumPinFromModel;")(p => p.authorType === "character", (...a) => calls.push(a));
const floors = [{ id: "f2", floor: 2 }, { id: "f3", floor: 3 }];
f({ id: "p", authorType: "character" }, { pin_floor: 3 }, floors);
f({ id: "p", authorType: "character" }, { pin_floor: 0 }, floors);
f({ id: "p", authorType: "me" }, { pin_floor: 2 }, floors);
f({ id: "p", authorType: "character", pinFloor: "f2" }, { pin_floor: 2 }, floors);
assert.deepEqual(calls, [["p", "f3", "op"]]);
assert.equal((app.match(/forumPinFromModel\(post, d, existing\);/g) || []).length, 2);
assert.match(app, /schemaHint: "\{" \+ \(opChar \? "\\"pin_floor\\":0," : ""\)/);
assert.match(app, /opRule2 \+ opPinRule \+ meRule/);
assert.match(app, /opRule2Full \+ forumPinLine\(post, opts\.existingFloors\)/, "楼里每个开口的人都看得见谁被钉着");
// 界面：置顶的挪最上面、楼号不变；按钮只在她自己的帖子下；详情页读最新那份帖子
assert.match(scr, /if \(pinAt > 0\) list\.unshift\(list\.splice\(pinAt, 1\)\[0\]\);/);
assert.match(scr, /onPinFloor && post\.authorType === "me" && cm\.id && h\("button", \{ "data-wk": "fopin"/);
assert.match(scr, /const p = \(\(posts \|\| \[\]\)\.find\(x => x && x\.id === open\.id\)\) \|\| open;/);
console.log("ok");
