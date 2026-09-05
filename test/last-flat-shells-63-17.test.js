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

// ⚠️这道闸原来只认【写在一行里】的 `style: { background: t.bg }`。
//   而 `Messages` 那一页是跨行写的——
//       style: {
//         background: t.bg
//       }
//   于是它从闸底下大摇大摆走过去了（2026-09-05 抓到）。闸自己有盲区的时候，全绿什么都不证明。
//   现在跨行那种也扫。扫出来的两类要分开对待：
//     · 卡片里的一小格底（评论区、资料卡里那几条）——不是页面外壳，放行；
//     · 真的页面外壳——要么改，要么写进下面这份【明账】，写清楚为什么还留着。
// ⚠️明账空着才是对的。上一版这儿记着 phone.js 一处（查手机的内层 app 底衬）——
//   2026-09-05 把二十个内层 app 在浏览器里逐个开过之后结清了：
//   那一块平色是【有意的】，因为那些 app 扮的就是真手机上的 app（微信灰地白格、
//   日历白卡、便签白底黄条）。给它们铺纸反而会拆掉「这是他手机」这件事。
//   所以不是加豁免，是给它起了个名字（phoneAppBg），让这份「有意」写在明面上。
//   往这儿加行之前先想清楚：是真的还没做，还是那一处的平色本来就是对的。
const KNOWN_FLAT = {};
test("全库不许再有拿 t.bg 当页面外壳的", () => {
  const dir = path.join(__dirname, "..", "js");
  const left = [];
  const seen = {};
  fs.readdirSync(dir).filter(f => f.endsWith(".js")).forEach(f => {
    if (["games.js", "trpg.js", "yanqiu.js"].includes(f)) return;   // 不是我的地盘
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    // 注释里会写着这个模式（就是为了说明它为什么不许出现），先把整行注释剥掉
    const lines = raw.split("\n").map(l => /^\s*\/\//.test(l) ? "" : l);
    lines.forEach((l, i) => {
      const win = lines.slice(i, i + 4).join(" ").replace(/\s+/g, " ");
      if (!/style: \{ background: t\.bg \}/.test(win)) return;
      // 卡片里的一小格底（评论区、资料卡那几条），不是页面外壳
      if (/rounded-xl px-3 py-2/.test(win)) return;
      // ⚠️同一处会被【相邻好几行】各命中一次（窗口是往后滑的）。
      //   按窗口内容去重不行——每一行的窗口都不一样。要按【这个 style 块从哪儿开始】去重：
      //   往回找最近的一行 `style: {`，用它当这一处的身份。
      //   身份取【窗口里那一行 `style: {`】：窗口是往后滑的，命中它的那几行都指向同一个
      //   style 块，这样才收成一处。（往回找是错的——窗口的第一行还没到 style: { 那儿。）
      let anchor = i;
      for (let k = i; k < i + 4 && k < lines.length; k++) { if (/style: \{/.test(lines[k])) { anchor = k; break; } }
      const key = f + ":" + anchor;
      if (seen[key]) return; seen[key] = 1;
      // ⚠️豁免要【往前看一行】：卡片那几处的 rounded-xl 写在 className 那一行上，
      //   而 className 就在 style: { 的上一行——只往后看是看不见的。
      //   窗口只开到上下各两行：开大了就成了「附近有这个词就放行」，
      //   我第一版开到前三行，结果在 msgAppBg 旁边新造一处假页面也被豁免了。
      const scope = lines.slice(Math.max(0, anchor - 2), anchor + 2).join(" ");
      if (/rounded-xl px-3 py-2/.test(scope)) return;
      // （msgAppBg 那一份不用豁免：用了它的地方压根不含 `style: { background: t.bg }`
      //   这个字面量，本来就扫不到；它自己的函数体里没有 `style:`，也扫不到。）
      left.push(f + ":" + (anchor + 1));
    });
  });
  // 明账上的那几处按文件计数对得上就行；多出来的一律红
  const byFile = {};
  left.forEach(x => { const f = x.split(":")[0]; byFile[f] = (byFile[f] || 0) + 1; });
  Object.keys(byFile).forEach(f => { if (KNOWN_FLAT[f]) byFile[f] -= KNOWN_FLAT[f]; });
  const extra = Object.keys(byFile).filter(f => byFile[f] > 0).map(f => f + "×" + byFile[f]);
  assert.deepEqual(extra, [], "还有页拿 t.bg 当外壳（明账之外的）：" + left.join(" "));
  // 明账不许悄悄变长：写在上面的那几处，数目对不上也要红
  Object.keys(KNOWN_FLAT).forEach(f => {
    assert.ok((left.filter(x => x.split(":")[0] === f).length) === KNOWN_FLAT[f],
      f + " 上明账记的是 " + KNOWN_FLAT[f] + " 处，实际 " + left.filter(x => x.split(":")[0] === f).length + " 处");
  });
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
