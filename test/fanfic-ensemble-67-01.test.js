// 她 2026-09-11：「除了 cp 还可以写群像，有好几个人同时写进来，
//   然后可以选是友情向亲情向，修罗场，无 cp，还有啥别的类型的想不到了。」
// 三件要紧事：① 群像不许发左右位 ② 不是每个人都要出场 ③ 那四个向之外还得能自己写
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const fic = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic.js"), "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const code = strip(fic);
const grab = name => {
  const i = fic.indexOf("function " + name + "(");
  assert.ok(i > 0, "找不到 " + name);
  let d = 0, j = fic.indexOf("{", i);
  for (let k = j; k < fic.length; k++) { if (fic[k] === "{") d++; else if (fic[k] === "}") { d--; if (!d) { j = k + 1; break; } } }
  return fic.slice(i, j);
};
const box = { FIC_PERSONA_CAP: 3000, loadJSON: (k, fb) => fb };
vm.createContext(box);
vm.runInContext(grab("personaOf") + grab("sideDesc") + grab("worldIdentityLine") + grab("evenSidesLine") + grab("loveLine")
  + grab("cpBlock") + grab("groupWayOf") + grab("cpLabel")
  + "\nthis.M = { cpBlock, cpLabel, groupWayOf };", box);
const M = box.M;
const P = n => ({ name: n, persona: n + "的人设" });

test("群像一个字的左右位都不发", () => {
  const three = M.cpBlock([P("甲"), P("乙"), P("丙")], { groupWay: "修罗场" });
  ["左右位", "左攻右受", "左位", "右位"].forEach(w =>
    assert.ok(three.indexOf(w) < 0, "群像里发了「" + w + "」——等于替她在一群人里指定了一对"));
  // 两个人的照旧发：这一条是给 CP 的，别一起砍掉
  assert.match(M.cpBlock([P("甲"), P("乙")], {}), /左右位铁律/);
  assert.match(M.cpBlock([P("甲")], {}), /左右位铁律/, "一个人配原创对象也还是 CP");
});

test("群像那一段该说的都说了", () => {
  const g = M.cpBlock([P("甲"), P("乙"), P("丙"), P("丁")], { groupWay: "一个乐队，谁也不服谁" });
  assert.match(g, /【群像：甲、乙、丙、丁】/);
  assert.match(g, /\*\*不是一对 CP\*\*/);
  // 每个人的人设都得进去，不能只发前两个
  ["甲", "乙", "丙", "丁"].forEach(n => assert.ok(g.indexOf(n + "的人设") > 0, n + " 的人设没发"));
  // 她挑的那一向
  assert.match(g, /【这几个人之间是什么关系】一个乐队，谁也不服谁/);
  assert.match(g, /别自作主张在里头挑两个配成一对/);
  // ⚠️三个人以上模型的默认写法是点名册
  assert.match(g, /\*\*不是每个人都要出场\*\*/);
  assert.match(g, /那是通讯录不是故事/);
  assert.match(g, /不许几个人共用一种语气/, "人多了最容易丢的就是谁是谁");
  // 没挑向的时候不发一段空的，让它自己定
  assert.match(M.cpBlock([P("甲"), P("乙"), P("丙")], {}), /她没说——你自己定一种，定下来就别中途换。/);
});

