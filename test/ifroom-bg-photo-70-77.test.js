// 她 2026-09-18：「情侣空间的另一个我们 拍张我俩完成后只在合照显示，
//   能不能搞成另一个我们的背景也能用合照」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// 把 ifBgFromPhoto 抠出来真跑：光 grep「函数在」挡不住「它其实没写进去」
const runPick = (lines, lineId, photo) => {
  const i = app.indexOf("  const ifBgFromPhoto = (lineId, photo) => {");
  assert.ok(i > 0, "没有这个动作");
  const src = app.slice(i, app.indexOf("\n  };", i) + 5);
  let saved = null;
  const ctx = { ifLinesRef: { current: lines }, ifSave: n => { saved = n; } };
  vm.createContext(ctx);
  vm.runInContext(src + "\nthis.__r = ifBgFromPhoto(" + JSON.stringify(lineId) + ", " + JSON.stringify(photo) + ");", ctx);
  return { ok: ctx.__r, lines: saved };
};
// 桩照【写这份存档的那段】写：ifBg 落的是 { ...x, bgKey, bgUrl }（stub-from-the-writer.md）
const L = () => [
  { id: "l1", title: "如果那年没走", charId: "c1", bgKey: "img_if_l1", bgUrl: null, beats: [] },
  { id: "l2", title: "另一条", charId: "c1", beats: [] }
];

test("挑一张合照，就换成这条线的底", () => {
  const r = runPick(L(), "l1", { imgKey: "img_studio_c1_123", imgUrl: null, src: "studio" });
  assert.equal(r.ok, true);
  assert.equal(r.lines[0].bgKey, "img_studio_c1_123");
  assert.equal(r.lines[0].bgUrl, null);
  assert.equal(r.lines[1].bgKey, undefined, "串到别的线上了");
});

test("只有网址没有本地图的那种也认（老数据、云端图）", () => {
  const r = runPick(L(), "l2", { imgKey: null, imgUrl: "https://x/y.png" });
  assert.equal(r.lines[1].bgUrl, "https://x/y.png");
  assert.equal(r.lines[1].bgKey, null);
});

test("空的什么都不做——别把背景清成一片黑", () => {
  [null, {}, { imgKey: "", imgUrl: "" }].forEach(p => {
    const r = runPick(L(), "l1", p);
    assert.equal(r.ok, false);
    assert.equal(r.lines, null, "没图也照写了一次存档");
  });
  assert.equal(runPick(L(), "", { imgKey: "a" }).ok, false);
});

// ⚠️指的是同一张图，不是复制一份：删照片那一路才管得到它
test("背景指向照片自己的 imgKey，不另存一份", () => {
  const i = app.indexOf("  const ifBgFromPhoto = (lineId, photo) => {");
  const seg = app.slice(i, app.indexOf("\n  };", i));
  assert.ok(!/idbImgPut/.test(seg), "又把图复制了一份，删照片就删不干净了");
  assert.match(seg, /bgKey: photo\.imgKey \|\| null, bgUrl: photo\.imgUrl \|\| null/);
});

test("拍完就能在这一页看见，不再只躺在合照里", () => {
  const i = app.indexOf("const ifShot = async lineId =>");
  const body = app.slice(i, app.indexOf("// 收线。三个去处", i));
  assert.match(body, /if \(row && \(row\.imgKey \|\| row\.imgUrl\)\) ifBgFromPhoto\(lineId, row\);/);
});

test("界面：挑照片那一层接上了，而且没合照就不摆那颗按钮", () => {
  assert.match(scr, /photos: duoPhotosFor \? duoPhotosFor\(partner\.id\) : \[\], onBgPick: onIfBgPick,/, "名单没传进去");
  assert.match(app, /onIfBgPick: ifBgFromPhoto,/, "没接上");
  assert.match(scr, /\(photos \|\| \[\]\)\.length \? h\("button", \{ onClick: \(\) => setPick\(true\)/, "没合照时那颗按钮还在，点开是一片空");
  assert.match(scr, /onClick: \(\) => \{ onBgPick && onBgPick\(line\.id, x\); setPick\(false\); \}/);
  // 名单只有一份：相册页和这一页问的是同一个 duoPhotosFor（它已经把聊天/线下/
  // 照相馆/情侣空间四处合流），谁都不在自己那儿另攒一个列表。
  const room = scr.slice(scr.indexOf("function IfRoom({"), scr.indexOf("function IfRoom({") + 9000);
  // ⚠️只找【攒照片】的写法，别连筛剧情线的 .filter(x => x.charId === partner.id) 一起逮
  assert.ok(!/studioShots|coupleShots|duoPhotosFor|imgKey.*?\.map\(/.test(room), "这一页自己又攒了一份照片名单");
  // 现在用着的那张要标出来，不然点了半天不知道换没换
  assert.match(scr, /x\.imgKey === line\.bgKey/);
});
