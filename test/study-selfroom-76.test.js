// 群友 2026-10-23「好想在群聊里自习」→ 她：放进一起学、能联动其他模式保存进度
const assert = require("node:assert/strict");
const rd = f => require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", f), "utf8");
const st = rd("study.js"), rooms = rd("chat-rooms.js");
assert.match(st, /\["tb", "我来教"\], \["self", "自习室"\]\]/);
assert.match(st, /function SelfStudyRoom\(props\)/);
// 挂课：时长算进那门课、小结挂进往期总结；挂研究纸：小结进它的对话
assert.match(st, /x\.mode !== "selfstudy" \|\| x\.link_cur !== cur\.id/);
assert.match(st, /if \(s\.link_cur && typeof pushCurriculumSummary === "function"\) pushCurriculumSummary\(s\.link_cur, s\.id, text\);/);
assert.match(st, /if \(s\.link_paper\) saveSessions/);
// 自习记录不混进研究纸那栏、不当成房间里「在学」的课
assert.match(st, /return !s\.curriculum_id && s\.mode !== "selfstudy";/);
assert.match(rooms, /s\.mode !== "selfstudy" &&/);
// 说话照人设、想说几句说几句、不写条数；整轮只有半程那一次自己开口
assert.match(st, /照各自平时说话的样子，想说几句就几句，一句一条；没什么想说的人可以不说。/);
assert.match(st, /voiceGuards\(\[cx\.directives\], \[\{ sr: cx\.studyRules/);
assert.equal((st.match(/halfSaid: true/g) || []).length, 1);
console.log("ok");
// 她 2026-10-23「接上群聊那种保存全部人人设防止 ooc」：几个人时跟群聊同一摞规矩、同一把人设额度
assert.match(st, /chars\.length > 1 && typeof groupBans === "function" \? \[groupBans\(\{ worldbook: true \}\)\]/);
assert.match(st, /groupPersonaText\(c\.persona, budget\)/);
assert.match(st, /const budget = typeof groupPersonaBudget === "function" \? groupPersonaBudget\(chars\.length\)/);
assert.match(st, /【在场的人彼此之间】/);
assert.ok(!/String\(c\.persona \|\| "（暂无设定）"\)\.slice\(0, chars\.length > 1 \? 1600/.test(st), "又把人设砍回 1600 字了");
console.log("group ok");
