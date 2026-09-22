// 她 2026-09-22 转群里读者（宁溪）：「是只能一个 user 面具吗？」
// 她当轮定了形状：「在信息-我-我的面具那里添加人设，格式跟主面具一样，
//   然后可以设置切换哪个是主面具，然后再从他们设置里改谁知道我是谁」。
//
// 所以是【一个面具库】：每张面具跟主面具是同一套字段（同一份表单，不是抄一遍）；
// 库里可以指定哪一张是主；角色那头只做一件事——挑 TA 认识的是哪一张。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), comps = P("js/components.js");

const src = (() => {
  const i = app.indexOf("  const profileFor = charId => {");
  assert.ok(i > 0, "抠不出 profileFor");
  return app.slice(i, app.indexOf("\n  };", i) + 4);
})();
const run = (settings, masks, profile, primary) =>
  new Function("settingsFor", "masksRef", "profile", "maskPrimary",
    "return " + src.slice(src.indexOf("charId =>")).replace(/;$/, ""))(
    () => settings, { current: masks }, profile, primary || "")("c1");

const MAIN = { name: "Lisa", persona: "主面具" };
const M1 = { id: "mk_1", name: "小鱼", persona: "学生" };

test("角色认哪一张，就喂哪一张", () => {
  assert.equal(run({}, [M1], MAIN), MAIN, "没挑过就该是主面具，而且原样还回去（换对象会让整棵树白重渲染）");
  assert.equal(run({ maskId: "mk_1" }, [M1], MAIN), M1);
  // 那张被删了不许炸，也不许喂个 undefined 过去
  assert.equal(run({ maskId: "mk_gone" }, [M1], MAIN), MAIN, "指着一张已经删掉的面具时没回主面具");
  // 认的就是「现在当主的那一张」时，走主面具那一份（x_profile 是它的镜像）
  assert.equal(run({ maskId: "mk_1" }, [M1], MAIN, "mk_1"), MAIN);
});

// ⚠️只在一处合成：ctxFor 是单聊线上/线下、通话、日记、查手机、穿书、匿名箱、解梦馆共用的口子
test("接在 ctxFor 那一口上，八处一起有了", () => {
  const i = app.indexOf("  const ctxFor = (char, ctxOpts) => ({");
  const seg = app.slice(i, app.indexOf("\n  });", i));
  assert.match(seg, /profile: profileFor\(char\.id\),/, "ctxFor 还在喂主面具");
  assert.ok(!/\n    profile,\n/.test(seg), "旧的那一行还留着");
  // 群聊是写明理由的差异，不是漏掉
  assert.match(app, /同一句话没法对着不同的人戴不同的脸/, "群聊为什么不给，代码里没写明理由");
});

test("设为主面具只改「哪张是主」，绝不搬 id", () => {
  const i = app.indexOf("    onMakePrimary: id => {");
  assert.ok(i > 0, "没有设为主面具");
  const seg = app.slice(i, app.indexOf("\n    },", i));
  assert.match(seg, /setMaskPrimary\(id\); saveJSON\("x_maskPrimary", id\);/, "没记下哪一张是主");
  assert.match(seg, /setProfile\(next\); saveJSON\("x_profile", next\);/, "x_profile 这面镜子没跟着主面具走");
  assert.ok(!/map\(x => x\.id === id \?/.test(seg),
    "又去搬 id 了——小鱼一升主面具，本来认小鱼的角色会突然认成旧的那张脸");
  // 老存档里主面具不在库里：换过去之前必须先把它收进库，否则那张脸再也找不回来
  assert.match(seg, /if \(!maskPrimary\) \{/, "老存档那一路会把原来的主面具弄丢");
});

test("面具库只有一处写", () => {
  assert.match(app, /const saveMasks = next =>/, "没有公共那一处");
  assert.equal((app.match(/saveJSON\("x_masks",/g) || []).length, 1, "还有别处自己往 x_masks 里写");
  assert.match(app, /maskId: String\(s\.maskId \|\| ""\)\.trim\(\)\.slice\(0, 40\)/, "存档白名单没接住 maskId");
});

test("建改在「我的面具」那一页，且跟主面具同一份表单", () => {
  assert.match(comps, /const formOf = \(\) => Object\.assign\(\{\}, cur, \{/, "表单没抽成一处（格式相同该靠同一份表单保证）");
  assert.match(comps, /"＋ 新面具"/, "没有新建");
  assert.match(comps, /"设为主面具"/, "没有设为主面具");
  assert.match(comps, /"删掉这张"/, "没有删除");
  // 改了一半切走不许白改
  assert.match(comps, /const switchTo = id => \{\n\s*commit\(\);/, "切换之前没先存——改一半切走就白改了");
  assert.match(comps, /onSave\(f, \{ stay: true \}\)/, "顺手存那一下会把窗关掉");
  assert.match(app, /if \(opt && opt\.stay\) return;/, "app 那头没认这一下「只存不关」");
});

test("角色那头只挑，不再另开一套人设框", () => {
  assert.match(comps, /show\("know", \{ title: "TA 认识的是我哪一张"/, "入口不在「TA 知道什么」那一类里");
  assert.match(comps, /const \[maskId, setMaskId\] = useState\(settings\.maskId \|\| ""\);/, "没读回存档");
  assert.ok(!/setMePersona|mePersona/.test(comps), "上一版那两个自由输入框还留着——面具该在一处建，不是两处各写一套");
  assert.match(comps, /myMasks/, "面具库没递进来，挑都没得挑");
  assert.match(comps, /群聊一律用主面具/, "没说清群里不生效");
});
