// 她 2026-08-31：「查手机微信不是会跳过已经有的人吗，但是换了个名字就认不出来
// 又造了一个……比如人设里写着 scar 和 prim 是双暗恋，但我建角色时写了 prim 全名，
// 所以现在查 scar 微信能看到 prim 实时互通的记录外加一个假的 prim」。
//
// 病根：避重是把【真实会话的名字】原样发过去让模型自己认。「Prim」和
// 「Prim Whitlock」在模型眼里就是两个人，它照着人设里的叫法造了第二个。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const P = require("../js/phone.js");
const app = R("app.js"), ph = R("phone.js");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };

test("别名认得出是同一个人", () => {
  // 她那个例子：拆词之后精确相等，不靠包含
  assert.equal(P.phoneSamePerson("Prim", "Prim Whitlock"), true);
  assert.equal(P.phoneSamePerson("prim  whitlock", "Prim"), true);
  // ⚠️这一条只有【拆词】才成立：整串「primqwhitlock」和「primwhitlock」互不包含，
  // 靠的是拆出来的 prim === prim。少了拆词这一步，中间名/称谓一夹就认不出来了。
  assert.equal(P.phoneSamePerson("Prim Q. Whitlock", "Prim Whitlock"), true);
  // 中文两字名后头挂个称呼
  assert.equal(P.phoneSamePerson("陆闻", "陆闻那个嘴碎编修"), true);
  assert.equal(P.phoneSamePerson("裴照川", "裴照川殿下"), true);
  // ⚠️最要紧的是【别并错】：多一个字多半是另一个人
  assert.equal(P.phoneSamePerson("苏晚", "苏晚晴"), false, "「苏晚」和「苏晚晴」被并成一个人了");
  assert.equal(P.phoneSamePerson("小晚", "苏晚"), false);
  assert.equal(P.phoneSamePerson("Scar", "Prim"), false);
  // 单字不参与比对——「川」谁都能撞上
  assert.ok(P.phoneNameKeys("裴 照 川").indexOf("川") < 0, "单字也拿去比对了，会乱并");
  assert.equal(P.phoneSamePerson("", "Prim"), false);
  assert.equal(P.phoneSamePerson(null, undefined), false);
});

test("撞上真实记录的假联系人／假私聊，丢掉", () => {
  const d = {
    contacts: [{ name: "prim" }, { name: "陆闻" }],
    chats: [{ type: "private", name: "Prim" }, { type: "group", name: "Prim 他们那个群" }, { type: "private", name: "王掌柜" }]
  };
  const out = P.phoneDropDupWechat(d, ["Prim Whitlock"]);
  assert.deepEqual(out.contacts.map(x => x.name), ["陆闻"], "假 prim 没丢掉");
  // 群不管：一个群里当然可以有已经认识的人，重的只可能是私聊
  assert.deepEqual(out.chats.map(x => x.name), ["Prim 他们那个群", "王掌柜"], "群被误伤，或假私聊没丢");
  // 备注那一栏也要认
  assert.deepEqual(P.phoneDropDupWechat({ contacts: [{ name: "某人", remark: "Prim" }] }, ["Prim Whitlock"]).contacts, []);
  // 没有 taken 就原样返回，别白折腾
  assert.equal(P.phoneDropDupWechat(d, []), d);
  assert.equal(P.phoneDropDupWechat(null, ["a"]), null);
});

// v59.36：「饭桌上的人」整个撤掉了（她 2026-09-01：「和谁吃还是不行去重不了，
// 不然我们想想直接换一个板块吧」）。那一栏的身份是模型现编的一个称呼——
// 「老周」和「周叔」在代码里没有任何办法认成一个人。**身份不稳的东西不该当主键。**
// 顶掉它的「送到别人那儿」按地址归拢，地址是会复用的，天生稳。
// 所以按叫法归并这件事只剩微信那一路（那儿有角色卡上的真名单可以对）。
test("那一栏撤了，按叫法归并只剩微信那一路", () => {
  assert.equal(typeof P.phoneDedupeByWho, "undefined", "撤掉的东西还挂在外面");
  assert.ok(ph.indexOf("phoneDedupeByWho") < 0, "代码里还留着没人用的那一份");
  assert.ok(ph.indexOf('secTitle("饭桌上的人"') < 0, "界面上那一格还在");
  assert.match(ph, /secTitle\("送到别人那儿"/, "顶掉它的那一格没做出来");
});

test("两道都接上了：提示词发别名，存之前再筛一遍", () => {
  // ① 提示词这一道
  const dg = cut(app, "  const phoneWechatDigest = char => {", "\n  };");
  assert.match(dg, /这几个人他手机里已经有了/, "避重没把「已经有谁」挑明");
  assert.match(dg, /不管你想用哪个名字称呼他们（全名、小名、人设里那种叫法、外号）/, "没说清换个叫法也不许再造");
  const taken = cut(app, "  const phoneTakenNames = char => {", "\n  };");
  assert.match(taken, /if \(c\.type === "group"\) return;/, "把群也算进去了，群里有熟人是正常的");
  assert.match(taken, /samePerson\(c\.name, o\.name\)/, "没顺着会话名把角色卡上的别名一起收进来");
  assert.match(taken, /add\(o\.name\); add\(o\.remark\)/, "备注那个叫法没收");
  // ② 代码这一道：规则只降概率
  const save = cut(app, "  const savePhoneApp = (charId, key, d) => {", "      saveJSON(\"x_phone\", n);");
  assert.match(save, /key === "wechat" && window\.PhoneKit/, "存之前没筛");
  // ⚠️钉的是「筛用的和提示词用的是同一份名单」，不是「写成一行」。
  //   v61.38 把名单提成 wxTaken 复用（合并之后还要再筛一次，见 phone-npc-dup-avatar-61-38），
  //   意思一点没变，这条却红了——那冻的是长相不是行为。
  const src = (save.match(/phoneTakenNames\(c0\)/g) || []).length;
  assert.ok(src >= 1, "名单不是从 phoneTakenNames 来的");
  assert.match(save, /dropDupWechat\(d, (phoneTakenNames\(c0\)|wxTaken)\)/, "筛的时候用的不是同一份名单");
  assert.match(save, /phoneMergeSaved\(key, cur\[key\], d/, "存的时候没并旧的");
  // 挂出去的那个全局
  assert.match(ph, /window\.PhoneKit = \{/, "PhoneKit 没挂出去，app.js 调不到");
});
