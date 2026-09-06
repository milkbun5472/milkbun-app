// v62.61 审美审计（2026-09-04）：歌单是查手机里【唯一一个没穿自己皮】的内层 app。
// 「碟是合格的，但它躺在【她的】t.bg 上」——别的十八个 app 都有自己的底，就它没有。
//
// 改法是给它一间夜里的听歌房，但【不重写这个组件的结构】：
// 碟、曲目单、心境那一行本来就是合格的，动它们纯属把好东西改坏。
// 只把它取色的那个 t 换掉，再给它一层自己的外壳。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const SRC = fs.readFileSync("js/phone.js", "utf8");
const NOC = SRC.split("\n").map(l => l.split("//")[0]).join("\n");
// ⚠️两头都要从 NOC 上取。用 NOC 的起点配 SRC 的终点，偏移量对不上——
//   切出来的那一段既不是这个组件、也不完整（这一处刚绊过一次）。
//   终点也别拿注释当锚：注释在 NOC 里已经被抹掉了，找不到就退化成整份文件。
const MV = NOC.slice(NOC.indexOf("const MUSIC_SKIN = {"), NOC.indexOf("const PHONE_FORUM_SKINS = {"));

test("歌单有自己的皮，不再借她的主题色", () => {
  assert.match(NOC, /const MUSIC_SKIN = \{/);
  // 组件把 t 换成听歌房那套：prop 改名成 appT，函数体里的 t 指向 MUSIC_SKIN
  assert.match(NOC, /function MusicView\(\{ pl, char, t: appT,/);
  assert.match(NOC, /const t = MUSIC_SKIN;/);
});

test("底铺在最外那层外壳上，而且不跟着内容滚", () => {
  assert.match(MV, /const shell = \(kids, pad\) => h\("div", \{ className: "h-full min-h-0 flex flex-col"/);
  assert.match(MV, /background: MUSIC_SKIN\.bg/);
  assert.match(MV, /backgroundImage: "radial-gradient/);
  // ⚠️内容在动，那盏灯不该跟着动（mobile-ui-layout §3.5）
  assert.doesNotMatch(MV, /backgroundAttachment/);
  // 有歌和没歌两条路都得走这层壳——漏掉一条，空歌单还是白的
  assert.equal((MV.match(/return shell\(|shell\(h\("div", \{ className: "py-6" \}/g) || []).length, 2,
    "空态和有歌那两条路没都套上外壳");
});

test("自画外壳就得进 full-bleed 名单，否则外面那层通用顶栏还会压一条", () => {
  assert.match(NOC, /const FULL_BLEED_KEYS = \["music",/);
  // 自己画顶栏就得自己接返回
  assert.match(NOC, /onPeek: ctx\.onPeek, onBack: ctx\.onBack\n?\s*\}\);/);
  assert.match(MV, /h\(Head, \{ zh: "歌单"[\s\S]{0,120}onBack: onBack/);
});

test("眉标不留英文（no-english-titles）", () => {
  assert.doesNotMatch(MV, /"SIDE A"/);
  assert.match(MV, /eyebrow\("A 面"\)/);
  assert.doesNotMatch(MV, /'Archivo'/);
});
