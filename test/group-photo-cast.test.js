const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 取出 buildPhotoPrompt 单独跑，验行为不验措辞
const grabFn = (src, name) => {
  const i = src.indexOf("function " + name + "(");
  let d = 0, j = src.indexOf("{", i), started = false;
  for (; j < src.length; j++) {
    if (src[j] === "{") { d++; started = true; }
    else if (src[j] === "}") { d--; if (started && !d) { j++; break; } }
  }
  return src.slice(i, j);
};
const build = new Function(
  "function freshPhotoWearing(){return '';}" +
  grabFn(engine, "buildPhotoPrompt") + "\nreturn buildPhotoPrompt;")();

const 朝 = { name: "顾朝", appearance: "白发红瞳" };
const 暮 = { name: "顾暮", appearance: "黑发" };
const cast3 = [{ name: "顾朝", appearance: "白发红瞳" }, { name: "顾暮", appearance: "黑发" }, { name: "Lisa", appearance: "戴眼镜" }];

test("三个人：人数、点名、参考图映射都要写死", () => {
  const p = build(朝, "在客厅沙发上", null, { kind: "duo", me: { name: "Lisa" }, cast: cast3 });
  assert.match(p, /有 3 个人同框/);
  ["顾朝", "顾暮", "Lisa"].forEach(n => assert.ok(p.includes("「" + n + "」"), n + " 要点名"));
  // 谁是第几张必须逐个说死——duo 当初就是没说死才出来两个陌生人
  assert.match(p, /第一张参考图是「顾朝」本人/);
  assert.match(p, /第二张参考图是「顾暮」本人/);
  assert.match(p, /第三张参考图是「Lisa」本人/);
  assert.match(p, /绝不许互换、混合或平均化/);
  assert.match(p, /别凭空多出第 4 个人/);
  assert.match(p, /白发红瞳/);
  assert.match(p, /戴眼镜/);
});

test("cast 只有一个人时不走多人分支，退回原来的行为", () => {
  const one = build(朝, "在家", null, { kind: "self", cast: [{ name: "顾朝" }] });
  assert.match(one, /照片里只有「顾朝」一个人/);
  assert.doesNotMatch(one, /个人同框/);
});

test("没给 cast 时 duo 老路径一字不变（单聊和小剧场还在走它）", () => {
  const duo = build(朝, "在家", null, { kind: "duo", me: { name: "Lisa", appearance: "戴眼镜" } });
  assert.match(duo, /照片里【有两个人同框】/);
  assert.match(duo, /【两张参考图的对应关系·最高优先级】第一张参考图是「顾朝」本人，第二张参考图是「Lisa」本人/);
});

test("两个角色的合照也能出（以后「看看你俩合照」就走这条）", () => {
  const p = build(朝, "在阳台", null, { kind: "duo", cast: [朝, 暮] });
  assert.match(p, /有 2 个人同框/);
  assert.match(p, /第一张参考图是「顾朝」本人；第二张参考图是「顾暮」本人/);
  assert.doesNotMatch(p, /Lisa/, "用户没进名单就不该出现在画面里");
});

test("群聊调用点：名单顺序＝参考图顺序，拍照的排第一，用户垫底", () => {
  const seg = app.slice(app.indexOf('if (gPhotoKind === "group")'), app.indexOf("if (gPhotoScene && gPhotoKind"));
  assert.match(seg, /\[spk\]\.concat\(members\.filter\(c => c\.id !== spk\.id\)\)/, "拍照的那位排第一");
  assert.match(seg, /\.filter\(c => c && c\.refPhoto\)/, "没参考照的不能进名单");
  assert.match(seg, /roster\.push\(\{[\s\S]*?__me/, "用户排在最后");
  assert.match(seg, /if \(roster\.length >= 2\) gCast = roster; else gPhotoKind = "other";/, "凑不齐两人退回单人照");
  // 参考图必须由同一份名单生成，不能各排各的
  assert.match(app, /const refs = gCast \? gCast\.map\(x => x\.refPhoto\)/);
});

test("凑不够人就不把 group 这个选项给模型", () => {
  assert.match(app, /const gGroupShotOk = members\.filter\(c => c && c\.refPhoto\)\.length \+ \(\(profile && profile\.refPhoto\) \? 1 : 0\) >= 2/);
  assert.match(app, /\(gGroupShotOk \? "｜group" : ""\)/);
  assert.match(app, /一个人在场时不许用/);
});

test("参考图降级要逐张退，不许从 N 张一步掉到 1 张", () => {
  const seg = engine.slice(engine.indexOf("const sets = [];"), engine.indexOf('sets.push({ n: 1, how: "duo-single-ref" });'));
  assert.match(seg, /for \(let n = refBlobs\.length - \(opts && opts\.contRef \? 2 : 1\); n >= 2; n--\)/);
  assert.match(seg, /how: "fewer-refs-" \+ n/, "退到第几级要留痕，别悄悄丢脸");
});
