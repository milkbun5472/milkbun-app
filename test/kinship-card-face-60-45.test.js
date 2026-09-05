const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const face = comp.slice(comp.indexOf("function KinshipCardFace("), comp.indexOf("function KinshipIssueCard("));

// 她 2026-09-02：「亲属卡这两边长不一样，而且你改之后的还是略平淡和别的样式差不多。
//                 然后从亲属卡页面进入角色亲属卡之后退出是直接回到钱包那里」。

test("卡底整块不透明——「两边长不一样」是颜色在骗眼睛，不是布局", () => {
  // 量下来卡面和签名条左右边一模一样（16→268）。真凶是往半透明色插值的渐变：
  // 右半张卡跟着半透明，页面底色透上来，看着就是一边短了。
  assert.ok(!/linear-gradient\(118deg," \+ ink \+ " 0%, rgba\(0,0,0,\.42\)/.test(face),
    "又写回半透明卡底了");
  assert.match(face, /background: ink, color: "#fff"/, "卡底得是不透明的实色");
  // 暗角改成压在上面的一层，不许再混进卡底
  assert.match(face, /position: "absolute", inset: 0[\s\S]{0,120}linear-gradient\(118deg/);
});

test("阴影不许只往一边糊", () => {
  const m = face.match(/boxShadow: "0 (\d+)px (\d+)px/);
  assert.ok(m, "找不到阴影");
  assert.ok(Number(m[1]) <= 1, "y 偏移一大，下半张卡就糊出一条灰边，看着像那一边更长");
  assert.ok(Number(m[2]) <= 10, "糊得太开，边界就说不清了");
});

test("这张卡换个角色就整个变样——搬不去别的 app", () => {
  // tabs-not-plain-pills 那把尺子：原样搬到另一个 app 还成立，就是写坏了。
  assert.match(face, /avatarSrcOf\(c\)/, "他的脸得在卡上，不然这张卡跟谁都没关系");
  assert.match(face, /const ink = c\.color \|\| /, "卡底是他的颜色");
  // v63.01 no-english-titles：「副卡 · SUPPLEMENTARY」那半英文是装饰，
  // 中文那半已经把这张卡是什么说清楚了
  assert.match(face, /"副卡"/, "它在现实里就是【开在别人账上的副卡】");
  assert.ok(!face.includes("SUPPLEMENTARY"), "旧那半英文还在");
  // 签名条：真卡背面那条，他的话签在上面
  assert.match(face, /repeating-linear-gradient/, "签名条的斜纹没了，就又是一张普通卡片");
  assert.match(face, /"「" \+ note \+ "」"/, "他开卡时说的那句话得签在条上");
});

test("三处共用同一张卡面，不许各画各的", () => {
  // 聊天里那张 / 钱包汇总页 / 单卡账单页
  assert.match(comp, /h\(KinshipCardFace, \{ character: c, limit: m\.limit/, "聊天里那张");
  assert.equal((scr.match(/h\(KinshipCardFace, \{/g) || []).length, 2, "钱包两页都要用这一张");
  // 老那张通用渐变银行卡一处不留
  assert.ok(!/亲属卡 · KINSHIP/.test(scr), "中英对照的通用银行卡还留着");
  assert.ok(!/linear-gradient\(135deg," \+ \(c\.color/.test(scr), "老卡面还在");
});

test("头像取图那段抽出来共用，别在卡面里再抄一份", () => {
  assert.match(comp, /function avatarSrcOf\(character\)/);
  const av = comp.slice(comp.indexOf("function avatarSrcOf"), comp.indexOf("function Avatar({"));
  assert.match(av, /resolveImg/, "iv_ 键得换成 objectURL");
  assert.match(av, /autoAvatarSrc/, "没设过头像的要退到程序化那张");
  assert.match(av, /avatarEmoji/, "emoji 头像没有图，得返回空");
});

test("从亲属卡汇总点进某张卡，退回来还站在汇总页", () => {
  // mobile-ui-layout 第 3 条：进详情前记住位置，退回来恢复。
  // 原来 view 是 MyWallet 自己的 useState，进详情页组件卸载，退回来重挂成 main（钱包首页）。
  assert.match(scr, /function MyWallet\(\{ balance, log, cards, characters, onBack, onSetBalance, onOpenCard, view, onView \}\)/,
    "这一层还锁在组件自己肚子里");
  assert.ok(!/const \[view, setView\] = useState\("main"\)/.test(scr), "本地 state 还留着");
  assert.match(app, /const \[walletView, setWalletView\] = useState\("main"\)/, "app 那头没接着");
  assert.match(app, /view: walletView,\n    onView: setWalletView,/, "没传下去");
});
