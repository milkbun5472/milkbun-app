// 群友 2026-10-14 许愿：朋友圈像微信一样有新消息提示；聊天一键到顶／到底
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8"), c = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
eval(app.match(/const flagMomentNews = [\s\S]*?\n  \};\n/)[0].replace("const flagMomentNews", "global.F"));
const p = [{ id: 1, mine: true, author: "我", comments: [], likers: [] }, { id: 2, author: "他", comments: [{ author: "我", mine: true, text: "哈" }] }];
const n = [{ id: 1, mine: true, author: "我", comments: [{ author: "他", text: "好看" }], likers: ["他"] }, { id: 2, author: "他", comments: [{ author: "我", mine: true, text: "哈" }, { author: "他", text: "回复 我：嗯" }, { author: "路人", text: "路过" }] }];
const out = F(p, n);
assert.equal(out[0].comments[0].unseen, true); assert.deepEqual(out[0].newLikes, ["他"]);
assert.equal(out[1].comments[1].unseen, true); assert.ok(!out[1].comments[2].unseen, "别人那条底下不是回我的，不提醒");
assert.match(app, /let n = flagMomentNews\(p,/);
assert.match(c, /"data-wk": "momnewsbadge"/); assert.match(c, /"data-wk": "momnewsclear"/);
assert.equal((c.match(/h\(ChatJumpArrows, \{/g) || []).length, 4, "单聊、群聊、线下、群线下各一处");
console.log("ok");
