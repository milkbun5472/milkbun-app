// 审美审计还债收尾（三）：screens.js 以外最后那几处米白外壳。
//
// 全库扫下来只剩五处 `style: { background: t.bg }`，四处是真的外壳、
// 一处（朋友圈评论区那一小块底）本来就该是平色，不动。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const codex = read("codex.js"), debate = read("debate.js"), fanfic = read("fanfic.js"), phone = read("phone.js");

test("全库不许再有拿 t.bg 当页面外壳的", () => {
  const dir = path.join(__dirname, "..", "js");
  const left = [];
  fs.readdirSync(dir).filter(f => f.endsWith(".js")).forEach(f => {
    if (["games.js", "trpg.js", "yanqiu.js"].includes(f)) return;   // 不是我的地盘
    const txt = fs.readFileSync(path.join(dir, f), "utf8");
    txt.split("\n").forEach((l, i) => {
      if (!l.includes("style: { background: t.bg }")) return;
      // 朋友圈评论区那一小块：它是【卡片里的一小格底】，不是页面外壳
      if (f === "components.js" && /rounded-xl px-3 py-2/.test(l)) return;
      left.push(f + ":" + (i + 1));
    });
  });
  assert.deepEqual(left, [], "还有页拿 t.bg 当外壳：" + left.join(" "));
});

test("攻略页是它自己写着的那本【说明书】", () => {
  assert.match(codex, /style: manualSkin\(t\)/);
  assert.match(codex, /h\(Head, \{ zh: "攻略", sub: "这台手机的说明书", bg: "transparent"/, "顶栏还在刷平色");
  const mk = codex.slice(codex.indexOf("function manualSkin(t)"), codex.indexOf("(function () {"));
  const manualSkin = new Function("return " + mk.replace("function manualSkin(t)", "t =>"))();
  ["rgb(2,2,2)", "orange", "#abc", "", undefined].forEach(ink =>
    assert.equal(manualSkin({ ink: ink, bg: "#f7f3ea" }).background, "#f7f3ea", String(ink) + " 没退回纯色"));
  const bg = manualSkin({ ink: "#2b2620", bg: "#f7f3ea" }).background;
  // 订书钉两枚——一枚的话那是别的东西
  assert.equal((bg.match(/linear-gradient\(-24deg/g) || []).length, 2, "订书钉不是两枚");
  // v63.45 挪到顶栏底下：钉在 top 30px 会跟返回键叠在一起
  assert.match(bg, /left 15px top 104px/);
  assert.match(bg, /left 15px top 126px/);
  assert.match(bg, /repeating-linear-gradient\(180deg/, "薄纸的横纹没了");
  assert.ok(/,#f7f3ea$/.test(bg), "主题底色没压在最后一层");
  // 跟世界书那本活页夹分得开：那本是左边一列【孔】，这本是【钉】
  assert.ok(!bg.includes("repeat-y"), "抄了活页夹那一列装订孔");
});

test("查手机的花名册：那块手机屏是摆在桌上的", () => {
  assert.ok(phone.includes("rounded-[30px]"), "那块「手机屏」没了");
  assert.match(phone, /style: pageSkin\("wood", t, \{ corner: false \}\) \},\s*\n\s*\/\/ 紧凑标题栏/, "外壳没铺桌子");
  const seg = phone.slice(phone.indexOf('style: pageSkin("wood"'), phone.indexOf('rounded-[30px]'));
  assert.ok(!/background: t\.bg,\s*paddingTop: safeTop\(10\)/.test(seg), "顶栏还在刷平色");
});

test("铺了底的页面，顶栏一律透上来", () => {
  // 擂台：底早就铺在外壳上（arenaFloor2），顶栏却自己刷一档平色
  assert.match(debate, /style: arenaFloor2 \},\s*\n\s*\/\/ 头/);
  assert.match(debate, /h\("div", \{ className: "shrink-0", style: \{ background: "transparent" \} \},/, "擂台顶栏还在刷平色");
  assert.ok(!/className: "shrink-0", style: \{ background: t\.bg \}/.test(debate));
});

test("真配用半窗的那一处，皮也得穿对", () => {
  // 同人文「新世界观」那块：父页铺的是 pageSkin("paper")，掀起来那块退回平色
  // 就等于从纸上掀起一块塑料板（no-half-sheet.md 的 skin 那一节）
  assert.match(fanfic, /className: "w-full rounded-t-3xl px-6 pt-5 pb-8", style: pageSkin\("paper", t, \{ strength: \.6, corner: false \}\)/);
  assert.match(fanfic, /style: pageSkin\("paper", t, \{ strength: \.6 \}\)/, "父页那张纸不见了，两边就不是同一张了");
});
