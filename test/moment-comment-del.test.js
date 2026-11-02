// 群友 2026-11-02：朋友圈可以删 char 的评论。长按评论→确认→按序号删掉这一条。
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8"), cmp = fs.readFileSync("js/components.js", "utf8");
test("删的是这条朋友圈里那一条评论，别的不动", () => {
  const line = app.match(/const delMomentComment = [^\n]+/)[0];
  const pMomBox = { v: [{ id: "a", comments: [{ t: 1 }, { t: 2 }, { t: 3 }] }, { id: "b", comments: [{ t: 9 }] }] };
  const pMom = f => { pMomBox.v = f(pMomBox.v); };
  new Function("pMom", line + ";delMomentComment('a',1);")(pMom);
  assert.deepEqual(pMomBox.v[0].comments.map(c => c.t), [1, 3]);
  assert.deepEqual(pMomBox.v[1].comments.map(c => c.t), [9]);
});
test("两处朋友圈都接上，评论那一格能长按", () => {
  assert.equal((app.match(/onDelMomentComment: delMomentComment,/g) || []).length, 2);
  assert.match(cmp, /onDelComment: onDelMomentComment,/);
  assert.match(cmp, /onTouchStart: \(\) => cmDown\(m\.id, i\)/);
  assert.match(cmp, /title: "删掉这条评论？"/);
});
