const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

const art = new Function(
  engine.slice(engine.indexOf("function avatarSeedHash"), engine.indexOf("const AVATAR_POOL_KEY"))
  + "\nreturn { avatarArt, avatarSeedHash };")();

// 她 2026-08-25：「为啥别的小手机生成头像可以有真的像头像的图，我们只有 emoji 代替」。
// 参考的 jrsy-web：硬编码 190 条外链图片 + Math.random() 随机取一张。
// 两点都不抄——外链白嫖别人的图床随时会挂，Math.random 让同一个人每次刷新换张脸。

test("同一个人永远同一张，不同人不撞", () => {
  assert.equal(art.avatarArt("moyu_office"), art.avatarArt("moyu_office"), "刷一次换张脸就白做了");
  const seeds = ["yunnibobo", "zhaocai_luck", "apathy_null", "moyu_office", "raincheck", "little_planet_x"];
  assert.equal(new Set(seeds.map(art.avatarArt)).size, seeds.length);
});

test("程序化头像零请求、零外链，画的不是字母也不是 emoji", () => {
  const u = art.avatarArt("abc");
  assert.match(u, /^data:image\/svg\+xml/, "内联 data URI，不联网");
  const svg = decodeURIComponent(u.slice(u.indexOf(",") + 1));
  assert.match(svg, /linearGradient/);
  assert.match(svg, /<circle/);
  assert.doesNotMatch(svg, /<text/, "不许再摆首字母");
  assert.doesNotMatch(svg.replace('xmlns="http://www.w3.org/2000/svg"', ""), /https?:/,
    "一条真外链都不许有（参考那家硬编码了 13 个第三方图床）");
});

test("池子非空就优先用她自己的图，仍按哈希稳定分配", () => {
  const fn = engine.slice(engine.indexOf("function autoAvatarSrc"), engine.indexOf("function autoAvatarSrc") + 500);
  assert.match(fn, /pool\[avatarSeedHash\(seed\) % pool\.length\]/, "不许用 Math.random——那是参考那家的毛病");
  assert.doesNotMatch(engine.slice(engine.indexOf("function avatarSeedHash"), engine.indexOf("// 头像（她 2026-08-25")), /Math\.random/);
  assert.match(engine, /function avatarPoolSave\(list\)/);
  assert.match(engine, /\.slice\(0, 300\)/, "池子要有上限");
});

test("论坛不再画 emoji；小号要和大号不是同一张", () => {
  assert.equal(screens.indexOf("const FORUM_AV_EMOJI = ["), -1, "emoji 表要删掉，别留着当死代码");
  const npc = screens.slice(screens.indexOf("function NpcAvatar"), screens.indexOf("function Forum({"));
  assert.match(npc, /autoAvatarSrc\(seed\)/);
  assert.match(npc, /autoAvatarSrc\("alt:" \+ seed\)/, "小号加盐，否则一看头像就自曝身份");
});

test("没传头像的人不再是首字母方块；她自己设的 emoji 仍然优先", () => {
  const av = comp.slice(comp.indexOf("function Avatar({"), comp.indexOf("function Eyebrow({"));
  assert.match(av, /if \(character && character\.avatarEmoji\) return/, "她挑的 emoji 是她挑的，别覆盖");
  assert.match(av, /const seed = \(character && \(character\.id \|\| character\.handle \|\| character\.name\)\)/);
  assert.match(av, /autoAvatarSrc\(seed\)/);
});

test("头像池导入不花 API，也不把原图塞爆图库", () => {
  const cfg = screens.slice(screens.indexOf("function AvatarPoolConfig"), screens.indexOf("function ImageApiConfig"));
  assert.match(cfg, /multiple: true/, "一次能选几十张");
  assert.match(cfg, /resizeImageFile\(f, 256, 0\.86\)/, "头像最大显示 76px，存 256 见方足够");
  assert.match(cfg, /imgToVault/, "进图库只留 iv_ 键");
  assert.doesNotMatch(cfg, /generateSelfieImage|callAI/, "B 档不许花一分钱");
  assert.match(cfg, /确定清空？/, "两步确认，她按不动 confirm 弹窗");
});
