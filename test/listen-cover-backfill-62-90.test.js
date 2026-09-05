// v62.90 她 2026-09-05：「歌词是灰的看不见，有没有办法 pull 网易云的时候把他的封面也一起拿过来」。
// 贴链接/ID 进来的歌只存了个 ID（addNeteaseSong），封面、歌名、歌手全空；搜索来的（resultToSong）和角色歌单才带。
// 所以：放这首歌 / 刚贴进来时顺手问一次 /song/detail，缺什么补什么，她自己填过的不动。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const LT = scr.slice(scr.indexOf("function ListenTogether("), scr.indexOf("function CoupleQAConfig("));

test("补封面那条路在，两处都接上了：播放时、刚贴进来时", () => {
  const i = app.indexOf("const backfillSongMeta = async song =>");
  assert.ok(i > 0, "没有 backfillSongMeta");
  const fn = app.slice(i, app.indexOf("const fetchLyrics = async song =>", i));
  assert.match(fn, /\/song\/detail\?ids=/, "没去问 song/detail");
  assert.match(fn, /if \(cover && !song\.cover\) patch\.cover = cover;/, "有封面的不该被盖掉");
  assert.match(fn, /if \(placeholder && it\.name\) patch\.title = it\.name;/, "她自己填的歌名不能被盖掉——只补「网易云歌曲 123」那种占位");
  assert.match(fn, /if \(artist && !song\.artist\) patch\.artist = artist;/);
  assert.match(fn, /metaTriedRef\.current\.has\(song\.id\)/, "没有「一首歌只问一次」的闸，每次播放都会再打一次接口");
  assert.match(fn, /patchSongEverywhere\(song\.id, patch\)/, "补回去要走 patchSongEverywhere，库里/歌单里/正在放的那份才会一起改");
  // 调用点：播放（跟抓歌词并排、不 await）、贴 ID 进来
  assert.match(app, /fetchLyrics\(song\);[^\n]*\n\s*backfillSongMeta\(song\);/, "播放时没顺手补");
  assert.match(app, /saveListen\(p => \(\{ \.\.\.p, songs: \[nsong, /, "addNeteaseSong 没把新歌拎出来");
  assert.match(app, /backfillSongMeta\(nsong\);/, "刚贴进来那一下没补");
  // 桩照写入方：resultToSong / discAdd 的封面字段都叫 cover，补的也得叫 cover
  assert.match(app, /const resultToSong = s => \(\{[^\n]*cover: s\.cover \|\| null/);
});

test("歌词页：没唱到的行是正文色不是雾色，底下不铺沟纹", () => {
  assert.match(LT, /color: i === lyricActive \? t\.ink : t\.sub, opacity: i === lyricActive \? 1 : \.82/, "没唱到的行还是 fog");
  assert.match(LT, /const discField = nav === "play" && !showLyric \? h\("div"/, "歌词页底下还铺着沟纹");
});
