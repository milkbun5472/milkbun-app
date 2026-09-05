// 她 2026-09-05：「然后每一个的封面也可以自定义，不然都是现在米白背景好丑」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const fn = name => { const i = comp.indexOf("function " + name + "("); return comp.slice(i, comp.indexOf("\n}", i) + 2); };
const cut = (from, to) => comp.slice(comp.indexOf(from), comp.indexOf(to, comp.indexOf(from)));
const G = (() => {
  const ctx = { resolveImg: r => (r === "iv_gone" ? "" : "blob:" + r) };
  vm.createContext(ctx);
  vm.runInContext([fn("decorGroundDark"), fn("decorGroundStyle")].join("\n") + "\nthis.style = decorGroundStyle; this.isDark = decorGroundDark;", ctx);
  return ctx;
})();

test("底色盘里第一格是【原样】——不挑就是各款自己那张底", () => {
  const seg = cut("const HOME_DECOR_GROUNDS = [", "\n];");
  assert.match(seg, /\{ id: "", name: "原样"/);
  assert.ok((seg.match(/\{ id: "#/g) || []).length >= 6, "能挑的颜色太少");
  assert.match(seg, /id: "#1f1e1b", name: "夜色"/);
});

test("挑了才换：颜色换整块底，图当封面铺满", () => {
  assert.equal(G.style({}), null, "没挑却给了底，各款自己那张画就被盖掉了");
  assert.equal(G.style({ ground: null }), null);
  assert.deepEqual({ ...G.style({ ground: { color: "#2b3a36" } }) }, { background: "#2b3a36", backgroundImage: "none" });
  assert.deepEqual({ ...G.style({ ground: "#2b3a36" }) }, { background: "#2b3a36", backgroundImage: "none" }, "老存档里直接存字符串的也要认");
  const img = G.style({ ground: { imageRef: "iv_abc" } });
  assert.equal(img.backgroundImage, "url(blob:iv_abc)");
  assert.equal(img.backgroundSize, "cover");
  // ⚠️图丢了要退回「没挑」，不能落一块纯黑
  assert.equal(G.style({ ground: { imageRef: "iv_gone" } }), null, "图丢了就变成一块黑");
});

test("深色的底，字得跟着翻白——不然就是黑底黑字", () => {
  assert.equal(G.isDark({}), false);
  assert.equal(G.isDark({ ground: { color: "#1f1e1b" } }), true, "夜色底还用深字");
  assert.equal(G.isDark({ ground: { color: "#2b3a36" } }), true, "墨绿底还用深字");
  assert.equal(G.isDark({ ground: { color: "#f3ece0" } }), false, "宣纸底翻成白字了");
  assert.equal(G.isDark({ ground: { color: "#ffffff" } }), false);
  // 图什么都可能，猜不了：一律按深底处理
  assert.equal(G.isDark({ ground: { imageRef: "iv_abc" } }), true);
  assert.equal(G.isDark({ ground: { color: "不是颜色" } }), false, "认不出的值别乱翻");
  // 接进渲染链
  assert.match(comp, /const dark = preset === "film" \|\| decorGroundDark\(item\);/);
});

test("放了图还要给字垫一层影——光翻白，图上亮的那块还是读不出来", () => {
  const seg = cut("const gShadow =", "const onGnd =");
  assert.match(seg, /item\.ground\.imageRef/);
  assert.match(seg, /textShadow: "0 1px 3px rgba\(0,0,0,\.62\)"/);
  assert.match(comp, /return gnd \? Object\.assign\(\{\}, base, gnd, gShadow \|\| \{\}\) : base;/);
});

test("底套在【每一款自己那张纸】上，不是套在根节点上", () => {
  // ⚠️有几款的纸是里面那一层：套在根上会被那层纸原样盖住，看着就像这个设置没生效。
  assert.match(comp, /所以下面每一款都在它自己那张「纸」上 Object\.assign 一次/);
  // 照片那一支换的是【板子】，根节点不带底
  assert.match(comp, /if \(gnd && body && body\.props\) body = React\.cloneElement\(body, \{ style: Object\.assign\(\{\}, body\.props\.style, gnd\) \}\);/);
  // 书签／挂轴／便利贴／票根／日期签／字句卡各一处（票根两块板）
  assert.equal((comp.match(/onGnd\(/g) || []).length, 7, "有一款的纸没接上，或者接重了");
  const bm = cut('if (item.type === "bookmark")', 'if (item.type === "scroll")');
  assert.match(bm, /style: onGnd\(\{ width: "78%", maxWidth: 62/, "书签换的不是那张纸");
  const sc = cut('if (item.type === "scroll")', 'if (item.type === "letter")');
  assert.match(sc, /style: onGnd\(\{ width: "80%", flex: 1/, "挂轴换的不是那张纸");
  // 里头的画一个都不许换掉——那几样才是「这是什么东西」
  assert.ok(sc.indexOf("onGnd") > 0 && (sc.match(/onGnd\(/g) || []).length === 1, "挂轴把轴杆也一起换了");
});

test("挂轴和便利贴的字原来写死深色，得跟着 dark 走", () => {
  const sc = cut('if (item.type === "scroll")', 'if (item.type === "letter")');
  assert.match(sc, /color: dark \? "#f2ece0" : "#4a3f30"/, "挂轴的字还是写死的深色");
  const nt = cut('if (item.type === "note")', 'if (item.type === "cassette")');
  assert.match(nt, /color: gnd && dark \? "#f2ece0"/, "便利贴的字还是写死的深色");
  assert.match(nt, /gnd && dark \? "rgba\(242,236,224,\.78\)" : "#746650"/);
});

test("编辑器里有那一行，两个入口都接上了，而且存得住", () => {
  const ed = cut("function HomeDecorAppearanceEditor", "function Home({");
  assert.match(ed, /"这一件的底"/);
  assert.match(ed, /HOME_DECOR_GROUNDS\.map/);
  assert.match(ed, /gImg \? "已放图 · 换" : "放一张图"/);
  assert.match(ed, /换的只是这一件最外面那层底/, "得说清里头的画不会跟着变");
  // 新建那一处 + 改已有那一处
  assert.equal((comp.match(/onGround: setDecorDraftGround/g) || []).length, 1);
  assert.equal((comp.match(/onGround: setStyleDecorGround/g) || []).length, 1);
  // 落档
  assert.match(comp, /ground: decorDraftGround, align: decorDraftAlign/);
  // ⚠️改已有那一处有【两条保存路径】（照片框一条、别的小物一条）。
  //   只钉「出现过」的话，删掉其中一条另一条还在，断言一声不吭（变异测试逮到的）。
  assert.equal((comp.match(/ground: styleDecorGround, align: styleDecorAlign/g) || []).length, 2,
    "两条保存路径里有一条没存底");
  // 打开编辑器要把已有的带出来，新建要清干净
  assert.match(comp, /setStyleDecorGround\(d\.ground \|\| null\);/);
  assert.match(comp, /setDecorDraftGround\(null\);/);
});

test("底图走图库只存门牌——base64 塞进 x_ 键会把 5MB 池子撑爆", () => {
  // 那段「为什么」写在函数【前面】的注释里，所以从注释起头切
  const f = cut("  // 底图跟相框里那些照片走同一条工艺", "function clearDecorPhoto");
  assert.match(f, /resizeImageFile\(file, 900, \.84\)/);
  assert.match(f, /imgToVault\(data\)/, "直接把 base64 存进装饰对象了");
  assert.match(f, /\{ imageRef: ref \}/);
  assert.match(f, /装饰是 x_ 键/, "为什么不能直接塞，写在代码里");
  // 收图失败要说一声，不能静默
  assert.match(f, /toast\("这张图没能当上底"\)/);
});
