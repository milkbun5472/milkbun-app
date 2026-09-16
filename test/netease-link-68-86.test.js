// 她 2026-09-16 往「一起听 · 添加歌曲」里贴了一条，弹「没认出网易云歌曲链接或ID」。
//
// 查下来不是判错，是那条链接里【真的没有】歌曲 id：网易云 App 现在分享出来就是短链
// （163cn.tv/xxxx）。原来那三条正则只认 id=／/song/／裸数字，短链一条都对不上。
// 而且「没认出」这四个字对她没用——她得知道是哪一种认不出、下一步该干什么。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const pick = re => { const m = app.match(re); assert.ok(m, "找不到：" + re); return m[0]; };
const parse = new Function(pick(/function parseNeteaseId\(input\) \{[\s\S]*?\n\}/) + ";return parseNeteaseId;")();
const isShort = new Function(pick(/function isNeteaseShortLink\(input\) \{[\s\S]*?\n\}/) + ";return isNeteaseShortLink;")();
const sharedTitle = new Function(pick(/function neteaseSharedTitle\(input\) \{[\s\S]*?\n\}/) + ";return neteaseSharedTitle;")();

test("带 id 的几种形状都要认出来", () => {
  const want = "1901371647";
  for (const x of [
    "1901371647",
    " 1901371647 ",
    "https://music.163.com/#/song?id=1901371647",
    "https://music.163.com/song?id=1901371647&userid=999",
    "https://music.163.com/song/1901371647",
    "http://music.163.com/m/song/1901371647",
    "https://music.163.com/song/media/outer/id=1901371647.mp3",
    "id=1901371647"
  ]) assert.equal(parse(x), want, "没认出：" + x);
});

test("⚠️别把用户 id 当成歌曲 id 抠走", () => {
  // 一整段分享文案里常有 userid=／uid=。原来那条 /id=(\d{3,})/ 不卡前面那个字符，
  // 会把用户 id 抠出来当歌曲 id——加进去一首根本不存在的歌，而且看不出哪儿错了。
  assert.equal(parse("https://music.163.com/#/user/home?userid=12345678"), null);
  assert.equal(parse("来自 uid=8801234567 的分享"), null);
  assert.match(pick(/function parseNeteaseId[\s\S]*?\n\}/), /\(\?:\^\|\[\?&#\/\]\)id=/,
    "id= 前面不卡分隔符，用户 id 就会被当成歌曲 id");
});

test("短链认得出「是短链」——认不出 id 不代表说不清为什么", () => {
  assert.equal(parse("分享朴树的单曲《平凡之路》: http://163cn.tv/abcd (来自@网易云音乐)"), null,
    "短链里真的没有歌曲 id，硬抠出来才是错");
  assert.equal(isShort("http://163cn.tv/abcd"), true);
  assert.equal(isShort("https://u.163.com/xyz"), true);
  assert.equal(isShort("https://music.163.com/song?id=123456"), false);
  assert.equal(sharedTitle("分享朴树的单曲《平凡之路》: http://163cn.tv/abcd"), "平凡之路");
  assert.equal(sharedTitle("https://music.163.com/song?id=123456"), "");
});

test("说的是人话：哪一种认不出、下一步干什么", () => {
  const fn = pick(/  const addNeteaseSong = async \(input, title, artist\) => \{[\s\S]*?\n    const nsong/);
  // 短链：告诉她换哪一个复制，而不是让她对着「没认出」猜
  assert.match(fn, /这是网易云的短链接，里面没有歌曲 ID。在网易云里点歌曲右上角「分享 → 复制链接」/);
  // 认出了歌名 + 配了搜索接口 → 直接替她搜回来，别让她自己再找一遍
  assert.match(fn, /const named = neteaseSharedTitle\(raw\);/);
  assert.match(fn, /if \(named && musicReady\) \{/);
  assert.match(fn, /const hit = await neteaseSearchOne\(named \+ " " \+ String\(artist \|\| ""\)\.trim\(\)\);/);
  // 没配搜索接口就说清楚缺的是哪一样
  assert.match(fn, /只认出歌名《" \+ named \+ "》，但这儿还没配搜索接口/);
  // 搜出来的那一首照旧走同一条入库路，不另开一条
  assert.match(app, /if \(hit && hit\.id\) \{ nid = String\(hit\.id\); title = title \|\| hit\.name \|\| named; \}/);
});
