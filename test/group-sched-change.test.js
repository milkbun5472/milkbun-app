// 她 2026-10-20：「群聊能改角色日程安排吗」→「接上吧」：群聊、群线下里当场改的安排写回本人今天的日程
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const eng = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");
// 群聊：成员看得到自己的安排，有安排的人才开 schedNow，写回走 applySchedChange、闭群不写
assert.match(app, /const schSeg = [^\n]*schedBriefFor\(c\)[^\n]*〔今天此刻在做什么〕/);
assert.match(app, /_gSchedNames\.length \? "\\n【改安排】"[^\n]*SCHED_NOW_SPEC/);
assert.match(app, /item\.schedNow[^\n]*timeAwareFor\(spk\.id\) && !groupClosed\(groupId\)\) applySchedChange\(spk\.id, item\.schedNow\)/);
// 群线下：两种输出都带这一栏，解析带回来，app 写回（闭群、配角不写）
assert.match(eng, /const gSchedField = \(ctx\.memberSched && Object\.keys\(ctx\.memberSched\)\.length\)/);
assert.equal((eng.match(/gSchedField \+/g) || []).length, 2);
assert.match(eng, /schedNow: spk && b\.schedNow && typeof b\.schedNow === "object" \? b\.schedNow : null/);
assert.match(eng, /schedNow: x\.schedNow && typeof x\.schedNow === "object" \? x\.schedNow : null/);
assert.match(app, /if \(!gOffSealed && !_bNpc && a\.senderId && a\.schedNow && timeAwareFor\(a\.senderId\)\) applySchedChange\(a\.senderId, a\.schedNow\)/);
// 群语音也摘时间标记
assert.match(app, /(?:const|let) vt = stripEchoedMeta\(stripAiStamp\(item\.text\)\)/);
console.log("ok");
