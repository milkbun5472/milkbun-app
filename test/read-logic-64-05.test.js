// 一起读的逻辑（她 2026-09-05：「我们先看看有没有逻辑bug还有我觉得有点单调」）。
//
// 通读一遍抓到四条，其中一条是【会丢数据】的：
//   ① 取批注那一步，注释说「不是本书的跳过，下次别的书消费」，
//      代码却在最前面无条件 done.push(row.id) —— 已经塞进「消费掉」的名单了。
//      于是在 A 书里点一次「取批注」，言秋给 B 书写的那几条当场消失。
//   ② 段号没有上限：超出这一页段数的批注存下来了，却永远匹配不到任何一段——
//      写进去就看不见（「过滤之后什么都不剩」那一种）。
//   ③ 提示词里塞了内容示范（三条批注 + 两条讲解），违反 prompt-no-content-samples。
//      这也正是她说「单调」的一半病根：写得越好的例子被抄得越狠。
//   ④ 三处闸问的是 props.active，拿去调的却是 bg（bgActive || active）——
//      只配了后台便宜线路的时候，明明能跑却被挡住。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = fs.readFileSync(path.join(__dirname, "..", "js", "read.js"), "utf8");
const code = read.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("取批注：别的书认领的那几条，一个字都不许动", () => {
  const seg = code.slice(code.indexOf("const pullYanqiuReplies = async function"), code.indexOf("const doAnnotate = async function"));
  // 先把全库所有书的 pending 收齐，才分得清「别的书的」和「谁都不认的」
  assert.match(seg, /const allPend = \{\};/);
  assert.match(seg, /\(loadBooks\(\) \|\| \[\]\)\.forEach\(function \(bk\) \{/, "只看了本书的 pending，分不出是别的书的还是垃圾");
  // 三条出路各自明确
  assert.match(seg, /if \(!pid \|\| !anns\.length\) \{ done\.push\(row\.id\); return; \}/, "空包不清掉会永远堆着");
  assert.match(seg, /if \(!pend\) \{ if \(!allPend\[pid\]\) done\.push\(row\.id\); return; \}/, "别的书认领的又被吃掉了");
  // ⚠️关键：done.push 不许再无条件出现在 forEach 的第一行
  assert.ok(!/rows\.forEach\(function \(row\) \{\s*done\.push\(row\.id\);/.test(seg),
    "又变回「先消费再判断」了——别的书的批注会当场消失");
  // 本书认领的那一路照旧收下并消费
  assert.match(seg, /done\.push\(row\.id\);\s*repliedPids\[pid\] = 1;/);
});

test("段号钳在这一页真有多少段里，不然写进去就看不见", () => {
  const seg = code.slice(code.indexOf("const pullYanqiuReplies = async function"), code.indexOf("const doAnnotate = async function"));
  assert.match(seg, /const cap = Math\.max\(1, \(pend\.paras \|\| \[\]\)\.length\);/);
  assert.match(seg, /const paraN = Math\.min\(cap - 1, Math\.max\(0, \(Number\(a\.para\) \|\| 1\) - 1\)\);/);
  assert.ok(!/const paraN = Math\.max\(0, \(Number\(a\.para\) \|\| 1\) - 1\);/.test(seg), "上限又没了");
});

test("提示词里一个内容示范都不许有（prompt-no-content-samples）", () => {
  // 原来那五条：三条批注示范 + 两条讲解示范。写得越好抄得越狠——
  // 每个角色的批注都长成同一个句式，那就是她说的「单调」。
  ["这人嘴上硬，心里早就软了", "换我早翻脸走人了", "一碗黄酒二两黄豆",
   "他嘴上说不在乎", "这里的『黄粱』是个典故"].forEach(function (x) {
    assert.ok(!read.includes(x), "旧的内容示范还在：" + x);
  });
  assert.ok(!/示例：/.test(code), "又写了「示例：」——格式说清楚就行，别举内容的例子");
  // 顺带那个坏字符：`old友` 是某次替换弄坏的，它一直在往提示词里发
  assert.ok(!/old友/.test(read));
  // 格式说明必须留着（那是【格式示范】，规矩明说可以留）
  assert.match(code, /格式为 `段<段号>：<批注>`/);
  assert.match(code, /`梗概：<用一句话概括本页发生了什么，接前情往下>`/);
  // 换成判据（规矩的原话：把示范换成【判据】和【维度】）
  assert.match(code, /这条批注遮住名字，还认得出是你写的吗/);
  assert.match(code, /不是拿来抄内容的/);
});

test("闸问的是【真正会被拿去调的那条线路】", () => {
  // 批注/讲解走 bg（bgActive || active），讨论走主 active——闸各按各的问
  // v64.07 多了一处：批注册底下那个「把这本记住」也走 bg
  assert.equal((code.match(/if \(!bg\) \{ props\.toast && props\.toast\("请先到设置配置 API"\); return; \}/g) || []).length, 5,
    "讲这页 / 讲这段 / 讲这句 / 批注 / 把这本记住，五处都该问 bg");
  const dis = code.slice(code.indexOf("const sendDiscuss = async function"), code.indexOf("const sendDiscuss = async function") + 600);
  assert.match(dis, /if \(!props\.active\)/, "讨论用的是主线路，闸不该改成问 bg");
  assert.match(dis, /discussReply\(props\.active/);
});

test("这一处的 maxTokens 一律开满（她点名 65535）", () => {
  assert.equal((code.match(/maxTokens: 65535/g) || []).length, 5);
  assert.ok(!/maxTokens: Math\.min\(/.test(code), "又出现了算出来的预算");
});
