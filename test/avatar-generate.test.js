const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

const build = new Function(
  (() => { const i = engine.indexOf("function buildAvatarPrompt");
    let d = 0, j = i; for (; j < engine.length; j++) { if (engine[j] === "{") d++; else if (engine[j] === "}") { d--; if (!d) { j++; break; } } }
    return engine.slice(i, j); })() + "\nreturn buildAvatarPrompt;")();

// 图像 API 早就在跑自拍/合照/剧照了，只是从来没接过【头像】这个字段。
// 头像和自拍是两种东西：自拍要一臂距离的前置摄像头透视，头像要正经头肩像。
test("头像 prompt 要的是头肩像，不是自拍", () => {
  const p = build({ name: "陆闻", appearance: "三十出头，清瘦" }, { hasRef: false });
  assert.match(p, /这是头像，不是自拍/);
  assert.match(p, /脸占画面大半/);
  assert.match(p, /不要一臂距离的自拍透视、不要手机入镜、不要全身/);
  assert.match(p, /正方形构图/);
  assert.match(p, /缩到很小也还认得出是谁/, "40px 下认不出就白做");
});

test("有参考照就锁脸，但机位仍按头像这个用途重定", () => {
  const p = build({ name: "陆闻", appearance: "眼下有痣" }, { hasRef: true });
  assert.match(p, /就是参考图里那个人/);
  assert.match(p, /与参考图冲突时一律以参考图为准/, "外貌描述不能盖过真脸");
  // 和 buildPhotoPrompt 那条同款：参考图只决定是谁，角度不许照抄
  assert.match(p, /参考图只决定【这是谁】/);
  assert.match(p, /不许沿用参考图里的角度/);
});

test("没参考照时按【外貌】那栏画，二次元角色不画成真人", () => {
  const real = build({ name: "A", appearance: "短发" }, { hasRef: false });
  assert.match(real, /真实照片质感/);
  const anime = build({ name: "B", appearance: "短发", photoStyle: "anime" }, { hasRef: false });
  assert.match(anime, /二次元动画插画风格/);
  assert.doesNotMatch(anime, /真实皮肤纹理/);
});

test("按钮接上了，而且方图、两样都没有时不让她白花钱", () => {
  assert.match(comp, /genBusy \? "生成中…" : \(character && character\.avatarImage \? "重新生成" : "生成头像"\)/);
  assert.match(screens, /先填【外貌】那一栏，或者传一张参考照，不然它不知道该画谁/);
  assert.match(app, /buildAvatarPrompt\(c, \{ hasRef: !!draft\.refPhoto \}\)/);
  assert.match(app, /\{ size: "1024x1024" \}/, "头像要方图，不是 1024x1536");
  assert.match(app, /imgToVault\(dataUrl\)/, "存图库只留一个 iv_ 键，别把 base64 塞进 localStorage");
  assert.match(app, /记得点右上角保存/, "生成完还没保存，得说清楚");
});
