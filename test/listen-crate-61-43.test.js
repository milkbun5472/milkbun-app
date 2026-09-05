// 她 2026-09-03：「大概功能整理好了现在来改设计吧，都还是米白的」
//
// 这个 app 在现实里是什么？播放页早就画着一张真的碟——那整页就该是那张碟。
// v61.43 我先做成了木台面，她当天就说「这个木头出现率是不是有点高了最近」：
// 小游戏那架柜子已经是木头了。判据还是那句「原样搬到别的 app 里还成立吗」——
// 木纹搬去哪儿都成立，所以它不说明这是什么东西；**唱片的同心沟纹只有音乐这一处成立**。
// v61.44 换成从碟的圆心荡出去的沟纹。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const rule = fs.readFileSync(path.join(root, ".claude/rules/mobile-ui-layout.md"), "utf8");
const i = src.indexOf("  // ── 底：唱片自己的那圈纹");
assert.ok(i > 0, "抠不出那层底");
const CRATE = src.slice(i, src.indexOf("    cvAddSheet,", i));
// ⚠️「不许出现 X」这类断言必须对着【剥掉注释的代码】问：注释里正写着
//   「不挂 backgroundAttachment」「默认那个 #c25a4a」，直接 grep 会把说明当违规抓出来。
const CODE = CRATE.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const LT = src.slice(src.indexOf("function ListenTogether("), src.indexOf("// 设置·情侣问答自定义题库"));

