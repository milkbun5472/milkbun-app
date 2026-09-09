// 主动私聊：保留反机械重复，允许普通开场，第三人素材保持归属。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), eng = R("engine.js");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };
const hint = cut(app, "【此刻·隔了一阵后主动开口】", "\n      : \"\";");

test("主动开场允许普通，撤掉逐句独特性与强制新鲜事", () => {
  // ⚠️清单本身就是模板：给了它就会在里头挑，而且总挑第一项
  assert.ok(hint.indexOf("优先从你此刻正在做的事、刚遇到的小事") < 0, "那张清单还在");
  assert.match(hint, /允许普通、简短/);
  assert.match(hint, /不要机械套用报备、关心、安排的固定流程/);
  assert.doesNotMatch(hint, /只有你、只有今天|就是没开口|这两种开口一律不许用/);
});

test("规则只降概率：他自己说过的开口原样发回去", () => {
  // 存
  const save = cut(app, "      if (opts.proactive && words.length) {", "\n      }");
  assert.match(save, /String\(words\[0\] \|\| ""\)/, "记的不是开口那一句");
  assert.match(save, /\.slice\(0, 6\)/, "没有上限，会越攒越长");
  assert.match(save, /cur\.filter\(x => x !== first\)/, "同一句会在名单里堆好几遍");
  assert.match(app, /saveJSON\("x_openers", n\)/, "只在内存里，重开就没了");
  assert.match(app, /setOpeners\(loadJSON\("x_openers", \{\}\)\)/, "开机不读盘");
  // ⚠️只记【主动】那一路：被动回复本来就该顺着她的话走，记下来只会误伤
  assert.match(save, /^      if \(opts\.proactive && words\.length\)/m, "被动回复也被记进去了");
  // 发
  const avoid = cut(app, "      const openerAvoid = (opts.proactive && _openLines.length)", "\n      const proactiveHint");
  assert.match(avoid, /最近的主动开场/);
  assert.match(avoid, /不为避重编造新事件/);
  assert.doesNotMatch(avoid, /一句都不许再用|换一个【别的东西】/);
  // ⚠️两处任务串都要接上——「一层写在两处，第二处没跟上」在这份文件里犯过太多次
  // v66.12 删掉了那条不再发送的 A/B 基线，现在只剩真正在跑的 _normalTaskV2 一处
  assert.equal((app.match(/callHint \+ proactiveHintAll \+ dongnianHint/g) || []).length, 1, "没接进真正在跑的那一串");
  assert.ok(!/callHint \+ proactiveHint \+ dongnianHint/.test(app), "还有一处用的是没带避重的那个");
});

test("真实主动提示拼接锁定收件人，第三人事实不转成用户经历", () => {
  const start = app.indexOf("      const proactiveHintAll =");
  const end = app.indexOf(';', start);
  const source = app.slice(start, end + 1);
  const run = new Function("opts", "uName", "proactiveHint", "openerAvoid", source + "\nreturn proactiveHintAll;");
  for (const opts of [{ proactive: true }, { proactive: true, promise: {} }, { proactive: true, bday: true }]) {
    const result = run(opts, "测试收件人", "开场", "历史");
    assert.match(result, /正在给「测试收件人」发私聊/);
    assert.match(result, /他们的身份、物品、经历和与你的共同生活，不属于收件人/);
    assert.match(result, /保留其姓名或明确称谓/);
    assert.match(result, /保持未知/);
    assert.ok(result.startsWith("开场历史"));
  }
  assert.equal(run({}, "测试收件人", "", ""), "");
});
