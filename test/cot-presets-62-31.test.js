// v62.31 她 2026-09-04：「设置里的思维链你看看哪儿还在用，然后改一下预设的 prompt
// 因为我都是参考了别人的」
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const screens = R("screens.js"), engine = R("engine.js"), dream = R("dream.js"), fanfic = R("fanfic.js");
const cot = screens.slice(screens.indexOf("const COT_BUILTIN"), screens.indexOf("// 图像 API（角色自拍）设置"));

test("小稿真正在用的还是那四处，界面上的说明得跟这份名单对得上", () => {
  // 单人线下只有数字生命走（v52.66 起普通角色不注入）
  assert.match(engine, /const requestedCotT = isDigital \? cotThink\(/);
  // 群聊线下 / 同人文 / 梦境
  assert.match(engine, /const cotT = loadOfflineNoCotModels\(\)\.includes\(cotModelKey\) \? "" : cotThink\(/);
  assert.ok((fanfic.match(/cotThink\(/g) || []).length >= 2, "同人文那两处不能悄悄掉");
  assert.ok((dream.match(/cotThink\(/g) || []).length >= 4, "梦境那四处不能悄悄掉");
  // 说明里必须点名这四处，并且说清哪两处不走——她按了开关没动静时，
  // 「没轮到」和「坏了」长得一模一样（四处一样喂那条学到的）
  const desc = cot.slice(cot.indexOf("启用创作小稿"), cot.indexOf("当前模型"));
  for (const where of ["同人文", "梦境", "群聊线下", "数字生命"]) assert.ok(desc.includes(where), where + " 没写进说明");
  assert.match(desc, /普通角色的单人线下和所有线上聊天都不走这条/);
});

test("内置预设是从这个 app 自己的规矩里长出来的，不是通用 RP 模板", () => {
  assert.match(cot, /const COT_BUILTIN = \[/);
  for (const name of ["照人写", "专治八股", "贴着上一句"]) assert.ok(cot.includes(name), name + " 不见了");
  // 判据得真的写进去：回声、语域、成套话术、换个角色还成立
  for (const rule of ["回声", "语域", "成套话术", "换个角色还成立吗"]) assert.ok(cot.includes(rule), rule + " 这一条得写进去");
  // prompt-no-content-samples.md：只给判据和维度，不许给可以被逐字照抄的句子
  assert.doesNotMatch(cot, /如「|例如「|比如「/, "内置预设里不许出现可以照抄的例句");
  assert.doesNotMatch(cot, /空气中弥漫着|嘴角勾起/, "旧模板里那几句反面例句本身也会被抄，删掉了就别回来");
  // {{char}} / {{user}} 这两个占位是它的接口，替换在 cotThink 里
  assert.ok(cot.includes("{{char}}") && cot.includes("{{user}}"));
  assert.match(engine, /c\.think\.replace\(\/\\\{\\\{char\\\}\\\}\/g, charN\)/);
});

test("三套内置能点开就用，也能从下拉里载入", () => {
  assert.match(cot, /COT_BUILTIN\.find\(x => x\.name === name\)/, "下拉里选内置也得能载入");
  assert.match(cot, /h\("optgroup", \{ label: "内置" \}/);
  assert.match(cot, /COT_BUILTIN\.map\(function \(pr\)/, "三套要摆成可以直接点的");
  // 她自己存过同名的，以她那份为准
  assert.match(cot, /\(cfg\.presets \|\| \[\]\)\.find\(x => x\.name === name\) \|\| COT_BUILTIN/);
});

test("这一页的英文眉标顺手去掉了", () => {
  // no-english-titles.md：改到哪一页哪一页换掉
  assert.doesNotMatch(cot, /"PRESETS"|"HOW TO THINK"/);
});
