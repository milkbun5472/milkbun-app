// 群友 2026-10-20：回复了朋友圈评论区里的配角（不是角色），只有发帖人接话——那人不在「可能回复的人」里
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
assert.match(app, /const _rtName = replyTo \? momentWho\(replyTo\) : "";\n    if \(_rtName && !roster\.includes\(_rtName\) && _rtName !== meName0 && \(mom\.comments \|\| \[\]\)\.some\(c => c && momentWho\(c\.author\) === _rtName\)\) roster = \[_rtName, \.\.\.roster\];/);
console.log("ok");
// 同日：「他好像只能接我说的那句，但我是在朋友圈聊着」——原档也能回评论区里的别人
{
  const a = app.indexOf("      const batchNames = reps.map"), b = app.indexOf("      reps.forEach((r, i) =>", a);
  const mk = (more, reps, inThreadNames, meName) => new Function("more", "reps", "inThreadNames", "meName", "momentWho", app.slice(a, b) + "; return prefixFor;")(more, reps, inThreadNames, meName, x => x ? String(x) : "");
  const reps = [{ author: "梁霄", replyTo: "Lisa", text: "a" }, { author: "周树生", replyTo: "梁霄", text: "b" }, { author: "路人", replyTo: "不存在", text: "c" }];
  const pf = mk(false, reps, ["梁霄", "周树生", "Lisa"], "Lisa");
  assert.equal(pf(reps[0], 0), "回复 Lisa：");
  assert.equal(pf(reps[1], 1), "回复 梁霄：");
  assert.equal(pf(reps[2], 2), "回复 Lisa：");
}

// 同日：「换一批能不能把我回复别人的也删了」
assert.match(app, /const kept = \(mom\.comments \|\| \[\]\)\.filter\([^\n]*!\/\^\\s\*回复/);
