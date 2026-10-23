// 她 2026-10-23「论坛是不是没有时间戳，我回复上个星期的帖子他还会当成最近」
const assert = require("node:assert/strict");
const rd = f => require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", f), "utf8");
const scr = rd("screens.js"), app = rd("app.js");
const pick = (name, end) => scr.slice(scr.indexOf(name), scr.indexOf(end, scr.indexOf(name)));
const src = pick("const forumStamp = ", "// 吧规只许从这一处读");
const fmtStampAI = ts => (Date.now() - ts > 86400000 ? "10/16 21:05" : "今天14:32");
const forumWithPhoto = t => t;
const api = new Function("fmtStampAI", "forumWithPhoto", src + " return { forumFloorTranscript, forumTimeLine };")(fmtStampAI, forumWithPhoto);
const old = Date.now() - 7 * 86400000;
const tx = api.forumFloorTranscript([{ floor: 2, authorName: "路人", content: "顶", ts: old, replies: [{ authorName: "她", content: "我也觉得", ts: Date.now() }] }]);
assert.match(tx, /^〔10\/16 21:05〕2楼 路人：顶/);
assert.match(tx, /└ 〔今天14:32〕她：我也觉得/);
assert.match(api.forumTimeLine({ ts: old }), /已经是 7 天前的帖了/);
assert.equal(api.forumTimeLine({}), "", "没时间的老帖不硬写");
// 她回楼、继续刷楼两处都接上
assert.match(app, /"」。" \+ opDesc \+ "。\\n" \+ \(typeof forumTimeLine === "function" \? forumTimeLine\(post\) : ""\)/);
assert.match(app, /【继续刷楼、盖楼】，续着往下刷、别重开话题。" \+ \(typeof forumTimeLine === "function" \? forumTimeLine\(post\) : ""\)/);
console.log("ok");
