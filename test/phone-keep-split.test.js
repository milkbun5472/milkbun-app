const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

// 群友 2026-10-06：「为什么我收藏的照片都没有了，我没有换设备呀」——
// 相册收藏和动态「收着」共用 x_phoneKeep，动态那颗一按就把照片数组摊成对象、相册读成 0 张。
function load(store) {
  const i = src.indexOf("function phoneKeptPhotos("), j = src.indexOf("function AlbumView(", i);
  assert.ok(i > 0 && j > i, "抠不出那三支");
  const loadJSON = (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d);
  const saveJSON = (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); };
  return new Function("loadJSON", "saveJSON", src.slice(i, j) + "\nreturn { phoneKeptPhotos, phoneTlKeepLoad, phoneKeepLoad };")(loadJSON, saveJSON);
}

test("被摊开的照片认回来，动态那几条拆去自己的键", () => {
  const p1 = { id: "a", caption: "海边" }, p2 = { id: "b", caption: "猫" };
  // 动态那颗按下去之后的样子：{ ...[p1,p2], 条目id: 1 }
  const store = { x_phoneKeep: { c1: { 0: p1, 1: p2, "tl_xyz": 1 }, c2: [p2] } };
  const K = load(store);
  const keep = K.phoneKeepLoad();
  assert.deepEqual(keep.c1.map(x => x.caption), ["海边", "猫"], "照片没认回来");
  assert.deepEqual(keep.c2.map(x => x.caption), ["猫"]);
  assert.ok(Array.isArray(store.x_phoneKeep.c1), "修好的要写回成数组");
  assert.deepEqual(store.x_phoneTlKeep, { c1: { tl_xyz: 1 } }, "动态那条没拆出去");
});

test("拆过一次就不再从老键里拆", () => {
  const store = { x_phoneTlKeep: { c1: { mine: 1 } }, x_phoneKeep: { c1: { other: 1 } } };
  const K = load(store);
  assert.deepEqual(K.phoneTlKeepLoad(), { c1: { mine: 1 } });
});

test("动态那颗只写 x_phoneTlKeep，相册收藏只写 x_phoneKeep", () => {
  const i = src.indexOf("const toggleKeep = id => setKept(");
  const seg = src.slice(i, src.indexOf("});", i));
  assert.match(seg, /saveJSON\("x_phoneTlKeep", n\)/);
  assert.doesNotMatch(seg, /x_phoneKeep"/);
  assert.match(src, /const \[kept, setKept\] = useState\(\(\) => phoneTlKeepLoad\(\)\);/);
  assert.match(src, /const \[keep, setKeep\] = useState\(\(\) => phoneKeepLoad\(\)\);/);
});
