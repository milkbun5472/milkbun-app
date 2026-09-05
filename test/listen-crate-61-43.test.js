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
const i = src.indexOf("  // ── 底：封面就是这一页");
assert.ok(i > 0, "抠不出那层底");
const CRATE = src.slice(i, src.indexOf("    cvAddSheet,", i));
// ⚠️「不许出现 X」这类断言必须对着【剥掉注释的代码】问：注释里正写着
//   「不挂 backgroundAttachment」「默认那个 #c25a4a」，直接 grep 会把说明当违规抓出来。
const CODE = CRATE.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const LT = src.slice(src.indexOf("function ListenTogether("), src.indexOf("// 设置·情侣问答自定义题库"));

test("封面就是这一页：挂在外壳上、透到顶栏后面、往下淡进纯底（v63.54）", () => {
  // 她 2026-09-05：「封面整个代替掉页面」「纹理背景方向错了，放在听歌软件里不好看」。
  // 四版材质（木纹/沟纹/内袋纸/沟纹一片）的前提都是「这页是一件东西」；播放页现实里是【正在放的那首歌】。
  // v62.96 曾把封面挂进滚动区（她：「封面太靠上了移到一起听标题下面」）；
  // v63.54 她要它【透到上面】去，而且「不是直接把主体移上去做 fade」——
  // 所以封面回到外壳上、跟顶栏平级，正文一格没动。挂在滚动区里它永远上不去（容器会裁）。
  assert.match(CRATE, /coverField,\n\s*h\("div", \{ style: \{ position: "relative", zIndex: 1 \} \}, h\(Head, \{ zh: "一起听"/, "封面没挂在外壳上，它就上不了顶栏");
  assert.match(CRATE, /className: "flex-1 overflow-y-auto", style: \{ position: "relative", zIndex: 1 \}/, "正文那层得压在封面上面");
  assert.match(CRATE, /h\(Head, \{ zh: "一起听", bg: "transparent"/, "顶栏得是透明的，底色由外壳给");
  assert.match(LT, /const crate = \{ background: t\.bg \};/, "外壳不是干净的底");
  assert.match(LT, /const coverSrc = now \? \(nowCover \|\| discImg \|\| ""\) : "";/, "封面来源不对：先这首歌的封面，再她自己换的那张");
  // v62.95 白屏：coverSrc 必须声明在 playTab 之前——playTab 是声明处就求值的 const，引用后面的 const 就是 TDZ
  // ⚠️对着剥掉注释的代码问：coverSrc 上面那段注释正写着「const playTab = h(...)」，直接 indexOf 会先撞上注释
  const LTC = LT.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(LTC.indexOf("const coverSrc = ") < LTC.indexOf("const playTab = "), "coverSrc 又跑到 playTab 后面去了，一进页面就 TDZ 白屏");
  assert.match(LT, /WebkitMaskImage: coverFade, maskImage: coverFade, opacity: showLyric \? \.22 : 1/, "封面没往下淡出，或歌词页没压暗");
  assert.match(LT, /rgba\(0,0,0,1\) 0px, rgba\(0,0,0,1\) 250px, rgba\(0,0,0,0\) 400px/, "淡出的位置变了：标题要坐在近乎纯底上");
  // 内容在动，封面不该跟着动
  assert.doesNotMatch(CODE, /backgroundAttachment/, "又挂上 backgroundAttachment 了");
  assert.match(rule, /底纹铺在【外壳】上，顶栏透明/);
});

test("材质全撤了：没有沟纹、没有木纹、没有内袋纸；碟也撤了", () => {
  assert.doesNotMatch(LT, /repeating-radial-gradient/, "沟纹又回来了");
  assert.doesNotMatch(LT, /repeating-linear-gradient\(90deg/, "内袋纸又回来了");
  assert.doesNotMatch(CODE, /#c25a4a|木纹|wood/, "木台面那一版又长回来了");
  assert.doesNotMatch(LT, /const disc = /, "碟那层底还在");
  assert.doesNotMatch(LT, /const sleeve = !hex6/, "内袋纸那层底还在");
  // 播放页顶上是一块让封面露出来的位子，不是一张 232 的碟——碟上那张小封面跟整页的是同一张
  const play = LT.slice(LT.indexOf("  const playTab ="), LT.indexOf("  const homeTab ="));
  assert.doesNotMatch(play, /width: 232, height: 232/, "碟还在");
  assert.match(play, /"aria-label": "换封面"/, "换封面的入口没了");
  assert.match(play, /coverSrc \? "换封面" : "加封面"/);
});

test("主题色拼透明度后缀前先验六位色号，验不过退回纯色", () => {
  // 封面那层 mask 不碰主题色，所以永远不会静默消失；只有没封面时那团暖光拼了 accent
  assert.match(LT, /const hex6 = v => \/\^#\[0-9a-f\]\{6\}\$\/i\.test\(String\(v \|\| ""\)\)/);
  assert.match(LT, /hex6\(t\.accent\) \? "radial-gradient\(ellipse at 50% 30%," \+ t\.accent \+ "3a/, "没封面时那团暖光没验色号");
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
