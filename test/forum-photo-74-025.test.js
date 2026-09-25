// 贴吧配图（她 2026-09-24：「贴吧能不能也支持上传图片或者写假图描述跟聊天一样。然后角色也可以（不要强制）」）
const fs = require("fs"), assert = require("assert"), vm = require("vm");
const strip = s => s.replace(/^\s*\/\/[^\n]*$/gm, "");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const cmp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");

// 1. 公共两件：认 photo、把配图拼进喂模型的字
const i = scr.indexOf("function forumPhotoOf("), j = scr.indexOf("function forumBoardAbout(", i);
assert.ok(i > 0 && j > i, "抠不出 forumPhotoOf");
const ctx = {}; vm.runInNewContext(scr.slice(i, j), ctx);
assert.strictEqual(ctx.forumPhotoOf({}), null);
assert.strictEqual(ctx.forumPhotoOf({ photo: { desc: "  " } }), null, "空假图等于没配");
assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.forumPhotoOf({ photo: "窗台上一盆绿萝" }))), { desc: "窗台上一盆绿萝" }, "模型交字符串也认");
assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.forumPhotoOf({ photo: { imageRef: "iv_x", desc: "" } }))), { imageRef: "iv_x", desc: "" });
assert.strictEqual(ctx.forumWithPhoto("正文", {}), "正文");
assert.ok(/正文 〔配图：A〕/.test(ctx.forumWithPhoto("正文", { photo: { desc: "A" } })));
assert.ok(/没写说明/.test(ctx.forumWithPhoto("", { photo: { imageRef: "iv_x" } })));

// 2. 发帖 / 回楼：她的图真的存上
const pm = app.indexOf("const postMyForum = ("); assert.ok(pm > 0);
assert.match(app.slice(pm, pm + 600), /\(board, title, body, photo\)[\s\S]*photo: forumPhotoOf\(\{ photo \}\)/);
const af = app.indexOf("const addForumFloor = ("); assert.ok(af > 0);
const afBody = app.slice(af, app.indexOf("const addForumSubReply", af));
assert.match(afBody, /photo: forumPhotoOf\(\{ photo \}\)/);
assert.match(afBody, /genRepliesToMe\(post, fid, forumWithPhoto\(text, floor\)/, "楼里的人看得见她那张图");

// 3. 角色/网友：可选的一栏，发帖、刷吧、盖楼三处都接上，并且落盘
assert.match(app, /const FORUM_PHOTO_LINE = /);
assert.ok((strip(app).match(/FORUM_PHOTO_LINE/g) || []).length >= 5, "声明 + 四处引用");
assert.ok((strip(app).match(/FORUM_PHOTO_FIELD/g) || []).length >= 5);
const bf = app.indexOf("const buildForumFloor = ("); assert.ok(bf > 0);
assert.match(app.slice(bf, bf + 2000), /photo: forumPhotoOf\(x\)/);
const pc = app.indexOf("const postCharToForum = ("); assert.ok(pc > 0);
assert.match(app.slice(pc, pc + 800), /photo: forumPhotoOf\(content\)/);
assert.match(app, /identity: rolledId, photo: d\.photo \}/);
// 不强制：那一句里没有「必须/每条都要」
const line = (app.match(/const FORUM_PHOTO_LINE = "([^"]*)"/) || [])[1] || "";
assert.ok(line && !/必须|每条都|至少/.test(line), "配图不许写成硬性要求");

// 4. 喂模型的正文、楼层都过 forumWithPhoto
assert.match(app, /正文「" \+ forumWithPhoto\(post\.body, post\) \+ "」。生成/);
assert.match(app, /正文「" \+ forumWithPhoto\(post\.body, post\) \+ "」。楼下网友/);
assert.match(app, /forumWithPhoto\(f\.content, f\)/);
assert.match(app, /forumWithPhoto\(floor\.content, floor\)/);

// 5. 界面：一张公共的挂图件，发帖和回楼共用；显示走聊天那张 PhotoCard / PhotoSheet
assert.match(cmp, /function PhotoAttach\(\{ value, onChange, toast \}\)/);
assert.match(cmp, /function photoAttachValue\(v\)/);
assert.ok((scr.match(/h\(PhotoAttach,/g) || []).length === 2, "发帖、回楼各一处");
assert.match(scr, /onPostMine\(cbBoard, cbTitle\.trim\(\), cbBody\.trim\(\), photoAttachValue\(cbPhoto\)\)/);
assert.match(scr, /onReplyFloor\(open, rTxt\.trim\(\), ph\)/);
assert.match(scr, /h\(PhotoCard, \{ m: ph/);
assert.match(scr, /h\(PhotoSheet, \{ m: photoView/);
assert.match(scr, /forumPhotoCard\(p, 280\)/);
assert.match(scr, /forumPhotoCard\(cm, 220\)/);
// 配图按钮是 40px 触控位
assert.match(scr, /"aria-label": "配图"[^\n]*width: 40, height: 40/);
console.log("ok forum-photo");