test("那一向跟着这篇文走，续写第七章还是那一向", () => {
  // 新生成时是这一次挑的，续写／加笔时是这篇文自己带着的——只认这一处
  assert.equal(M.groupWayOf({ groupWay: "无 CP" }, null), "无 CP");
  assert.equal(M.groupWayOf({ groupWay: "无 CP" }, { groupWay: "修罗场" }), "修罗场", "这一次挑的该压过存档里那个");
  assert.equal(M.groupWayOf(null, null), "");
  assert.equal(M.groupWayOf({ groupWay: "  亲情向  " }, null), "亲情向");
  // 手上已经有 fic 的那几枪都得带上（续写 / 写长一点 / 请她回来）
  assert.equal(code.split("buildGenSystem(tab, cpChars, userName, worldbook, ficOpts(fic, opts))").length - 1, 3,
    "有三枪是拿着这篇文打的，少一枪带上那一向就少一处");
  // ⚠️只断源码里写着 ficOpts 是不够的：在某一枪里再定义一个同名的空壳，
  //   源码照样长这样，那一枪却什么都没带上。所以它只许有一处定义，而且真跑一遍。
  assert.equal(code.split("function ficOpts(").length - 1, 1, "ficOpts 被谁在自己那一枪里又定义了一遍");
  const F = {};
  vm.createContext(F);
  vm.runInContext(grab("groupWayOf") + grab("ficOpts") + "\nthis.f = ficOpts;", F);
  assert.deepEqual(Object.assign({}, F.f({ groupWay: "无 CP" }, { style: "x" })), { style: "x", groupWay: "无 CP" });
  assert.deepEqual(Object.assign({}, F.f(null, null)), { groupWay: "" });
  assert.ok(code.indexOf("buildGenSystem(tab, cpChars, userName, worldbook, opts) + \"\\n\\n\"") < 0,
    "还有一枪是光秃秃传 opts 的");
  // 加笔走同一个 cpBlock（v67.02 删掉魂穿之后，那一枪永远带着 includeMe）
  assert.match(code, /parts\.push\(cpBlock\(cpChars, ficOpts\(fic, \{ includeMe: true/);
  // 落在这篇文上，不然续写时无从读起
  assert.match(code, /cp: cp \|\| \[\], groupWay: String\(groupWay \|\| ""\)\.trim\(\)/);
});

test("名字：三个人以上不写成「A × B × C」", () => {
  const cs = [{ id: "a", name: "甲" }, { id: "b", name: "乙" }, { id: "c", name: "丙" }, { id: "d", name: "丁" }];
  assert.equal(M.cpLabel(["a", "b"], cs, "我"), "甲 × 乙");
  assert.equal(M.cpLabel(["a", "b", "c"], cs, "我"), "甲、乙、丙 群像");
  assert.equal(M.cpLabel(["a", "b", "c", "d"], cs, "我"), "甲、乙、丙 等 4 人 群像");
  assert.equal(M.cpLabel(["me", "a", "b"], cs, "丽莎"), "丽莎、甲、乙 群像");
  assert.equal(M.cpLabel([], cs, "我"), "原创向");
});

test("群像不进配对白名单：它不是她配过的一对", () => {
  const al = grab("allowedCPLabels");
  assert.match(al, /pair\.length >= 3\) return;/,
    "群像进了白名单，等于告诉模型「甲、乙、丙 群像」是她配过的一对，它照样会去凑对");
  // 一个人配原创的那种还留着——那本来就是一对
  assert.ok(al.indexOf("pair.length !== 2") < 0, "把「A × 原创」也一起砍了");
});

test("挑人那一格：点的先后就是顺序，三个以上才问向", () => {
  const gs = fic.slice(fic.indexOf("function GenSheet(props)"), fic.indexOf("  function FeedList") > 0 ? fic.indexOf("  function FeedList") : fic.length);
  assert.ok(gs.length > 2000, "没切到 GenSheet");
  assert.match(gs, /const \[cast, setCast\] = useState\(\[\]\);/);
  assert.match(gs, /if \(cast\.length >= 2\) return cast;/, "挑了人却不算数");
  assert.match(gs, /const isGroup = chosenCP\(\)\.length >= 3;/);
  // 三条路互斥：不清掉另外两条，界面上会同时亮着两处而只有一处算数
  assert.match(gs, /function pickCast\(next\) \{ setSel\(\[\]\); setPickA\(""\); setPickB\(""\); setCast\(next\); \}/);
  assert.match(gs, /setCast\(\[\]\); setSel\(on \? \[\] : cp\.cp\);/, "点预设不清群像");
  assert.equal(gs.split('setSel([]); setCast([]); setPick').length - 1, 2, "两个下拉没都清群像");
  // 群像时不给「带上我」：一群人里没有「他俩 × 我」这回事
  assert.match(gs, /\(!isGroup && twoRealChars\(\)\) \? h\("button"/);
  assert.match(gs, /props\.onConfirm\(n, chosenCP\(\), styleIds, !isGroup && twoRealChars\(\) && includeMe,/,
    "群像还是把「带上我」递了出去——那一枪会按「他俩 × 我」写");
  // 三个人以上才问那一向
  assert.match(gs, /isGroup \? h\("div", \{ style: \{ marginTop: 12 \} \}/);
  assert.match(gs, /isGroup \? way\.trim\(\) : ""\)/, "没挑群像却把那一向递了出去");
});

test("四个向之外永远留着一格自己写", () => {
  // 她原话：「还有啥别的类型的想不到了」——所以那一格不是「其它」选项，是常开的
  assert.match(code, /const GROUP_WAYS = \["友情向", "亲情向", "修罗场", "无 CP"\];/);
  assert.match(code, /placeholder: "或者自己写：同门、一个乐队、互相看不顺眼的同事…"/);
  const gs = fic.slice(fic.indexOf("function GenSheet(props)"));
  const from = gs.indexOf("GROUP_WAYS.map"), at = gs.indexOf('placeholder: "或者自己写');
  assert.ok(from > 0 && at > from);
  // 那四枚标签和这一格之间不许再夹一道开关：夹了就是「点『其它』才给你写」
  assert.ok(gs.slice(from, at).indexOf("? h(") < 0, "自己写那一格挂在某个「其它」档底下了——她想不到的那些就填不进来");
  assert.match(gs.slice(from, at), /h\("input", \{ value: way,/);
});

test("挑人不是一排勾选框，选中态也不只靠色", () => {
  const cp = grab("CastPicker");
  assert.match(cp, /background: on \? t\.ink : "transparent"/, "墨点：照名册那一页的署名行");
  assert.match(cp, /fontWeight: on \? 600 : 400/, "选中只换了个颜色");
  assert.match(cp, /minHeight: 44/, "点不着");
  assert.match(cp, /cast\.length === 2 \? \(at === 0 \? "左位" : "右位"\) : String\(at \+ 1\)/,
    "不把顺序显出来，她点完也不知道点出的是女左男右还是反过来");
  assert.match(cp, /cast\.length >= CAST_MAX \? cast : cast\.concat/, "没有上限，能点进二十个人");
  const wt = grab("WayTag");
  assert.match(wt, /ficTagStyle\(ficTagKind\(props\.tag\), t, false\)/, "另画了一套标签，没用这个 app 已有的那套");
  assert.match(wt, /on \? h\("span", \{ style: \{ fontSize: 11 \} \}, "✓"\) : null/, "选中态只有色差");
  assert.match(wt, /minHeight: 40/);
});
