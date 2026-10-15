// 她 2026-10-14：「他们互相不认识，理论上都是我男朋友」——楼下每个人都把楼主帖里的「某人」当成共同认识的那一个
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
test("回帖的角色手里那段私事旁边，说清楚别人帖里的人 TA 不认识", () => {
  const i = app.indexOf("const forumCharGrounding = ");
  const seg = app.slice(i, app.indexOf("const forumCommentProbe = ", i));
  assert.match(seg, /别人帖子或楼里说到的那个「她／对象／某个人」/);
  assert.match(seg, /关系网里本来就认识的除外/, "真认识的人照旧能认");
});