test("底纹铺在外壳上、顶栏透上来（mobile-ui-layout.md §3.5）", () => {
  // 铺在滚动区上的话顶栏那一条还是平色，顶上横一道没盖住的带子
  assert.match(CRATE, /className: "h-full flex flex-col relative", style: crate/, "底纹没铺在最外面那个外壳上");
  assert.match(CRATE, /h\(Head, \{ zh: "一起听", bg: "transparent"/, "顶栏没让底纹透上来");
  // 内容在动，木头不该跟着动
  assert.doesNotMatch(CODE, /backgroundAttachment/, "又挂上 backgroundAttachment 了");
  // 规矩本身还在（这条塌了，上面几条就没有出处了）
  assert.match(rule, /底纹铺在【外壳】上，顶栏透明/);
});

test("主题色拼不出六位色号时退回纯色，不许整层静默消失", () => {
  // 深色/自定义主题下 t.ink 可能不是 #rrggbb，拼 t.ink+"1c" 会拼出废值，
  // 那一整条 background-image 被浏览器丢掉——界面上看着像「这一页没做」。
  // ⚠️v62.46 起 hex6 提到了组件最上头（曲目单那一行也要用它，而那几个 tab 是
  //   `const x = h(...)`、声明处就求值，引用后面的 const 会 TDZ 白屏）。所以这一条
  //   对着【整个组件】问，不再对着底那一段问。
  assert.match(LT, /const hex6 = v => \/\^#\[0-9a-f\]\{6\}\$\/i\.test\(String\(v \|\| ""\)\)/);
  assert.match(LT, /const disc = !\(hex6\(t\.ink\) && hex6\(t\.accent\)\) \? \{ background: t\.bg \}/,
    "碟那一层验不过没退回纯色；两个都要验，它两样颜色都在拼");
  assert.match(LT, /const sleeve = !hex6\(t\.ink\) \? \{ background: t\.bg \}/,
    "碟套那一层验不过没退回纯色");
});

test("底纹是唱片的同心沟纹，不是又一块木头", () => {
  // 木纹换个 app 照样成立＝没设计；同心沟纹只有音乐这一处成立。
  //
  // ⚠️v62.46 这一条改了口径，不是放宽：审美审计指出「圆心放在碟真正待的位置」
  //   这句只在【播放页】成立——切到发现/我的/设置，240px 那儿是一条搜索框、一张大卡、
  //   一张开关卡，沟还在从那儿荡出去，而那儿没有碟。四分之三的时间里那套纹只是纹理。
  //   所以现在是两层底：有碟的那一格铺沟，另外三格铺【碟套的内袋纸】。
  //   于是「不许出现 repeating-linear-gradient(90deg)」这个代理判据失效了——
  //   内袋纸的纸纹本来就是平行线。改成对着【两层各自该是什么】问：
  const groove = LT.slice(LT.indexOf("  const disc ="), LT.indexOf("  const crate = nav"));
  const sleeveBlk = LT.slice(LT.indexOf("  const sleeve ="), LT.indexOf("  const disc ="));
  // v62.89：播放页外壳退回纯底，沟纹改成贴在滚动区顶上的【一片】（discField），往下 mask 淡出——
  // 她拿网易云那页对照：「它下面是会 fade 掉的」。整页压深那版把标题和封套也压进了暗处。
  assert.match(LT, /const crate = nav === "play" \? \{ background: t\.bg \} : sleeve;/, "播放页外壳没退回纯底");
  assert.match(LT, /const discField = nav === "play" \? h\("div", \{ "aria-hidden": "true"/, "沟纹那一片没了");
  assert.match(LT, /WebkitMaskImage: discFade, maskImage: discFade \}, disc\)/, "沟纹没往下淡出");
  assert.match(LT, /rgba\(0,0,0,1\) 260px, rgba\(0,0,0,0\) 460px/, "淡出的位置变了——标题该坐在余纹上、封套坐在纯底上");
  assert.match(LT, /style: \{ position: "relative", isolation: "isolate" \} \}, discField,/, "沟纹那片没垫在内容底下（没有 isolate 它会盖在字上面）");
  // 木头那一版的痕迹一处都不许回来
  assert.doesNotMatch(CODE, /#c25a4a|木纹|wood/, "木台面那一版又长回来了");
  // 碟套之所以是碟套，不是「一张纸」：中间有碟压出来的那一圈印
  assert.match(sleeveBlk, /radial-gradient\(circle at 50% 44%/, "内袋中间没有碟压出来的那圈印，那就只是一张纸了");
  assert.doesNotMatch(sleeveBlk, /repeating-radial-gradient/, "没有碟的那三格不该再铺沟纹");
  assert.match(groove, /repeating-radial-gradient\(circle at 50% 130px/, "没有沟纹");
  // 圆心得跟播放页那张碟对齐，不然纹是纹、碟是碟，两回事
  const centers = [...new Set((CODE.match(/circle at 50% (\d+)px/g) || []))];
  assert.equal(centers.length, 1, "圆心不止一个：" + centers.join(" / ") + "——所有圈得同心");
  // 暖来自主题的 accent，不是硬写一个颜色
  assert.match(CRATE, /radial-gradient\(circle at 50% 130px," \+ t\.accent/, "没有那层暖底");
  const hard = CODE.match(/#[0-9a-f]{6}/gi) || [];
  assert.deepEqual(hard, [], "木头里写死了颜色：" + hard.join(" "));
  // 每套沟纹的【周期】＝那一行里最大的那个 px。
  // ⚠️先把「circle at 50% 240px」那截剔掉——那是圆心坐标，不是周期；
  //   不剔的话三行都会算出 240，这条断言就成了空转（我第一版正是这么错的）。
  const grain = (CODE.match(/repeating-radial-gradient\(circle[^\n]*/g) || [])
    .map(line => line.replace(/circle at [\d.]+% \d+px/, ""))
    .map(line => Math.max.apply(null, (line.match(/(\d+)px/g) || ["0px"]).map(x => parseInt(x, 10))));
  assert.ok(grain.length >= 3, "只有 " + grain.length + " 套沟纹");
  assert.ok(new Set(grain).size === grain.length,
    "沟纹疏密撞了（" + grain.join(" / ") + "）——等距同心圆看着像靶子");
});

test("「第几首」走 sub 不走 en——走 en 会被「标题不留英文」吃掉", () => {
  // v61.29 起有 zh 时纯拉丁的 en 一律不发。这一处的 en 是【数字】，
  // 于是从那版起「3 / 12」再也没显示过（她还没发现）。数字不是装饰。
  assert.match(CRATE, /sub: nav === "play" && now \? \(idx >= 0 \? idx \+ 1 : 1\) \+ " \/ "/, "又写回 en 了");
  assert.doesNotMatch(CRATE, /en: nav === "play"/, "en 那一路还留着");
});

test("tab 改了名，界面上指路的字也得跟着改", () => {
  // 「曲库」改叫「设置」之后，空状态还写着「去『首页』」就成了指错路——
  // 她照字面去找，那个 tab 根本不叫这个名。⚠️没连账号时它确实还叫「首页」，
  // 所以这两句得跟着连没连账号走，不能一刀切。
  const seg = src.slice(src.indexOf("function ListenTogether("), src.indexOf("// 设置·情侣问答自定义题库"));
  const stale = (seg.match(/"[^"]*去「首页」[^"]*"|"[^"]*去「曲库」[^"]*"/g) || []);
  assert.deepEqual(stale, [], "这几句还在指旧名字：\n  " + stale.join("\n  "));
  // v62.81 起那一格永远叫「设置」（搜歌搬去「发现」之后，它里面只剩接口/Cookie/登录/贴链接/传本地，
  // 连没连账号都是这些东西），指路的字也只指「发现」和「设置」两个真名。
  assert.equal((seg.match(/\(apiBase && cookie\) \? "设置" : "首页"/g) || []).length, 0, "还有地方在按账号切「设置/首页」");
  assert.match(seg, /navBtn\("home", "设置"/, "那一格不叫设置了");
});

// ── 她 2026-09-03 追报的两条 ────────────────────────────────────
test("最长的那一段垫底：角色歌单不许被几十首歌挤到翻不到的地方", () => {
  // 「全部能不能放角色歌单下面，现在要翻到最下才有角色的」——
  // v61.42 我把它插在了歌单列表【之前】，三十首歌把角色生成的歌单压到了最底下。
  const mine = src.slice(src.indexOf("  const mineTab = h(\"div\""), src.indexOf("  // 底部导航"));
  const iPl = mine.indexOf('"歌单 · " + playlists.length');
  const iAll = mine.indexOf('"存在这儿的 · " + songs.length');
  assert.ok(iPl > 0 && iAll > 0, "两段都得在");
  assert.ok(iPl < iAll, "「存在这儿的」又排到歌单列表前面去了——它动辄几十首，会把角色歌单挤没");
});

test("「最近播放」和「存在这儿的」各自说清自己是什么", () => {
  // 「这个最近播放和下面的全部有啥区别」——区别真实存在，但名字没说，所以看着一样。
  const mine = src.slice(src.indexOf("  const mineTab = h(\"div\""), src.indexOf("  // 底部导航"));
  assert.doesNotMatch(mine, /"全部 · " \+ songs\.length/, "还叫「全部」——全部什么？");
  assert.match(mine, /听过什么/, "最近播放没说清它是「听过什么」");
  assert.match(mine, /咱家歌库里存着的歌/, "「存在这儿的」没说清它是「存了什么」");
});
