import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs"; import vm from "node:vm";
const src = readFileSync(new URL("../js/collage.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const scr = readFileSync(new URL("../js/screens.js", import.meta.url), "utf8");
const idx = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ctx = { console, React: { createElement() {} }, window: {} }; vm.createContext(ctx); vm.runInContext(src, ctx);
const C = ctx.window.Collage;
test("三种样式，一人一半格子和字都翻倍", () => {
  assert.deepEqual([...C.ORDER], ["polaroid", "scrap", "lock", "blank"]);
  for (const k of C.ORDER) assert.equal(C.TPL[k].slots.length, C.TPL[k].n);
  assert.equal(C.slotCount({ tpl: "scrap", split: true }), 10);
  assert.equal(C.wordCount({ tpl: "lock", split: true }), 4);
});
test("接进合照墙；TA 来摆一次调用、存下来挂墙/换锁屏/TA 下一轮知道", () => {
  assert.match(idx, /js\/collage\.js\?v=/);
  assert.match(scr, /"data-part": "collageopen"/);
  assert.match(scr, /onArrange: onCollageArrange \? \(list, tpl, split, hist\) => onCollageArrange\(partner\.id, list, tpl, split, hist\)/);
  assert.match(app, /const collageArrange = async \(charId, list, tpl, split, hist\)/);
  assert.match(app, /await setCharLockscreen\(charId, \{ key: hisKey/);
  assert.match(app, /waitForHer\(charId, \{ collageDone:/);
  assert.match(app, /gardenMineHint \+ collageHint \+ letterHint/);
});
test("自由度：背景、字体、贴纸都能换；按到谁认得出（贴纸在最上面）", () => {
  assert.ok(Object.keys(C.BGS).length >= 6 && Object.keys(C.FONTS).length >= 4 && C.STICKERS.length >= 12);
  assert.equal(C.defaultDeco("scrap", true).length, C.TPL.scrap.deco.length * 2);
  const boxes = [{ key: "s0", kind: "slot", x: 500, y: 500, w: 600, h: 600 }, { key: "d0", kind: "deco", x: 520, y: 520, w: 100, h: 100 }, { key: "w0", kind: "word", x: 510, y: 510, w: 300, h: 80 }];
  assert.equal(C.hitTest(boxes, 515, 515).key, "d0");
  assert.equal(C.hitTest(boxes, 300, 300).key, "s0");
  assert.equal(C.hitTest(boxes, 50, 50), null);
  assert.match(src, /touchAction: "none"/);
  assert.match(src, /position: "sticky"/);
});
test("自己放：空白样式、自己加的照片和字、格子能删、两指捏合", () => {
  assert.ok(C.ORDER.includes("blank") && C.TPL.blank.n === 0);
  const boxes = [{ key: "s0", kind: "slot", x: 500, y: 500, w: 600, h: 600 }, { key: "f0", kind: "fphoto", x: 500, y: 500, w: 400, h: 400 }, { key: "f1", kind: "ftext", x: 500, y: 500, w: 200, h: 80 }];
  assert.equal(C.hitTest(boxes, 500, 500).key, "f1");
  assert.equal(C.hitTest(boxes.slice(0, 2), 500, 500).key, "f0");
  assert.match(src, /if \(\(layout\.hidden \|\| \{\}\)\["s" \+ at\]\) return;/);
  assert.match(src, /const pinchOf = \(\) =>/);
  assert.match(src, /slider\("大小"/); assert.match(src, /slider\("角度"/);
});
test("底：花纹照旧、颜色自己挑；自己传的底存在图库里按前缀列出来", () => {
  assert.match(src, /const MY_BG = "img_collagebg_"/);
  assert.match(src, /base = \(layout && layout\.bgColor\) \|\| b\.base \|\| b\.from, ink = \(layout && layout\.bgInk\) \|\| inkOf\(b\)/);
  assert.match(src, /idbImgKeys\(\)/);
  assert.match(src, /type: "color"/);
  assert.match(src, /"data-part": "collagemybg"/);
});
test("贴纸能传自己的图（PNG 留透明）；粉格绿格换成条纹、小爱心、牛皮纸", () => {
  assert.ok(!("pinkPlaid" in C.BGS) && !("sagePlaid" in C.BGS));
  for (const k of ["plaid", "stripes", "hearts", "kraft"]) assert.ok(C.BGS[k], k);
  assert.match(src, /const MY_STK = "img_collagestk_"/);
  assert.match(src, /c\.toBlob\(b => ok\(b\), "image\/png"\)/);
  assert.match(src, /"data-part": "collagemystk"/);
});
test("让TA参与：看现在这张（带图）、挑几样里的一个；runProbe 能带图，不认图的线路退回纯文字", () => {
  const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
  assert.match(eng, /imageDataUrls: _imgs/);
  assert.match(eng, /if \(_imgs\.length && !tooBig\(e\) && !\(e && e\.name === "AbortError"\)\) \{ _imgs\.length = 0;/);
  assert.match(app, /const collageLook = async \(charId, img, desc, hist\)/);
  assert.match(app, /const collageChoose = async \(charId, kind, imgs, labels, hist\)/);
  assert.match(src, /const applyHis = \(res, base\) =>/);
  assert.match(src, /function ChoosePage\(/);
  assert.match(scr, /onLook: onCollageLook \?/);
});
test("这一回的来回：前后两版比出谁改了啥，叫TA时带上，存下来带去聊天", () => {
  assert.match(src, /function changesOf\(a, b, nameOfPhoto, nameOfDeco\)/);
  assert.match(src, /const lastSeen = useRef\(layout\);/);
  assert.match(app, /const collageLook = async \(charId, img, desc, hist\)/);
  assert.match(app, /const collageChoose = async \(charId, kind, imgs, labels, hist\)/);
  assert.match(app, /const collageArrange = async \(charId, list, tpl, split, hist\)/);
  assert.match(app, /拼的时候你们俩是这么来回的/);
});
test("TA 说的话不限字数：提示里不写「一句」，代码不截断；人设和去人机味走 voice 那一套", () => {
  const seg = app.slice(app.indexOf("const collageArrange = async"), app.indexOf("const gardenPlantMine = "));
  assert.doesNotMatch(seg, /说一句|"一句"|why: String\(\(d && d\.why\) \|\| ""\)\.trim\(\)\.slice/);
  assert.equal((seg.match(/voice: true/g) || []).length, 4);
});
test("装饰：胶带涂鸦、照片滤镜（逐像素，不靠 ctx.filter）、字的样式；TA 也能用", () => {
  assert.deepEqual(Object.keys(C.FILTERS), ["", "bw", "vintage", "film", "soft"]);
  assert.ok(Object.keys(C.SHAPES).length >= 7 && Object.keys(C.TSTYLES).length >= 5);
  assert.doesNotMatch(src, /ctx\.filter\s*=/);
  assert.match(src, /getImageData\(0, 0, c\.width, c\.height\)/);
  assert.match(app, /\\"filter\\":\\"\\",\\"style\\":\\"\\",\\"color\\":\\"\\"/);
});
test("TA 先拼一张；TA 自己的东西（手机里存的、抽屉里画的）也能上壁纸", () => {
  assert.match(src, /const draft = async \(\) =>/);
  assert.match(src, /"data-part": "collagedraft"/);
  assert.match(src, /if \(a\.photo != null && list\[/);
  assert.match(app, /const collageDraft = async \(charId, catalog, hist\)/);
  assert.match(app, /const collageHisThings = charId =>/);
  assert.match(app, /x\.kind === "draw" && x\.svg/);
  assert.match(scr, /extra: collageHisThings \? collageHisThings\(partner\.id\) : \[\]/);
});
