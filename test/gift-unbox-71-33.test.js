// 她 2026-09-19 转小红书群里读者 Sunghoon 的建议：
//   「我想要角色送我东西，可不可以设计成开箱那种感觉？就是一开始是一个礼包的图案，
//     一点开就是你要的那个东西的名称，还有寄语」
//
// 查下来：盒子【本来就有】（牛皮纸盒身＋丝带＋蝴蝶结＋吊牌），掀盖那一档也有，
// 只是掀盖只给「她送他、已送达」那一路用。他送她的那一路是
// **盖子一直合着、名字却已经印在吊牌上**——既没有拆的动作，也没藏住东西，两头不靠。
// 寄语则是真的完全没有：gift 那条能力只有 name 和 price。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), comp = P("js/components.js");

const card = () => {
  const i = comp.indexOf("function GiftCard({"), j = comp.indexOf("function KinshipCardFace(", i);
  assert.ok(i > 0 && j > i, "抠不出 GiftCard");
  return comp.slice(i, j);
};

test("寄语一路通到底：能力字典 → 存档 → 卡面 → 喂回上下文", () => {
  assert.ok(app.includes('gift:{"name":"物品","price":数字,"note":"寄语，一两句，不填就没有"}'), "能力字典里没有 note");
  assert.match(app, /const postCharGift = \(charId, name, rawPrice, rawNote\) => \{/, "落盘那一步没收 note");
  assert.match(app, /item: \{ name, price, note \}/, "存档里没存 note");
  assert.match(app, /postCharGift\(charId, String\(parsed\.gift\.name\), parsed\.gift\.price, parsed\.gift\.note\)/, "解析那一步把 note 丢了");
  // 他自己写的那句，以后提起「那条围巾」时得知道自己说过什么
  assert.match(app, /你随盒子写的那张卡片：「/, "寄语没喂回上下文——他自己写的话自己不知道");
});

// ⚠️给例句就会被逐字抄走：十个角色寄十条围巾会写出同一句话
test("只说这一栏承担什么，不给例句", () => {
  // ⚠️窗口只圈【note 那一栏的说明】。v71.75 后面接了另一条（她没开口要也可以送），
  //   那一条里「这种时候该送什么」是在【点名一个模子】，跟这条要管的内容示范不是一回事。
  const i = app.indexOf("note 是你【随盒子附的那张小卡片】"), j = app.indexOf("她没开口要，你也可以自己给", i);
  assert.ok(i > 0 && j > i, "那段说明没了");
  // ⚠️只看真代码：中间那段病历注释里引着她的原话和被禁的写法，那些不是提示词内容。
  const seg = app.slice(i, j).split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  assert.ok(!/「[^」]{6,}」/.test(seg), "给了例句（prompt-no-content-samples）");
  assert.ok(seg.includes("空着比凑一句客套话强"), "没给「可以不填」那个出口，它会每次都硬凑一句");
});

test("他寄来的那一份，拆开之前吊牌上不许有名字", () => {
  const seg = card();
  assert.ok(/canOpen \? "给你的" : name/.test(seg), "盒子还封着，名字却印在吊牌上——等于没藏");
  assert.ok(/\(open && note\) \? h\("div"/.test(seg), "寄语没等拆开就露出来了");
  assert.ok(/onClick: \(\) => onOpenGift\(m\)/.test(seg), "点了没反应");
  assert.ok(seg.includes("点一下拆开"), "没告诉她这儿能点");
});

// ⚠️这一条是这次最容易写坏的地方：她存档里早就收下的那些礼物没有 opened 这个字段
test("已经收下过的那些礼物，不许一上线全变回没拆", () => {
  const seg = card();
  assert.ok(/Object\.prototype\.hasOwnProperty\.call\(m, "opened"\)/.test(seg),
    "拿 !m.opened 认封没封——过去每一份礼物都会变回未拆");
  assert.ok(/const open = toChar \? !!m\.delivered : \(!sealed \|\| !!m\.opened\)/.test(seg), "老礼物没被当成已拆");
  assert.ok(/opened: false/.test(app), "新寄来的那一份没标成封着的");
});

// 拆过就一直是开的：每次进来重新合上，它就从惊喜变成烦
test("拆开这件事记在那条消息上，而且只发生一次", () => {
  const i = app.indexOf("    onOpenGift: msg => {"), j = app.indexOf("\n    },", i);
  assert.ok(i > 0 && j > i, "抠不出 onOpenGift");
  const seg = app.slice(i, j);
  assert.ok(/x\.turnId === key/.test(seg), "认的是下标——删过消息、翻过旧的就会拆错那一盒");
  assert.ok(!/indexOf|\[i\]/.test(seg), "又按位置找回去了");
  assert.ok(/\{ \.\.\.x, opened: true \}/.test(seg), "没把拆开记下来");
});

test("她送他的那一路一个字都没动", () => {
  const seg = card();
  // 掀盖那一档原来就是给它用的：delivered 才掀
  assert.ok(/toChar \? !!m\.delivered/.test(seg), "她送他那一路的掀盖条件被改了");
  assert.ok(/const canOpen = !toChar &&/.test(seg), "她送出去的盒子也变成可以点开了");
  assert.ok(seg.includes("当面交到 TA 手上"), "她那一路的底注丢了");
});

test("盒子还是那个盒子：没另画一张卡", () => {
  const seg = card();
  ["蝴蝶结", "吊牌", "盒身"].forEach(x => assert.ok(seg.includes(x), "盒子被重画了，少了：" + x));
  // 只看真代码：那句「故意不挂 data-wk」的注释本身也含这串字
  const live = seg.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  assert.ok(!/data-wk="card"/.test(live), "又套回统一圆角卡面了——那会把这张画切坏");
  assert.ok(seg.includes("故意不挂"), "那句写着理由的注释被删了，下次又会有人给它套上圆角");
});
