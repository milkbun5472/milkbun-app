// 审美审计还债收尾（一）：screens.js 里最后九处米白外壳。
//
// 这一版的规矩是【先搬后画】（v62.83 那一课：不新发明材质）：
//   导卡 → 档案馆那张桌子 · 日记文风页 → 日记正文那张纸
//   随身物两个柜子页 → 主页那块布 · 第一次们 → 情侣空间那本本子的内页
// 真没有现成材质可搬的才新画，而且新画的必须跟库里已经占过的分得开
//（纸 / 布 / 皮 / 绒 / 牛皮 / 离型纸 / 挂历墙 / 走廊都占过了）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const grab = (a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b);
  // ⚠️切不出来就当场炸：indexOf 返回 -1 时 slice 会悄悄切出半个文件，
  //   断言照样"通过"或者报一堆看不懂的错——那比没有这条测试更糟
  assert.ok(i >= 0, "切不到起点：" + a);
  assert.ok(j > i, "切不到终点：" + b);
  return src.slice(i, j);
};
const _hex6 = t => /^#[0-9a-f]{6}$/i.test(String(t.ink || ""));
const binderSkin = new Function("_hex6", "return " + grab("const binderSkin = t =>", "\n// 抽卡：")
  .replace(/^const binderSkin = /, "").replace(/;\s*$/, ""))(_hex6);
const foilSkin = new Function("_hex6", "return " + grab("const foilSkin = t =>", "\n// 照相馆：")
  .replace(/^const foilSkin = /, "").replace(/;\s*$/, ""))(_hex6);
const cycSkin = new Function("_hex6", "return " + grab("const cycSkin = t =>", "\n// 分区＝一张有索引页签的活页")
  .replace(/^const cycSkin = /, "").replace(/;\s*$/, ""))(_hex6);

test("screens.js 一处米白外壳都不剩", () => {
  assert.equal((src.match(/style: \{ background: t\.bg \}/g) || []).length, 0,
    "还有页在拿 t.bg 当外壳");
});

test("能搬的都搬了，没有为这九页新发明四张材质", () => {
  // 导卡归档案馆那一族
  assert.match(src, /className: "absolute inset-0 z-50 h-full flex flex-col", style: DESK\(t\.accent \|\| t\.tint\)/);
  // 日记文风页跟日记正文同一张纸——跟着那个人的纸走，不是随便挑一张
  assert.match(src, /style: pageSkin\(diaryPaperOf\(char\), t, \{ corner: false \}\) \},\s*\n\s*h\(Head, \{ zh: "日记档案"/);
  // 随身物两个柜子页跟主页同一块布、同一个 tint
  assert.equal((src.match(/pageSkin\("cloth", t, \{ tint: CARRY_TINT\.bag/g) || []).length, 3,
    "主页 + 柜门页 + 抽屉柜页，三处得是同一块布");
  // 第一次们是一本册子，直接用情侣空间那本本子的内页
  assert.match(src, /style: cpSkin\(t, "page"\) \},[\s\S]{0,520}"第一次们"/);
});

test("真新画的只有三张，各有各的签名", () => {
  const t = { ink: "#2b2620", bg: "#f7f3ea" };
  const bd = binderSkin(t).background, fo = foilSkin(t).background, cy = cycSkin(t).background;
  // 活页夹：左边一列装订孔 + 一条装订线
  assert.match(bd, /radial-gradient\(circle at 10px 16px/, "装订孔没了");
  assert.match(bd, /repeat-y left 0 top 14px\/24px 46px/, "孔不成一列");
  assert.match(bd, /no-repeat left 18px top 0\/1px 100%/, "装订线没了");
  // 锡箔：斜着一道道会跳的反光——两层不同角度，少一层就只是条纹
  assert.match(fo, /repeating-linear-gradient\(102deg/, "锡箔的细条没了");
  assert.match(fo, /linear-gradient\(66deg,rgba\(255,255,255,\.30\)/, "锡箔那道跳动的反光没了");
  // 影棚背景纸：顶上一束光 + 底下一道弯折接到地台
  assert.match(cy, /radial-gradient\(80% 52% at 50% 15%,rgba\(255,255,255,\.55\)/, "顶光没了");
  assert.match(cy, /linear-gradient\(180deg,#2b262000 0 62%,#2b26200e 74%/, "底下那道弯折没了");
  [bd, fo, cy].forEach(x => assert.ok(/,#f7f3ea$/.test(x), "主题底色没压在最后一层"));
});

test("三张新的彼此不同，也不跟库里已经占过的撞", () => {
  const t = { ink: "#2b2620", bg: "#f7f3ea" };
  const mine = [binderSkin(t).background, foilSkin(t).background, cycSkin(t).background];
  assert.equal(new Set(mine).size, 3, "有两张长得一模一样");
  // 库里已经占过的那几张：情侣空间七档 + 剪贴簿牛皮 + 钱包皮革 + 表情包离型纸
  const others = ["page", "wall", "album", "sill", "lining", "velvet", "corridor"]
    .map(k => src.slice(src.indexOf("    " + k + ": ["), src.indexOf("    " + k + ": [") + 300))
    .concat([grab("const KRAFT = t =>", "\n// 四角那四枚"), grab("const LEATHER = t =>", "\n// 卡插在卡位里"),
      grab("const RELEASE_PAPER = t =>", "\n// 贴纸是白的")]);
  // 拿每张新皮的【第一层】去问：这一层在别处出现过吗
  mine.forEach(bg => {
    const first = bg.split(") ")[0].split(",rgba")[0];
    others.forEach(o => assert.ok(!o.includes(first.slice(0, 42)), "跟已有的一张撞了：" + first.slice(0, 50)));
  });
});

test("三张新的都走同一道 hex6 闸，验不过退回纯色", () => {
  assert.match(src, /const _hex6 = t => \/\^#\[0-9a-f\]\{6\}\$\/i\.test\(String\(t\.ink \|\| ""\)\);/,
    "三张各写一份闸的话，迟早只改一处");
  [binderSkin, foilSkin, cycSkin].forEach(f =>
    ["rgb(1,1,1)", "teal", "#abc", "", undefined].forEach(ink =>
      assert.equal(f({ ink: ink, bg: "#f7f3ea" }).background, "#f7f3ea", String(ink) + " 没退回纯色")));
});

test("衣柜光有木纹只是块木头，杆才说明它是柜子", () => {
  const cl = src.slice(src.indexOf('style: pageSkin("wood", t, { corner: false }) },'), src.indexOf('"柜子里 · "'));
  assert.match(cl, /一根挂衣杆/, "杆没了，这就是一张木桌");
  assert.match(cl, /borderRadius: 999,\s*\n?\s*background: "linear-gradient\(180deg,rgba\(255,255,255,\.55\),rgba\(120,96,60,\.55\)\)"/, "杆没有上亮下暗的圆管感");
  assert.equal((cl.match(/width: 7, height: 11, borderRadius: 2/g) || []).length, 2, "杆两头的托架不是两个");
  assert.match(cl, /"aria-hidden": "true", className: "shrink-0"/, "杆挤进滚动区了，或者没对读屏藏起来");
});
