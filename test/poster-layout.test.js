// 她 2026-10-13：电影海报/杂志封面的字「随便贴上去」——先定构图再出图，出图后在构图里排候选、打分挑一张
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = R("js/poster-layout.js"), app = R("js/app.js"), eng = R("js/engine.js"), idx = R("index.html");
const win = {}; new Function("window", src)(win);
const PL = win.PosterLayout;

test("出图前定构图：类型决定字的性格，长片名不进竖排", () => {
  const p = PL.plan("movie", { title: "极高依恋度", genre: "悬疑" }, () => 0);
  assert.equal(p.persona, "sharp");
  assert.ok(PL.MOVIE_COMPS.includes(p.comp));
  for (let i = 0; i < 20; i++) {
    const q = PL.plan("movie", { title: "一二三四五六七八九", persona: "retro" }, () => i / 20);
    assert.ok(q.comp !== "rightColumn" && q.comp !== "diagonal", "长片名排进了竖排/对角");
  }
  assert.equal(PL.plan("movie", { title: "我们", persona: "playful" }, () => 0).persona, "playful", "模型给了性格就照它");
  assert.ok(PL.MAG_COMPS.includes(PL.plan("magazine", { persona: "heavy" }, () => 0).comp));
});

test("留白写进生图提示词：写画面不写坐标，类型带着光影", () => {
  const line = PL.spaceLine(PL.plan("movie", { title: "我们", genre: "恐怖", mood: "压抑" }, () => 0));
  assert.match(line, /排字留白/); assert.match(line, /恐怖/);
  assert.doesNotMatch(line, /\d+px|坐标/);
  assert.match(eng, /opts\.editorialSpace \|\|/);
  assert.match(app, /editorialSpace: \(?coverPlan \? window\.PosterLayout\.spaceLine\(coverPlan\)/);
});

test("先写字再出图（字的方向要在出图前定），出图后照同一份 plan 排", () => {
  const a = app.indexOf("coverPlan = window.PosterLayout.plan("), b = app.indexOf("const prompt = RESTYLE_ONLY ||");
  assert.ok(a > 0 && b > a);
  assert.match(app, /studioOverlay\(out\.blob, coverPlan, cover \|\| \{\}/);
  assert.match(app, /titleLines＝/); assert.match(app, /genre＝类型/);
  assert.doesNotMatch(app, /浪漫上映/, "不再写死成爱情片");
});

test("片名断行：照模型给的；拼不回片名就自己从中间断", () => {
  assert.deepEqual(PL._t.titleLines({ titleLines: ["极高", "依恋度"] }, "极高依恋度"), ["极高", "依恋度"]);
  assert.deepEqual(PL._t.titleLines({ titleLines: ["乱写"] }, "极高依恋度"), ["极高依", "恋度"]);
  assert.deepEqual(PL._t.titleLines({}, "我们"), ["我们"]);
});

test("打分：撞在一起、出界的会被筛掉；定好的构图优先", () => {
  const look = () => ({ mean: 0.1, busy: 0.02 });
  const ok = [{ x: 100, y: 100, w: 200, h: 50, g: "t", title: true, dark: true }, { x: 100, y: 300, w: 200, h: 20, g: "d", dark: true }];
  const hit = [{ x: 100, y: 100, w: 200, h: 50, g: "t", title: true, dark: true }, { x: 120, y: 110, w: 200, h: 20, g: "d", dark: true }];
  const out = [{ x: -20, y: 100, w: 200, h: 50, g: "t", title: true, dark: true }];
  assert.ok(PL._t.score(ok, 1000, 1500, look, false) > PL._t.score(hit, 1000, 1500, look, false));
  assert.ok(PL._t.score(ok, 1000, 1500, look, false) > PL._t.score(out, 1000, 1500, look, false));
  assert.ok(PL._t.score(ok, 1000, 1500, look, true) > PL._t.score(ok, 1000, 1500, look, false));
});

test("字体只用已有的几款、按字取子集；脚本挂进了首页", () => {
  assert.match(src, /&text=" \+ encodeURIComponent\(chars\)/);
  assert.doesNotMatch(src, /\.woff2?|\.ttf|\.otf/);
  assert.match(idx, /<script src="js\/poster-layout\.js\?v=/);
  assert.ok(idx.indexOf("poster-layout.js") < idx.indexOf("js/app.js?v="));
});

test("字的颜色跟着图走：主色从图里取，深浅照字底下那块定", () => {
  assert.match(src, /function paletteOf\(x, W, H\)/);
  assert.match(src, /PAL = paletteOf\(x, W, H\)/);
  assert.match(src, /role === "accent"/);
  assert.doesNotMatch(src, /\["#ffd36b", "#ff9db8", "#9fe3ff", "#ff5a4e"\]/, "强调色不再随机掷");
});

test("认得出脸：肤色＋头发那一截压上字要重罚，小字会挪开；别的构图每种结构都排", () => {
  assert.match(src, /cr >= 140 && cr <= 175/);
  assert.match(src, /s -= \(st\.skin \|\| 0\) \* \(b\.title \? 160 : 110\)/);
  assert.match(src, /const slide = b0 =>/);
  assert.match(src, /MOVIE\[k\]\.titles\.forEach\(v => cands\.push/);
});

test("四格漫画：台词进气泡（不写名字），老数据「名字：话」也认；先挑真漫画/照片漫画", () => {
  const n = PL._t.normPanel;
  assert.deepEqual(n({ line: "Lisa：你拍的这张很搞笑吗？" }, ["裴照川", "Lisa"]).bubbles[0], { who: "me", text: "你拍的这张很搞笑吗？", shout: false });
  assert.equal(n({ line: "裴照川：发就发！" }, ["裴照川", "Lisa"]).bubbles[0].who, "ta");
  assert.equal(n({ bubbles: [{ who: "x", text: "嗯" }], sfx: "砰砰砰砰砰" }, []).sfx, "砰砰砰砰");
  assert.match(app, /window\.PosterLayout\.comic\(blob, panels, names \|\| \[\]\)/);
  assert.match(app, /bubbles＝这一格的对话气泡/);
  assert.match(app, /opt\.comicStyle === "photo"/);
  assert.match(R("js/components.js"), /\[\["draw", "真漫画"\], \["photo", "照片漫画"\]\]/);
});

test("姿势机位不写死：他写 shot 就照他的，没写掷轴；提示词里不再列姿势例子", () => {
  assert.equal(PL.plan("movie", { title: "我们", shot: "他坐在台阶上回头看她" }, () => 0).shot, "他坐在台阶上回头看她");
  const auto = PL.plan("movie", { title: "我们" }, () => 0.5).shot;
  assert.match(auto, /景别.*镜头.*两个人/);
  assert.match(PL.spaceLine(PL.plan("movie", { title: "我们", shot: "侧脸对视" }, () => 0)), /【这一张怎么拍】侧脸对视/);
  assert.doesNotMatch(eng, /背靠背、一前一后/);
  assert.match(app, /shot＝这一张怎么拍/);
});
