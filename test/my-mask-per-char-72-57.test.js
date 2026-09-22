// 她 2026-09-22 转群里读者（宁溪）：「问问，是只能一个 user 面具吗？」
//
// 原来全 App 只有一张「我的面具」（x_profile），所有角色看到的都是同一个我。
// 现在每个角色可以单独盖一张：名字、人设各自可空，空着就跟着主面具走。
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
const profileFor = (settings, profile) =>
  new Function("settingsFor", "profile", "return " + src.slice(src.indexOf("charId =>")).replace(/;$/, ""))(
    () => settings, profile)("c1");

const MAIN = { name: "Lisa", persona: "主面具", avatarImage: "iv_x" };

test("两栏各自可空：只换名字、只换人设、都换、都不换", () => {
  assert.equal(profileFor({}, MAIN), MAIN, "没设过就该原样把主面具还回去（换个对象会让整棵树白重渲染）");
  assert.deepEqual(profileFor({ meName: "小鱼" }, MAIN), { name: "小鱼", persona: "主面具", avatarImage: "iv_x" });
  assert.deepEqual(profileFor({ mePersona: "只是个学生" }, MAIN), { name: "Lisa", persona: "只是个学生", avatarImage: "iv_x" });
  assert.deepEqual(profileFor({ meName: "小鱼", mePersona: "学生" }, MAIN), { name: "小鱼", persona: "学生", avatarImage: "iv_x" });
  // 空白字符不算填过
  assert.equal(profileFor({ meName: "  ", mePersona: "\n" }, MAIN), MAIN, "空白也被当成设过了");
  // 没盖到的字段照旧跟着主面具（头像、参考照这些没分开）
  assert.equal(profileFor({ meName: "小鱼" }, MAIN).avatarImage, "iv_x");
});

// ⚠️只在一处合成：ctxFor 是单聊线上/线下、通话、日记、查手机、穿书、匿名箱、解梦馆共用的口子
test("接在 ctxFor 那一口上，八处一起有了", () => {
  const i = app.indexOf("  const ctxFor = (char, ctxOpts) => ({");
  const seg = app.slice(i, app.indexOf("\n  });", i));
  assert.match(seg, /profile: profileFor\(char\.id\),/, "ctxFor 还在喂主面具");
  assert.ok(!/\n    profile,\n/.test(seg), "旧的那一行还留着");
});

// 【四处一样喂 · 差异登记】群聊是显式的差异，不是忘了
test("群聊那一支是写明理由的差异，不是漏掉", () => {
  assert.match(src.length ? app : "", /群里大家都在场，同一句话没法对着不同的人戴不同的脸|同一句话不可能对着不同的人戴不同的脸/,
    "群聊为什么不给，代码里没写明理由");
});

test("在 TA 自己的设置里切换，而且两栏都存得下来", () => {
  assert.match(comps, /show\("know", \{ title: "我在 " \+ cNm \+ " 面前是谁"/, "入口不在「TA 知道什么」那一类里");
  assert.match(comps, /const \[meName, setMeName\] = useState\(settings\.meName \|\| ""\);/, "没读回存档");
  assert.match(comps, /const \[mePersona, setMePersona\] = useState\(settings\.mePersona \|\| ""\);/, "没读回存档");
  assert.match(comps, /\n      meName,\n      mePersona\n    \}\)/, "保存时没带上这两栏");
  assert.match(comps, /"都清掉，跟着主面具"/, "没有一键回到主面具");
  // 落盘那头也得接住这两栏（app.js 那张白名单漏一项，点了保存就变回去）
  assert.match(app, /meName: String\(s\.meName \|\| ""\)\.trim\(\)\.slice\(0, 24\)/, "存档没接住名字那一栏");
  assert.match(app, /mePersona: String\(s\.mePersona \|\| ""\)\.trim\(\)\.slice\(0, 4000\)/, "存档没接住人设那一栏");
  // 界面上要说清它的射程，不然她会以为群里也换了
  assert.match(comps, /群聊一律用主面具/, "没说清群里不生效");
});
