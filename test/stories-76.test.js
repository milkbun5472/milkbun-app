const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
test("版面：模型给的 0~1 位置换成拼壁纸画布的坐标，越界的夹住", () => {
  global.window = { Collage: { BGS: { cream: {}, night: {} } } };
  global.loadJSON = () => []; global.saveJSON = () => true;
  new Function(R("stories.js"))();
  const L = window.Stories.layoutFrom({ bg: "night", font: "serif", texts: [{ t: "下雨了", x: 0.5, y: 2, size: 999, color: "#fff" }], stickers: [{ ch: "☔", x: 0.1, y: 0.1, size: 100 }] }, true);
  assert.equal(L.tpl, "blank"); assert.equal(L.bg, "night");
  assert.equal(L.free[0].type, "photo"); assert.equal(L.free[1].text, "下雨了");
  assert.ok(L.free[1].y <= 2340 * 0.95 && L.free[1].size <= 180);
  assert.equal(L.deco[0].ch, "☔");
  assert.equal(window.Stories.layoutFrom({ bg: "nope" }, false).bg, "cream");
});
test("接线：聊天回复里的 story、开关跟着朋友圈、TA 看得到她的动态、聊天列表头像框、朋友圈主页过往", () => {
  const A = R("app.js"), C = R("components.js"), E = R("engine.js"), I = fs.readFileSync(__dirname + "/../index.html", "utf8");
  assert.match(A, /const storyOnFor = id => \{ const s = settingsFor\(id\) \|\| \{\}; return s\.autoStory != null \? !!s\.autoStory : !!s\.autoMoment; \};/);
  assert.match(A, /story:string=顺手发一条限时动态/); assert.match(A, /if \(_st\) storyMake\(char, _st\);/);
  assert.match(A, /storyLine: \(\(\) => \{/); assert.match(E, /if \(!ctx\.notRoleplay && ctx\.storyLine\) parts\.push\(ctx\.storyLine\);/);
  assert.match(A, /onStoryReply: \(st, tx\) => \{/);
  assert.match(C, /storyRing\(c\.id, h\(Avatar/); assert.match(C, /startTpl: "blank"/); assert.match(C, /h\(window\.Stories\.StoryArchive/);
  assert.match(C, /settings\.autoStory != null \? !!settings\.autoStory : !!settings\.autoMoment/);
  assert.match(I, /<script src="js\/stories\.js\?v=/);
});
