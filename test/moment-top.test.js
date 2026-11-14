const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("朋友圈置顶：只在个人主页排最前，首页刷的那一列只按时间（她 2026-11-02）", () => {
  assert.doesNotMatch(c, /momTopFirst/, "首页不再把置顶提前");
  assert.match(c, /\(moments \|\| \[\]\)\.filter\(m => !m \|\| m\.mine \|\| !momMutedIds\(\)[\s\S]{0,600}?\.map\(m =>/);
  // 个人主页（我的、TA 的）：置顶在前，其余按时间
  assert.match(c, /\.sort\(\(a, b\) => \(b\.top \? 1 : 0\) - \(a\.top \? 1 : 0\) \|\| \(b\.ts \|\| 0\) - \(a\.ts \|\| 0\)\)/);
  assert.match(c, /onTop: onTop && isMine \? \(\) => onTop\(m\.id\) : null/);
  assert.match(c, /"data-wk": "momtop", "data-on": m\.top/);
  assert.match(app, /const topMoment = id => pMom\(p => p\.map\(m => m\.id === id \? \{ \.\.\.m, top: !m\.top \} : m\)\);/);
  assert.equal((app.match(/onTopMoment: topMoment,/g) || []).length, 2);
});
