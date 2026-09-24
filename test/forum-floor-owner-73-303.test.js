// 插进已有楼层的楼中楼，署名「层主」要认成这层楼的作者；层主是她时整条丢掉
// （她 2026-09-23：「我自己的回复一直有个层主但是明明我就是这一层的层主」）。
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const cut = name => { const i = app.indexOf("const " + name + " = "); assert(i > 0, name); return app.slice(i, app.indexOf("\n  };", i) + 5).replace(/^const /, "var "); };
const box = {
  characters: [], isForumCharAuthor: x => !!(x && String(x.authorType || "").startsWith("character")),
  forumCharIdentity: c => ({ authorName: c.name, authorHandle: c.name, authorType: "character" }),
  forumPublicNpcOf: x => ({ name: x.authorName || "路人", handle: "h", id: "npc" })
};
vm.createContext(box);
vm.runInContext(app.slice(app.indexOf("const forumIsMine = "), app.indexOf(";\n", app.indexOf("const forumIsMine = ")) + 2).replace(/^const /, "var ") + cut("forumValidTo") + cut("buildForumReplyObjBase") + cut("buildForumReplyObj"), box);
const post = { authorType: "npc", authorName: "电瓶车坐垫受害者" };
const myFloor = { authorType: "me", authorId: "me", authorName: "Lisa" };
assert.strictEqual(box.buildForumReplyObj({ authorName: "层主", content: "5秒太短了" }, post, myFloor), null, "层主是她：不许替她开口");
assert.strictEqual(box.buildForumReplyObj({ is_owner: true, content: "x" }, post, myFloor), null);
const npcFloor = { authorType: "npc", authorId: "n1", authorName: "沙发不是我的", authorHandle: "sofa" };
const r = box.buildForumReplyObj({ authorName: "层主", content: "嗯" }, post, npcFloor);
assert.strictEqual(r.authorName, "沙发不是我的"); assert.strictEqual(r.isOwner, true);
assert.strictEqual(box.buildForumReplyObj({ authorName: "路人甲", content: "嗯" }, post, myFloor).authorName, "路人甲", "别的路人照常");
// 两处插楼中楼都把那层楼递进去
assert.strictEqual((app.match(/buildForumReplyObj\(x, post, floorByNum\.get\(tf\)\)/g) || []).length, 2);
// 开机清掉已经落下的那种
assert(/floorMine && r\.authorType !== "me" && String\(r\.authorName \|\| ""\)\.trim\(\) === "层主"/.test(app));
console.log("forum-floor-owner ok");
// v73.305：新开的楼直接递给 genRepliesToMe，别等 ref 跟上；认不出楼就不生成（截图：自己新开的楼里冒出「层主 回复 @Lisa」）
assert(/genRepliesToMe\(post, fid, text, "", floor\)/.test(app), "新开的楼要直接递进去");
assert(/\.find\(f => f\.id === floorId\) \|\| knownFloor \|\| null;\n\s*\/\/[^\n]*\n\s*if \(!floor\) return;/.test(app), "认不出楼就不生成");
console.log("forum-floor-owner v73.305 ok");
