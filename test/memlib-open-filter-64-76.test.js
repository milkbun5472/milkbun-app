// 「他俩不认识，我也没提过对方」——那 v64.75 掐掉群回声就不是全部病因。
// 实测（Playwright 抓真实 system prompt）：漏进陆衍手机的是【没绑角色】的记忆库条目；
// 绑给沈屿白的那条一个字都没漏。所以规则本身是对的，缺的是【看得见】。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");

test("记忆库多一格筛子：只看「没绑角色」的那些", () => {
  assert.match(scr, /const isOpenToAll = e => !e\.charIds \|\| e\.charIds\.length === 0;/, "没有这个判据");
  assert.match(scr, /filter === "__open__" \? isOpenToAll\(e\)/, "筛子没接上");
  assert.match(scr, /\.concat\(\[\["__open__", null\]\]\)/, "脸条上没有这一格");
  assert.match(scr, /id === "__open__" \? "没绑角色"/, "这一格没有名字");
  assert.match(scr, /这些每个角色都看得见，包括跟这件事没关系的那些/, "没说清它意味着什么");
});

test("筛子只写一处：列表和计数用的是同一个 inScope", () => {
  // 原来列表那一行自己又抄了一遍同样的条件——加一档就得记得改两处
  assert.equal((scr.match(/filter === "all" \|\| !e\.charIds \|\| e\.charIds\.length === 0 \|\| e\.charIds\.includes\(filter\)/g) || []).length, 0,
    "还留着抄的那一份");
  assert.match(scr, /&& inScope\(e\)\n/, "列表没走 inScope");
});

test("按某个角色筛时，全员可见的照旧要出现", () => {
  // 他确实看得见它们——这一格不是权限，是「谁看得见」
  assert.match(scr, /: \(isOpenToAll\(e\) \|\| e\.charIds\.includes\(filter\)\)/, "按人筛时把全员可见的漏掉了");
});

test("引擎那条规则没动——它是有意的", () => {
  assert.match(eng, /\(!e\.charIds \|\| e\.charIds\.length === 0 \|\| e\.charIds\.includes\(charId\)\)/, "把「没绑角色＝全员可见」改掉了");
});
