// 每周自动刷一次手机
//
// ⚠️不是闹钟：PWA 后台不跑代码，半夜没人替你调模型。真实含义是
// 「进入新的一周之后，第一次打开 App 或切回前台时补刷」——跟行程和钱包补账
// 同一个形状，靠「上次刷到哪一周」的游标防重复。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

const sweep = app.match(/const phoneWeeklySweep = async \(\) => \{[\s\S]*?\n  \};/);

test("靠周次游标防重复，不靠闹钟", () => {
  assert.ok(sweep, "找不到 phoneWeeklySweep");
  assert.match(sweep[0], /phoneWeekKey\(Date\.now\(\)\)/);
  // ⚠️v65.03 起这份周次游标搬进公共那把闸（AutoGate）：同一层规则原来活在三处，
  //   下次改必漏一处（她 2026-09-06：「这种形状都开公共然后合在一起」）。
  //   规矩一个字没变：这一周刷过就不再刷、先占坑再刷、maxTries 1 表示不重试。
  assert.match(sweep[0], /window\.AutoGate\.due\("phone\|" \+ c\.id, wk, \{ maxTries: 1 \}\)/, "没比对「这一周刷过没有」");
  // 代码里不许出现定时器式的写法
  assert.ok(sweep[0].indexOf("setTimeout") < 0 && sweep[0].indexOf("setInterval") < 0,
    "别用定时器——PWA 后台不跑代码，半夜那一拍根本不会响");
});

test("默认全关，一个一个角色自己开", () => {
  assert.match(app, /useState\(\{ on: \{\}, done: \{\} \}\)/, "默认不该是开的——她按次计费");
  assert.match(app, /liveChars\.map\(c => \[c\.id, autoRefreshOn\("phone", c\.id\)\]\)/, "开着没开着传不进查手机");
  // 开关只留在 设置 · 自动刷新 那一处（她 2026-09-06：「不应该那里有按钮，
  // 设置里面都已经开了一次了」）。同一个总闸两个手柄＝她在设置里开过之后，
  // 在通讯录那一行顺手一点就是关掉，而每周刷新一开就是十几次调用。
  assert.equal(phone.indexOf("onToggleAuto"), -1, "查手机那边又长出了第二个开关");
  assert.equal(app.indexOf("phoneAutoToggle"), -1, "撤掉的开关没删干净");
  assert.match(phone, /title: "每周自动刷新已开（在 设置 · 自动刷新 里改）"/, "那一行上看不出他开着每周刷新");
});

