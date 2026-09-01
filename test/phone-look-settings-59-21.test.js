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
  // 一人一个底色：同一个人永远同一个，不同人一定不同
  assert.match(phone, /function phoneOwnPaper\(charId\)/, "没有按角色走的底色");
  assert.match(phone, /hsl\(" \+ hu \+ ",22%,26%\)/, "底色不是深的，跟她的浅纸分不开");
  // ⚠️底换深了，上层必须跟着换：widget 卡还用浅底专用的彩釉，就是黑字压深底
  assert.match(phone, /wPreset === "own" \? "rgba\(250,248,243,\.94\)" : tone\.wash/, "widget 卡没跟着换，字会看不清");
  assert.match(phone, /preset === "own" \? "rgba\(255,255,255,\.88\)"/, "图标线条没跟着换成浅色");
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
});
