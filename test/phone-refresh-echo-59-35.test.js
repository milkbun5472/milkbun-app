const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const ph = R("phone.js"), app = R("app.js");
const K = require(path.join(__dirname, "..", "js", "phone.js"));

// ① 她 2026-09-01：「手动刷新了一下，刷新的时候没有提醒（我怀疑全部查手机每个 app
// 第二次以后都没有）」——对，就是全部。转圈只在【还没有数据】时才出现。
test("已经有内容的 app 重刷时，屏幕上看得出它在刷", () => {
  const i = ph.indexOf("function PhoneApp({");
  const view = ph.slice(i, ph.indexOf("function PhoneCarry(", i));
  assert.match(view, /const respin = loading && data \? h\("div", \{\s*\n\s*role: "status"/, "有内容时重刷还是一点动静都没有");
  assert.match(view, /"正在重新推演 " \+ zh/, "没说清正在做什么");
  assert.match(view, /这一步会调一次模型/, "没提醒这一下要花钱");
  // 旧内容不清空、也不被推下去：清了更像是坏了，推下去等于每次刷新页面跳一下
  assert.match(view, /renderPhoneModule\(appKey, data/, "重刷时把已有内容清掉了");
  assert.match(view, /"下面还是上一次的"/, "没说清下面那份是旧的");
  // ⚠️必须浮在最上面：满屏出血那几个 app 自己画顶栏，塞进正文会顶在它们顶栏上面
  assert.match(view, /position: "absolute", left: 12, right: 12, top: safeTop\(52\), zIndex: 30/, "没浮起来，会把别人的顶栏顶下去");
  assert.match(view, /className: "h-full flex flex-col relative"/, "外壳没定位，浮起来会跑到整个屏幕外面");
  assert.match(view, /\n  respin,\n/, "写了没挂上去");
});

// ② 她 2026-09-01：「想吃清单刷新完旧的什么时候想起它就没了」。
// 病不是「丢了」，是 schemaHint 里的占位说明被逐字抄回来当数据，把真话盖掉了。
test("模型把占位说明抄回来时，当它没写", () => {
  assert.equal(typeof K.phoneDropEchoes, "function", "没有这一道");
  const hint = '{"wish":[{"title":"想吃的东西","when":"什么时候会想起它"}],"tail":"最后一句"}';
  const out = K.phoneDropEchoes({ wish: [
    { title: "巷子深那家的冬阴功", when: "什么时候会想起它" },
    { title: "想吃的东西", when: "实验室冷气开得像停尸房的时候" }
  ], tail: "最后一句" }, hint);
  assert.equal(out.wish[0].when, "", "占位说明被当成真话存下来了");
  assert.equal(out.wish[0].title, "巷子深那家的冬阴功", "真话被误伤了");
  assert.equal(out.wish[1].title, "", "标题那栏的占位没洗掉");
  assert.equal(out.wish[1].when, "实验室冷气开得像停尸房的时候", "真话被误伤了");
  assert.equal(out.tail, "", "顶层那栏的占位没洗掉");
  // 只认全等：真话里碰巧含着占位词的不许被误伤
  const keep = K.phoneDropEchoes({ tail: "最后一句他也没说出口" }, hint);
  assert.equal(keep.tail, "最后一句他也没说出口", "只是含着占位词就被当成占位了");
  assert.match(app, /dropEchoes\(d, spec\.schemaHint\)/, "生成那一步没接上这道");
});

// ③ 洗成空之后，累积层不许拿空的去盖掉上一轮真写的那句
test("累积层里空的不许抹掉旧的", () => {
  const old = [{ title: "巷子深那家的冬阴功", when: "凌晨改完代码从楼里出来的时候" }];
  const fresh = [{ title: "巷子深那家的冬阴功", when: "" }];
  const out = K.phoneGrowList(fresh, old, 16, Date.now());
  assert.equal(out.length, 1, "同一条被算成两条了");
  assert.equal(out[0].when, "凌晨改完代码从楼里出来的时候", "上一轮真写的那句被空值抹掉了");
  // 新的有话说时，还是新的说了算
  const out2 = K.phoneGrowList([{ title: "同一样", when: "新的那句" }], [{ title: "同一样", when: "旧的那句" }], 16, Date.now());
  assert.equal(out2[0].when, "新的那句", "新的写了话却没盖过旧的");
});

// ④ 她 2026-09-01 又报了一次别名，然后说「不然我们想想直接换一个板块吧」。
// v59.35 我在提示词那一头加了「叫法要一模一样」——那只是降概率，主键还是模型
// 现编的一个称呼。v59.36 把整栏撤掉，换成按【地址】归拢：
// **身份不稳的东西不该拿来当一栏的主键**，这比再加一句围栏管用。
test("那一栏换成了身份稳的主键，不再靠围栏兜别名", () => {
  assert.ok(ph.indexOf("PHONE_SAME_NAME") < 0, "还留着那一版只能降概率的围栏");
  assert.ok(ph.indexOf("phoneSameNameBlock") < 0, "写了没人用的那一段还在");
  assert.ok(ph.indexOf('"together"') < 0 && ph.indexOf("data.together") < 0, "那一栏还在生成或渲染");
  assert.match(ph, /const feedMap = \{\}/, "顶掉它的那一格没按地方归拢");
});