// 她 2026-08-31：「查手机我是想要和周刊那样一次性连续调用刷完阿屿的马上接下一个」。
// 原来一次唤起只补一个（省调用），但她当天报「就明确看到沈屿白的查手机刷新了其他都没动静」——
// 没轮到和坏了长得一模一样，而且开五个角色要来回切五次前台才刷得完。
test("一次唤起把这一周欠的全刷完，刷完一个接下一个", () => {
  assert.match(sweep[0], /for \(const due of pending\) \{/, "还是只挑一个刷");
  assert.ok(sweep[0].indexOf("pending[0]") < 0, "还留着「只取第一个」那一句");
  assert.match(sweep[0], /if \(!pending\.length\) return;/, "没人要刷的时候没有早退");
  // 周刊那条链的形状：一个人失手不拖垮后面几个
  const body = sweep[0].slice(sweep[0].indexOf("for (const due of pending)"));
  assert.match(body, /try \{[\s\S]*genPhoneAll\(due, true\)[\s\S]*\} catch/, "循环里没各自兜底,一个人抛了后面全不刷");
  assert.match(sweep[0], /phoneWeekRunRef\.current = true/, "没有并发闸，来回切前台会叠着跑");
});

// 一个人十几次串行调用，几个人要跑好一阵——中间那几分钟不摆出来就跟卡住一样
test("跑的时候看得见正在刷谁、刷到第几个", () => {
  assert.match(sweep[0], /setPhoneWeekAt\(\{ id: due\.id, name: due\.remark \|\| due\.name, i: done \+ 1, n: pending\.length \}\)/, "没报正在刷谁");
  assert.match(sweep[0], /setPhoneWeekAt\(null\)/, "跑完没收起来,会一直挂在那儿");
  assert.ok(sweep[0].indexOf("setPhoneWeekAt(null)") > sweep[0].indexOf("finally"), "收起来那一句没放在 finally 里,中途抛了就摘不掉");
  assert.match(app, /weekAt: phoneWeekAt,/, "没传进查手机");
  assert.match(phone, /weekAt \? h\("div", \{/, "那条进度带不是跟着 weekAt 出现的");
  assert.match(phone, /"每周刷新中 · 正在刷「" \+ weekAt\.name \+ "」"/, "通讯录上看不到在刷谁");
  assert.match(phone, /weekAt && weekAt\.id === c\.id \? "正在刷新……"/, "轮到谁了，那一行上看不出来");
  assert.match(phone, /weekAt\.i \+ "\/" \+ weekAt\.n/, "没说刷到第几个");
  // 每人刷完各弹一次会把最后那句「都刷完了」冲掉
  assert.match(app, /if \(!weekly\) toast\(ok === keys\.length/, "例行刷新时每个角色还各弹一次");
  assert.match(app, /return \{ ok: ok, total: keys\.length \};/, "没把成没成回给上一层,缺了几个 app 只能咽下去");
});

test("先记游标再刷：中途失败不会下次又整份重刷", () => {
  // ⚠️占坑必须在真正开刷【之前】：这一枪是十五次串行调用，中途关掉浏览器
  //   也不许下次开机整份重跑。AutoGate.claim 就是「先占住这一轮」那一档。
  const i = sweep[0].indexOf('AutoGate.claim("phone|"');
  const j = sweep[0].indexOf("genPhoneAll");
  assert.ok(i >= 0 && j >= 0 && i < j, "游标得在真正开刷之前落下");
  assert.match(sweep[0], /genPhoneAll\(due, true\)/, "没告诉生成侧这是例行刷新");
});

test("挂在三拍上，和行程那条链一样多", () => {
  // 「一层写在三处，第四处没跟上」是这个库反复犯的病，钱包刚栽过一次
  const mine = (app.match(/phoneWeeklySweep\(\)/g) || []).length;
  const sched = (app.match(/schedMaybeSelfRevise\(\)/g) || []).length;
  assert.equal(mine, sched, "每周刷新的挂点数和行程那条链对不上（自己 " + mine + " / 行程 " + sched + "）");
});

test("没配 API、没开开关、这周刷过了，都不动", () => {
  // 逐条钉住每一道闸，别把整行冻死——后来又多了一道总开关 autoRefreshOn("phone")，
  // 那是更严，不是更松，整行冻死的话每加一道闸这条测试就红一次
  const gate = sweep[0].slice(0, sweep[0].indexOf("\n", sweep[0].indexOf("return;")));
  assert.match(gate, /phoneWeekRunRef\.current/, "没防重入：一次唤起可能刷两遍");
  assert.match(gate, /!active/, "没配 API 也会往下走");
  assert.match(gate, /return;/);
  // 每个角色自己的开关：以前是 box.on[c.id]，后来并进了统一的 autoRefreshOn 策略。
  // 名字换了，规矩没换——默认全关、一个一个角色自己开（她按次计费）
  assert.match(sweep[0], /autoRefreshOn\("phone", c\.id\)/, "没按角色看开关，会把没开的人也刷了");
  assert.match(sweep[0], /window\.AutoGate\.due\("phone\|" \+ c\.id, wk, \{ maxTries: 1 \}\)/, "没看周次游标，这周刷过了还会再刷一遍");
  assert.match(sweep[0], /if \(!pending\.length\) return;/, "这一周谁都不欠的时候也往下走");
});
