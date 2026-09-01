const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

test("查手机外观按角色分桶，图片进入金库而不是 5MB 文字仓", () => {
  assert.match(phone, /loadJSON\("x_phoneLooks", \{\}\)/);
  assert.match(phone, /\[char\.id\]: \{ \.\.\.\(prev\[char\.id\] \|\| \{\}\), \.\.\.patch \}/);
  assert.match(phone, /await imgToVault\(ref\)/);
  assert.match(phone, /saveJSON\("x_phoneLooks", next\)/);
});

test("锁屏、主页与每个 App 图标都能单独换", () => {
  assert.match(phone, /uploadCard\("lockWallpaper", "锁屏"/);
  assert.match(phone, /uploadCard\("homeWallpaper", "主页"/);
  assert.match(phone, /look\.icons && look\.icons\[a\.key\]/);
  assert.match(phone, /onPatch\(\{ icons: \{ \.\.\.\(look\.icons \|\| \{\}\), \[a\.key\]: v \} \}\)/);
  // v59.30：她说「做他们 app 的一个图标，不要放在上面」——外观设置从顶栏挪到
  // 桌面最后一页，跟别的 app 一样是个图标。核的是【进得去】，不是那个按钮在顶栏。
  assert.match(phone, /const lookIcon = \(\) => \{/, "桌面上没有外观这一格");
  assert.match(phone, /pageIndex === layout\.pages\.length - 1 \? \[lookIcon\(\)\]/, "外观那一格没摆到桌面上");
  assert.ok(phone.indexOf('aria-label": "手机外观设置"') < 0, "顶栏那个按钮还留着，占着搜索的位置");
});

test("查手机沿用主界面的纸面与图标色，并保留四种有区别的图标预设", () => {
  assert.match(phone, /typeof appTone === "function"/);
  assert.match(phone, /typeof HOME_PAPER_BG !== "undefined"/);
  ["main", "soft", "mono", "glass"].forEach(key => {
    assert.match(phone, new RegExp('key: "' + key + '"'));
  });
  assert.match(phone, /preset === "soft"/);
  assert.match(phone, /preset === "mono"/);
  assert.match(phone, /preset === "glass"/);
});

test("外观设置是完整可滚动子页面，顶底安全区沿用移动端铁律", () => {
  const start = phone.indexOf("function PhoneLookSettings(");
  const end = phone.indexOf("function LockScreen(", start);
  assert.ok(start >= 0 && end > start, "找不到 PhoneLookSettings");
  const view = phone.slice(start, end);
  assert.match(view, /paddingTop: safeTop\(10\)/);
  assert.match(view, /flex-1 min-h-0 overflow-y-auto/);
  assert.match(view, /paddingBottom: COMPOSER_PAD_BOTTOM/);
});

// 她 2026-09-01：「查手机界面跟主界面颜色一样为啥看起来怪怪的」。
// 怪在【语义】上：查手机的全部意思是「你在翻别人的手机」，那种偷看感来自它跟
// 她自己的界面【不一样】。同一套纸底＋同一套彩釉图标 = 给他的手机换上她的皮，
// 而且四个角色的手机会长得一模一样。默认值改成「他自己的」。
test("默认是他自己的手机，不是她的界面换层皮", () => {
  assert.match(phone, /\{ key: "own", name: "他自己的"/, "没有「他自己的」这一档");
  // 两处都得默认 own：图标那一处和 widget 卡那一处，漏一处就半深半浅
  assert.equal((phone.match(/look\.iconPreset \|\| "own"/g) || []).length, 4, "默认还是跟她主屏同一套，或者只改了一部分");
  // 一人一个底色：同一个人永远同一个，不同人一定不同。
  // ⚠️这里核的是【行为】不是【色值】——她 2026-09-01 说「颜色太深了」，
  // 上一版把色值写死在断言里，调亮的时候测试红了却什么 bug 都没抓到。
  // 真正不许坏的只有两条：一人一色，以及上层跟着底走。
  assert.match(phone, /function phoneOwnPaper\(charId\)/, "没有按角色走的底色");
  const fnSrc = k => {
    const i = phone.indexOf("function " + k + "(");
    assert.ok(i >= 0, "找不到 " + k);
    return phone.slice(i).match(/^[\s\S]*?\n\}/)[0];
  };
  // 真跑一遍：同一个人两次一样，不同人一定不一样
  const mk = new Function(fnSrc("phoneHue") + "\n" + fnSrc("phoneOwnPaper") + "\nreturn phoneOwnPaper;")();
  assert.equal(mk("c_a"), mk("c_a"), "同一个人两次底色不一样");
  assert.notEqual(mk("c_a"), mk("c_b"), "不同人的手机长得一模一样");
  // ⚠️底和上层必须配套：底自成一套，widget 卡和图标线条就不能还用她那套彩釉，
  // 否则一半是他的色一半是她的色。核的是「own 走自己那一支」，不是走哪个色值。
  assert.match(phone, /wPreset === "own" \? "[^"]+" : tone\.wash/, "widget 卡没跟着换，字会看不清");
  assert.equal((phone.match(/preset === "own" \? phoneOwnInk\(char && char\.id\)/g) || []).length, 4,
    "图标线条／文字没跟着底走");
  assert.match(phone, /function phoneOwnInk\(charId\) \{ return "hsl\(" \+ phoneHue\(charId\)/, "墨色没跟着同一个色相走");
  // 四处外壳都得知道这是谁的手机——漏一处就露出她自己那张纸
  assert.equal((phone.match(/phonePaper\(char && char\.id, look\)/g) || []).length, 4, "有外壳没传主人，会露出她自己那张底");
  assert.ok(phone.indexOf("phonePaper()") < 0, "还有地方在用不认主人的那一版");
});

// 她 2026-09-01：「搜索键缩短放顶上时间那块地方，所以最顶部就留返回键、搜索框、
// 头像切换角色。把向左滑还有一页的字眼去掉」
test("顶栏只剩返回、搜索、头像", () => {
  assert.ok(phone.indexOf('fontWeight: 600, color: t.ink } }, new Date()') < 0, "顶栏还占着一格报时间");
  assert.match(phone, /placeholder: T\("在他手机里搜…"\)/, "搜索框没了");
  assert.equal((phone.match(/placeholder: T\("在他手机里搜…"\)/g) || []).length, 1, "搜索框有两处，并进顶栏时旧那条没删掉");
  // ⚠️那句话在注释里还留着（写清为什么删的），所以核【带引号的那个字符串】——
  // 也就是它还是不是一段会画到屏幕上的文案。
  assert.ok(!/"向左滑还有一页"/.test(phone), "那句话还在");
  // 最后一排图标不能被 dock 压住（多一格「外观」之后一眼看出来的）
  assert.match(phone, /paddingBottom: 104/, "底部没让开那排 dock");
  // 她 2026-09-01：「搜索框可以放长一点居中」。居中不是靠 margin 凑出来的，
  // 是靠【左右两侧等宽】——返回键和头像那两格都写死 34，中间 flex-1 自然居中。
  const bar = phone.slice(phone.indexOf('"aria-label": "返回通讯录"') - 400, phone.indexOf('"aria-label": "切换角色"') + 200);
  assert.equal((bar.match(/width: 34/g) || []).length, 2, "顶栏左右两格不等宽，搜索框不会居中");
  assert.match(bar, /className: "flex-1 min-w-0 flex items-center"/, "搜索框没占满中间那段");
});

// 她 2026-09-01：「为啥第一个的阿屿用的还是旧的 codex 那套，你之前改深色他也没动」。
// 病不在色值，在【默认值只对没存过的人生效】：外观页点一下预览卡就写进了存储，
// 那个人从此被钉死在当时的默认上，后面改默认跟他无关。
test("换默认值要能落到已经存过的人身上，不是只对新人生效", () => {
  // ① 一次性把 iconPreset 清掉，并且只清这一栏
  assert.match(phone, /function phoneLooksBoot\(\)/, "没有这一次性的清理");
  const start = phone.indexOf("function phoneLooksBoot()");
  const boot = phone.slice(start, phone.indexOf("\n}", start) + 2);
  assert.match(boot, /delete one\.iconPreset/, "清的不是 iconPreset 这一栏");
  assert.ok(!/delete one\.(lockWallpaper|homeWallpaper|icons)/.test(boot), "把她真上传的壁纸／图标也清掉了");
  // ② 只跑一次，不能每次开机都把她后来选的又抹平
  assert.match(boot, /loadJSON\("x_lookPresetReset", false\)\) return raw/, "没有只跑一次的闸");
  assert.match(boot, /saveJSON\("x_lookPresetReset", true\)/, "跑完没记下来，下次开机还会再抹一遍");
  assert.match(phone, /useState\(phoneLooksBoot\)/, "写了清理但没人调用");
  // ③ 「恢复默认」不许把当前默认值再抄一遍——抄了就是第二处要跟着改的地方
  const rst = phone.slice(phone.indexOf("恢复这一部手机的默认外观") - 700, phone.indexOf("恢复这一部手机的默认外观"));
  assert.match(rst, /iconPreset: ""/, "恢复默认写死了某一档，改默认时这儿会落下");
  ["main", "own", "soft", "mono", "glass"].forEach(k => {
    assert.ok(rst.indexOf('iconPreset: "' + k + '"') < 0, "恢复默认还钉着 " + k);
  });
});
