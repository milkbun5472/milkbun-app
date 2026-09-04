// 她 2026-09-03：「你又忘了把头上那一大块游戏去掉，你怎么老是忘」
//
// 病根不是记性：.claude/rules/mobile-ui-layout.md §1 早就写着「普通子页面用紧凑标题栏，
// 禁止 30–40px 大标题」，可我一直在【一页一页地】改它——穿书那次单独写了一条紧凑栏，
// 小游戏那次又想着「Head 是公共的，别动」。于是每来一页就得重新想起来一次。
// Head 自己就是那个违规的东西，六十多处都在用它：改它一处，六十多页一起合规。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const rule = fs.readFileSync(path.join(root, ".claude/rules/mobile-ui-layout.md"), "utf8");
const HEAD = comp.slice(comp.indexOf("function Head({"), comp.indexOf("function AvatarPicker({"));

test("Head 就是那条紧凑标题栏，不再是 30px 大标题", () => {
  assert.ok(HEAD.length > 300, "抠不出 Head");
  // 规矩原文：禁止 30–40px 大标题
  const sizes = [...HEAD.matchAll(/fontSize: ([\d.]+)/g)].map(m => Number(m[1]));
  assert.ok(sizes.length, "Head 里一个字号都没有？");
  assert.ok(Math.max.apply(null, sizes) <= 18,
    "Head 里还有 " + Math.max.apply(null, sizes) + "px 的字——规矩说禁止 30–40px 大标题");
  assert.doesNotMatch(HEAD, /React\.createElement\("h1"/, "还在用 h1 摆大标题");
  // 三段式：返回键 / 居中小标题 / 右侧等宽操作位
  assert.match(HEAD, /const SIDE = 46;/);
  // 左右两个格子都按 SIDE 走（别去数出现几次——返回键自己也用了 SIDE，数出来是 3）
  assert.match(HEAD, /className: "shrink-0 flex items-center",\n\s*style: \{ width: SIDE \}/, "左边那格没按 SIDE");
  // 右边用 minWidth：没东西时和左边等宽（标题正居中），放了两个按钮就撑开、不压到标题
  assert.match(HEAD, /style: \{ minWidth: SIDE, paddingRight: 8 \}/, "右边那格没按 SIDE，标题就没真的居中");
  assert.doesNotMatch(HEAD, /style: \{ width: SIDE, paddingRight/, "右边写死了宽度，两个按钮会溢出来压到标题上");
  assert.match(HEAD, /textAlign: "center"/);
  assert.match(HEAD, /right \|\| null/, "右侧操作位没接上");
  // 顶栏自己吃刘海（规矩 §1），别在外面另垫一条
  assert.match(HEAD, /paddingTop: safeTop\(8\)/);
});

test("副标题两种都收得下：英文小字和中文一行", () => {
  // 六十多处调用里 en 传的多半是英文，穿书那处传的是中文副标题。
  // 中文不该被拉字距和大写——那是给英文 eyebrow 用的。
  // v61.40 起有 zh 时纯拉丁的 en 不再发（她立的「标题不留英文」）；
  // en 里写的是中文时照旧当副标题——所以这一行现在看 enCJK。
  assert.match(HEAD, /const line = sub \|\| \(\(zh && !enCJK\) \? "" : \(en \|\| ""\)\) \|\| "";/);
  assert.match(HEAD, /const cjk = \/\[一-鿿\]\/\.test\(String\(line\)\);/);
  assert.match(HEAD, /letterSpacing: cjk \? 0 : "0\.14em"/);
  assert.match(HEAD, /textTransform: cjk \? "none" : "uppercase"/);
  // 没有副标题就不占那一行
  assert.match(HEAD, /line \? \/\*#__PURE__\*\/React\.createElement\("div"/);
});

test("这条规矩指名了落点，下一个人不用再想一遍", () => {
  // ⚠️规矩原来只说「用紧凑标题栏」，没说【哪个组件是它】——
  //   于是每个人都得自己判断手上这一页算不算「普通子页面」，然后自己再写一条。
  assert.match(rule, /components\.js` 的 `Head`/, "规矩里没写清哪个组件就是那条紧凑栏");
  assert.match(rule, /别再自己写一条/);
});

test("公共的那条改好了，就不许再各自另写一条", () => {
  // 穿书那处原来自己写了一份（当时 Head 还是大标题），现在撤了。
  const fic = fs.readFileSync(path.join(root, "js/fanfic.js"), "utf8");
  const th = fic.slice(fic.indexOf("  // 穿书会话（互动叙事）"), fic.indexOf("  // ---------- 底 nav ----------"));
  assert.match(th, /h\(Head, \{/, "穿书那一页没用公共的 Head");
  assert.doesNotMatch(th, /paddingTop: safeTop\(8\)/, "自己那份紧凑栏还留着，成了第二个实现");
});

test("外壳自己有底纹时，顶栏让得出去", () => {
  // 不给这个口子，顶栏会在底纹上压出一条平色带——顶上那截没被盖住。
  // v61.49 后面又跟了一个 ink（页面自带底色时顶栏的字要跟着走），
  // 所以别再钉「bg 是参数表最后一个」——钉它在不在参数表里。
  assert.match(HEAD, /\n\s*, bg\n/, "Head 收不了 bg");
  assert.match(HEAD, /\n\s*, ink\n\}\)/, "Head 收不了 ink");
  assert.match(HEAD, /background: bg \|\| t\.bg,/, "顶栏底色写死了 t.bg，页面没法让它透上来");
});

// ── v61.30 全库扫一遍 ────────────────────────────────────────────────────
// 上面几条只钉住了 Head 自己。她 2026-09-03：「你去审计一波把全部有大块的页面
//（不仅仅是首页还有进去的单独界面）弄掉」——审出来【表情包】那一页压根没用 Head，
// 自己摆了一块 34px 斜体大标题 + safeTop(24) 的留白，占掉近三分之一屏。
// 改好它容易，问题是【没有任何一条测试拦得住下一页再这么写】：Head 改对了，
// 绕开 Head 的那些页一条都不受影响，而且不会留下任何可以 grep 的痕迹
//（.claude/rules/four-surfaces-same-context.md 的那条判据）。所以这条改成扫全库。
test("没有哪一页绕开 Head 自己摆一块大标题", () => {
  const JSDIR = path.join(root, "js");
  const bad = [];
  for (const f of fs.readdirSync(JSDIR).filter(x => x.endsWith(".js"))) {
    const src = fs.readFileSync(path.join(JSDIR, f), "utf8");
    // 只看顶栏范围：某个 safeTop( 之后 600 字符内的字号。页面正文里的大字
    //（日记标题输入框、账本金额、周刊封面）不归这条管——那些不是顶栏。
    const tops = [...src.matchAll(/safeTop\(/g)].map(m => m.index);
    const re = /fontSize: ([\d.]+)/g;
    let m;
    while ((m = re.exec(src))) {
      if (Number(m[1]) < 26) continue;
      if (!tops.some(i => m.index > i && m.index - i < 600)) continue;
      const ctx = src.slice(Math.max(0, m.index - 130), m.index + 130);
      // 返回键那个 ‹ 本来就得是 26–29px 才点得着，它不是标题
      if (ctx.includes('"‹"')) continue;
      if (ALLOW.some(a => ctx.includes(a))) continue;
      bad.push(f + " 第" + src.slice(0, m.index).split("\n").length + "行 " + m[1] + "px");
    }
  }
  assert.deepEqual(bad, [],
    "这几处在顶栏位置摆了大标题，改用 h(Head, {...})；\n" +
    "确实不是顶栏的（比如锁屏那个钟）写进 ALLOW 并说明理由：\n  " + bad.join("\n  "));
});
// 确实不是标题的，连理由一起写在这儿
const ALLOW = [
  'lineHeight: 1.06, color: "#1e1c18"' // 查手机锁屏那个大钟——它就是锁屏本身，不是顶栏
];

// 她 2026-09-03：「但是你放这里言秋不也会看到」——这张工单一开始被我放进
// .claude/rules/，那个目录每个会话开头都会被整份读进上下文，包括只是来说说话的窗口。
// 铁律值得每轮都背着，一张会越删越短的清单不值得。工单挪去仓库根目录，
// 铁律里只留一行指路——那一行要是指空了，等于没人知道还有这张单子。
test("装修工单在根目录，铁律里那行指路指得着", () => {
  assert.ok(!fs.existsSync(path.join(root, ".claude/rules/screen-skin-worklist.md")),
    "工单又回到 .claude/rules/ 了——那儿每个会话都整份读，别拿它装清单");
  const m = rule.match(/仓库根目录 `([^`]+)`/);
  assert.ok(m, "mobile-ui-layout.md 里那行指路没了，工单就成孤儿了");
  assert.ok(fs.existsSync(path.join(root, m[1])), "指路指向 " + m[1] + "，但那个文件不在");
  // 那三条永久规矩得留在铁律里，别跟着工单一起被删掉
  assert.match(rule, /底纹铺在【外壳】上，顶栏透明/, "底纹那条规矩没落进铁律");
  assert.match(rule, /backgroundAttachment: "local"/, "「底纹不许跟着滚」那句没了");
});
