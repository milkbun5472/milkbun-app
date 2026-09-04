// 动念分对象（她 2026-09-04：「给 cp 而不是我涨进度那里」）
//
// v62.12 之前全 app 每个角色只有【一份】思念，而且 getLastMessage 读的永远是
// 他跟 Lisa 的那段聊天。于是在两个角色自己聊的那种群里，
// 「他动念满了」的真实含义是「他好久没跟 Lisa 说话了」——
// 拿这个信号去驱动她俩自己聊起来，语义正好是反的：
// **她越是不理他，他越会跑去找他对象。**
//
// 现在按【场】分：场 = 跟 Lisa 的私聊，或某一个群；各场各涨各的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const code = s => s.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
// 只切这一个函数：切宽了会漏进隔壁 dongnianTickOne，那边有一模一样的句子，
// 于是「这一处被改坏了」照样能被隔壁那句喂饱（变异验证时抓到过）。
const fnBody = head => {
  const i = app.indexOf(head);
  assert.ok(i > 0, "找不到 " + head);
  const j = app.indexOf("\n  };", i);
  assert.ok(j > i, head + " 没有收尾");
  return app.slice(i, j);
};

test("引擎按场分：私聊那一份的存档键不许改名，群那一份才加后缀", () => {
  assert.match(app, /const dongnianKey = \(charId, gid\) => gid \? charId \+ "@" \+ gid : charId;/,
    "没有分场的键；或者私聊那一份也被加了后缀——那等于 x_jiwen 里在涨的全体失忆");
  // 引擎、存档读写全都得跟着按场走，少一处就是几个场共用一份状态
  const g = fnBody("const getDongnian = (");
  assert.match(g, /if \(dongnianRef\.current\[dnKey\]\) return dongnianRef\.current\[dnKey\]/, "缓存的引擎还按 charId 取");
  assert.match(g, /dongnianRef\.current\[dnKey\] = eng/, "引擎实例还按 charId 存——两个场会拿到同一个引擎");
  assert.match(g, /\)\[dnKey\] \|\| null/, "onLoad 还在读 charId 那一格");
  assert.match(g, /m\[dnKey\] = st/, "onSave 还在写 charId 那一格");
});

test("群那一场读的是群聊记录，不是他跟 Lisa 的聊天", () => {
  const g = fnBody("const getDongnian = (");
  assert.match(g, /gid \? groupChatsRef\.current\[gid\] : chatsRef\.current\[char\.id\]/,
    "getLastMessage 又只读私聊了——这正是「她越不理他、他越去找对象」那个病");
});

test("巡检认领的是【这个群】那一份，而且人均 25 分钟的闸还在", () => {
  const i = app.indexOf("let urgeChars = [];");
  assert.ok(i > 0, "群自发巡检那一段没了");
  const seg = app.slice(i, i + 1600);
  assert.match(seg, /window\.__dongnian\[dongnianKey\(c\.id, gid\)\]/, "还在读他跟 Lisa 那一份");
  assert.doesNotMatch(code(seg), /__dongnian\[c\.id\]/, "还留着按 charId 直取的老路");
  assert.match(seg, /getDongnian\(c, gid\)/, "泄压泄的是私聊那一份，群里那份永远降不下来→会一直刷");
  // 闸按【人】算：他刚在群里开过口，就不该同一分钟又来私聊找她（她按次计费）
  assert.match(seg, /dongnianFiredRef\.current\[c\.id\] \|\| 0\) >= 25 \* 60000/, "人均冷却闸没了");
});

test("tick 一层只有一份实现，且群也跑得到", () => {
  assert.equal((app.match(/eng\.tick\(chunk\)/g) || []).length, 1,
    "漂移/补记那段被抄成了两份——这个仓库最常犯的错就是第二处没跟上");
  const i = app.indexOf("const dongnianTickOne = async (char, gid, now)");
  assert.ok(i > 0, "没有那个按场推一步的公共函数");
  const loop = app.slice(app.indexOf("for (const char of characters) await dongnianTickOne"), app.indexOf("for (const char of characters) await dongnianTickOne") + 700);
  assert.match(loop, /dongnianTickOne\(char, null, now\)/, "私聊那一场没跑");
  assert.match(loop, /dongnianTickOne\(c, group\.id, now\)/, "群那几场没跑——分了场却没人推，进度条永远是 0");
  assert.match(loop, /groupsRef\.current/, "读的是闭包里的 groups，setInterval 里会一直拿到旧值");
  assert.match(loop, /gs\.memoryInterop/, "闭群也算了——它本来就不自发聊，白占存档");
});

test("群里「有人理他了」才清零，他自己说话不算", () => {
  const seg = fnBody("const dongnianTickOne = async (char, gid, now)");
  // 这一段自己也要读对场：读私聊的话，「有没有人说过话」和「谁最后开的口」两件事都判错
  assert.match(seg, /const arr = \(gid \? groupChatsRef\.current\[gid\] : chatsRef\.current\[char\.id\]\) \|\| \[\];/,
    "推进这一段又只读私聊了");
  assert.match(seg, /m\.role === "assistant" && String\(m\.senderId \|\| ""\) !== String\(char\.id\)/,
    "没把「是不是别人说的」判清楚——他自己刷屏就会把自己的思念清零");
  assert.match(seg, /m\.kind === "ooc" \|\| m\.kind === "system"/, "OOC/系统行也被当成有人开口了");
});

test("她看得见别的场那几份（功能在不在，和她找不找得到是两件事）", () => {
  assert.match(app, /dongnianElsewhere:/, "没往设置页传");
  assert.match(comp, /const renderDongnianElsewhere = \(\) => \{/, "设置页没有这一段");
  // 跟他没私聊过正是最该看的时候——那一路早退的话这几根条会跟着消失
  const gStart = comp.indexOf("const renderDongnianGauge");
  const gauge = comp.slice(gStart, comp.indexOf("const dispRow", gStart));
  assert.equal((gauge.match(/renderDongnianElsewhere\(\)/g) || []).length, 2,
    "只在有私聊动念时才画——跟他没聊过的那种人反而看不到");
});
