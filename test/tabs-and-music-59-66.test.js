const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadPhone } = require("./helpers/phone-render.js");
const root = path.join(__dirname, "..");
const ph = fs.readFileSync(path.join(root, "js", "phone.js"), "utf8");
const tl = ph.slice(ph.indexOf("function TimelineView("), ph.indexOf("// 锁屏：拿起他手机的第一眼"));
const bar = tl.slice(tl.indexOf("两格＝这条轴的两头"), tl.indexOf("// 只看新增"));
const mv = ph.slice(ph.indexOf("function MusicView("), ph.indexOf("function renderPhoneModule("));

// 她 2026-09-01：「把时间线的也弄了吧」→ 施工规则/tabs-not-plain-pills.md
// v59.60 只改了一半：位置有意义了，形状还是两颗药丸。
test("时间线那两格不再是药丸，它们就是那半条轴", () => {
  assert.ok(bar.indexOf("borderRadius: 99") < 0, "还是药丸");
  assert.ok(bar.indexOf("padding: \"5px 13px\"") < 0, "还是一颗填色的按钮");
  // 每一格＝标签 + 一段轨；轨从标签铺到中间那个「现在」
  assert.match(bar, /k === "past" \? \[cap, txt, rail\] : \[rail, txt, cap\]/,
    "两格没有做成镜像的一段轴——走过的在左、还没走的在右");
  assert.match(bar, /flex: "1 1 0", minWidth: 8/, "轨没有铺满那一格");
});

test("选中的那半加粗上墨、外头钉一根端点", () => {
  assert.match(bar, /height: on \? 2 : 1/, "走过的那半选中时没加粗");
  assert.match(bar, /\(on \? 2 : 1\) \+ "px dashed "/, "还没走的那半选中时没加粗");
  assert.match(bar, /background: on \? t\.ink : t\.line/, "选中的那半没上墨");
  assert.match(bar, /height: on \? 11 : 0, borderRadius: 2, background: t\.ink/, "选中那半外头没钉端点");
  assert.match(bar, /fontSize: on \? 12\.5 : 11\.5/, "选中和没选中的标签一样大");
});

test("走过的实线、还没走的虚线这套话没被改掉", () => {
  assert.match(bar, /background: on \? t\.ink : t\.line \}\s*:/, "走过的那半不是实线");
  assert.match(bar, /px dashed " \+ \(on \? t\.ink : t\.line\)/, "还没走的那半不是虚线");
  // 下面每一条的竖轴说的是同一套话
  assert.match(tl, /borderLeft: r\.ahead \? "1px dashed " \+ t\.line : "none"/, "每一条的竖轴不再跟着这套话走");
});

test("轨只有一两像素高，可点区域得自己撑起来", () => {
  assert.match(bar, /minHeight: 42/, "可点区域低于 40px 的手感");
  assert.match(bar, /"aria-pressed": on \? "true" : "false"/, "读屏读不出哪一格是开着的");
});

// 她 2026-09-01：「歌单 ui 现在也还是普普通通的也弄好一点」
test("歌单是一张碟的曲目单，不是一排小方图", () => {
  assert.ok(mv.length > 500, "MusicView 没抽出来");
  // 那排 34px 的灰方块正是「哪个音乐 app 都有」的那一样东西
  assert.ok(mv.indexOf("width: 34, height: 34") < 0, "每行还挂着一张小方图");
  assert.match(mv, /repeating-radial-gradient\(circle at 50% 50%/, "碟没有纹路——那就只是个圆");
  assert.match(mv, /width: 6, height: 6, borderRadius: 999, background: t\.bg/, "碟中间没有那个孔");
  // v62.61 眉标去英文（no-english-titles）：唱片上「A 面」本来就是中文的说法，
  // 不是硬翻出来的。面这件事本身要还在。
  assert.match(mv, /eyebrow\("A 面"\)/, "没有面");
  // 号要挂在左边、看得见：原来是 11px 的灰数字，等于没有
  assert.match(mv, /fontSize: 16, lineHeight: 1\.25, color: on \? t\.ink : t\.fog/, "曲目号还是一串看不见的小灰字");
});

test("他为什么循环这一首是正文，不是灰色附注", () => {
  assert.match(mv, /color: t\.accent, marginTop: 7,/, "心境还是灰色小字");
  const tree = JSON.stringify(loadPhone().MusicView({
    pl: { name: "某张", songs: [{ id: "a", title: "某首", artist: "某人", note: "他为什么听它" }] },
    char: { name: "某人" }, t: {}, onGen: () => {}, busy: false, onPlay: () => {}, onPeek: () => {}
  }));
  assert.ok(tree.includes("他为什么听它"), "心境没印出来");
  assert.ok(tree.includes("1 首"), "没说这张有几首");
  // 歌单名顶栏已经写着了，碟边上不再抄一遍
  assert.equal((tree.match(/某张/g) || []).length, 0, "歌单名在页面里又抄了一遍");
});

test("点开就在原地摊开，不掀半窗", () => {
  // 施工规则/no-half-sheet.md：改到哪一处，哪一处顺手换掉
  assert.ok(mv.indexOf("setSheet") < 0, "还在掀半窗");
  assert.match(mv, /"aria-expanded": on \? "true" : "false"/, "读屏读不出这一首是摊开的");
  const open = JSON.stringify(loadPhone({ 0: "a" }).MusicView({
    pl: { name: "某张", songs: [{ id: "a", title: "某首", artist: "某人", note: "他为什么听它" }] },
    char: { name: "某人" }, t: {}, onGen: () => {}, busy: false, onPlay: () => {}, onPeek: () => {}
  }));
  assert.ok(open.includes("放这首"), "摊开之后没有「放这首」");
  assert.ok(open.includes("提这首"), "摊开之后没有转发");
  const shut = JSON.stringify(loadPhone().MusicView({
    pl: { name: "某张", songs: [{ id: "a", title: "某首", artist: "某人", note: "n" }] },
    char: { name: "某人" }, t: {}, onGen: () => {}, busy: false, onPlay: () => {}, onPeek: () => {}
  }));
  assert.ok(!shut.includes("放这首"), "没点开就把动作摆出来了");
});

test("歌单空着、脏数据都不炸", () => {
  const mk = pl => JSON.stringify(loadPhone().MusicView({
    pl, char: { name: "某人" }, t: {}, onGen: () => {}, busy: false, onPlay: () => {}, onPeek: () => {}
  }));
  [null, undefined, {}, { songs: null }, { songs: "不是数组" }, { songs: [null, 3] },
   { songs: [{ title: {} , artist: [], note: {} }] }].forEach((pl, i) => {
    let out;
    assert.doesNotThrow(() => { out = mk(pl); }, "脏数据 " + i + " 炸了");
    assert.ok(out.indexOf("[object") < 0, "脏数据 " + i + " 把 [object Object] 印出来了");
  });
  assert.ok(mk({ songs: [] }).includes("给他生成一张"), "没歌单时没给生成入口");
});
