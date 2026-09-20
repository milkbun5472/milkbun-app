// 线下记录存不了 20 万字（她 2026-09-20）。
//
// 病根在 durableTextNeedsLocalJournal：当初只把【单/群聊天】免掉了 localStorage 那份 journal，
// 理由写在它上面那行注释里——「可能远超 localStorage 的 5MB」。**线下剧情同样远超，却没跟上。**
// 于是一场线下长到某个大小之后：
//  ① localStorage.setItem 抛 quota，而那一行是 try {} catch (e) {}，一声不吭；
//  ② IDB/WAL 照常写进新版，可校验里那句 localStorage.getItem(k) === s 永远不成立；
//  ③ 赖在 localStorage 里的那份【旧 journal】，开机时被 hydrateTxtVault 当成新版搬回 IDB，
//     把后面写的全盖掉——表现就是「能存到某个大小，再写就回退到那个大小」。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

// 切片钉函数名，不钉注释（anchor-on-code.md）
function grab(name, end) {
  const i = eng.indexOf("function " + name);
  const j = eng.indexOf(end, i);
  assert.ok(i > 0 && j > i, "抠不出 " + name);
  return eng.slice(i, j);
}

test("线下跟聊天一样，不再要求 localStorage 也塞一整份", () => {
  const fn = grab("durableTextNeedsLocalJournal", "function _txtMirror");
  const needs = new Function(fn + "; return durableTextNeedsLocalJournal;")();
  // 这四类都可能远超 5MB
  assert.equal(needs("x_chat:c1"), false);
  assert.equal(needs("x_gchat:g1"), false);
  assert.equal(needs("x_offline:c1"), false, "线下还在写 localStorage journal——长到几十万字就会回退");
  assert.equal(needs("x_goffline:g1"), false, "群线下同病，也要一起免");
  // 其余核心文字键仍然三重核对，别顺手把保险一起拆了
  assert.equal(needs("x_memLib"), true, "记忆库的三重核对被拆掉了");
});

test("journal 写不进去不许再一声不吭", () => {
  // 那一行原来是 `catch (e) {}`：失败和成功看起来一模一样，这正是这个 bug 活这么久的原因
  assert.match(eng, /catch \(e\) \{ console\.error\("local journal skipped \(quota\?\):", k, s\.length\); \}/,
    "journal 写失败又变回静默了");
});

test("开机时，赖在 localStorage 的老 journal 不许盖掉新数据", () => {
  const h = grab("hydrateTxtVault", "// 上次已经进 WAL");
  // 这几类以 WAL／IDB 现有那版为准
  assert.match(h, /if \(!durableTextNeedsLocalJournal\(k\)\) \{/, "开机迁移没认出这几类");
  assert.match(h, /const fromWal = await walGetRaw\(k\);/, "没拿 WAL 那版比对");
  assert.match(h, /if \(live != null && live !== s\)/, "没比对就搬，等于照旧拿旧的盖新的");
  // ⚠️老 journal 不销毁：挪进 IDB 存着备查（「先查还剩什么，别急着说没了」）
  assert.match(h, /idbTxtPut\("x_lsjournal_rescue:" \+ k \+ ":" \+ Date\.now\(\), s\)/, "老 journal 被直接删了");
  // IDB 和 WAL 都没有时，localStorage 那份是唯一一份——绝不能删
  assert.match(h, /live != null/, "IDB/WAL 空的时候把唯一一份删了");
});

test("救出来的老 journal 不进内存镜像", () => {
  // 镜像会被上云和导出整份带走（cloud.js 那一处 forEach），放进去等于把旧副本也推上去
  assert.match(eng, /String\(k\)\.indexOf\("x_lsjournal_rescue:"\) !== 0\) mir\.set\(k, v\)/,
    "救出来的旧副本混进镜像了，会跟着上云和导出");
});
