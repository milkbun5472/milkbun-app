// 拉黑期间他像背词机、四不像（群里 2026-10-04：「他像个背词机」「既不像人设也不像 char，就像外人一样」）
//
// 查下来三个推手，都在同一枪里：
//   ① 这一处是【自己拼 system 的第二处】：buildBundle 白得（人设全文/心情/好感/反八股），
//      但【单聊线上那一整套 ONLINE_CHAT_RULE_V2】是在聊天那个调用点另外 push 的——
//      它管的才是「像真人用手机说话」。拉黑这儿一个字没有，只用「短句多气泡」顶替。
//      （施工规则/four-surfaces-same-context：靠调用点 push 的那层，换个入口就一条都没有。）
//   ② 给了三选一的档（mutter=委屈/不在乎/嘴硬、angry=骂几句、appeal=想和好）＝掷答案，
//      三个全是现成的类型化演法，照着演就是「像外人」。
//   ③ 防复读写成了判决（「一句都不许再发」），又把他最近 6 句摆在眼前——
//      注意力全花在绕开上，话就硬得像背词。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");

const raw = (() => {
  const i = app.indexOf("  const blockedReaction = async");
  const j = app.indexOf("  // 我处理 TA 发来的解除申请", i);
  assert.ok(i > 0 && j > i, "抠不出 blockedReaction");
  return app.slice(i, j);
})();
// ⚠️把【注释行】剔掉再断言。今天在这个坑里栽了三次：
//   注释天生要把旧措辞原样写出来（「原来写成【一句都不许再发】」「只用一句「短句多气泡」顶替」），
//   拿整段去 grep，等于把【我解释病根的那句话】当成了违规证据，红得莫名其妙。
//   判「这句话还在不在」只能看真正发出去的那串，不能看注释。
const seg = raw.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("① 接上单聊线上那一整套（原来只有一句「短句多气泡」顶替）", () => {
  assert.match(seg, /\+ ONLINE_CHAT_RULE_V2 \+/, "拉黑这一枪没吃到线上即时通讯那一层");
  assert.ok(!/短句多气泡/.test(seg), "那句顶替用的话该撤了，别和正规那层打架");
});

test("② 三选一的「演法」换成掷轴；mode 只用来归档", () => {
  assert.ok(!/mutter=自言自语碎碎念\(委屈\/不在乎\/嘴硬\)/.test(seg), "类型化演法不许回来");
  assert.ok(!/angry=生气骂几句/.test(seg));
  assert.match(seg, /说完之后给这一轮归个档填进 mode/, "mode 要降级成记录，不是让他挑一种演");
  assert.match(seg, /只有真想和好才填/, "appeal 会真发申请卡，得说清后果");
  // 轴本身
  const i = seg.indexOf("const BLOCK_AXES = ["), j = seg.indexOf("const _blkRolled");
  assert.ok(i > 0 && j > i, "抠不出 BLOCK_AXES");
  const axes = seg.slice(i, j);
  assert.ok((axes.match(/key: "/g) || []).length >= 4, "至少四条轴才搭得出组合空间");
});

test("③ 掷轴走公共件，不许再就地现写一份", () => {
  assert.match(seg, /window\.Axes\.roll\(BLOCK_AXES/, "要走 js/axes.js");
  assert.ok(!/const _pick = arr => arr\[Math\.floor\(Math\.random/.test(app),
    "全库不许再有就地现写的掷法——公共件早就有了（施工规则/one-public-mechanism）");
});

test("④ 朋友圈那处也搬到公共件了（上一轮我现写的那份是违规的）", () => {
  const i = app.indexOf("  const genMoment = async char =>");
  const j = app.indexOf("const content = String(d && d.content", i);
  const mom = app.slice(i, j);
  assert.match(mom, /window\.Axes\.roll\(MOMENT_AXES/, "朋友圈也要走公共件");
});

test("⑤ 防复读给出口，不给判决", () => {
  assert.ok(!/一句都不许再发/.test(seg), "判决式禁令不许回来");
  assert.match(seg, /往前挪了一步之后才会有的话/, "要说清往哪走，不是只说不许");
  assert.match(seg, /时间过去了、你做了点别的、想法变了、或者你决定不说了/, "要给出口");
});

test("⑥ 真跑：轴每次不一样，而且常有一条还给模型", () => {
  const Axes = require("../js/axes.js");
  global.window = global.window || {}; global.window.Axes = Axes;
  const i = app.indexOf("      const BLOCK_AXES = ["), j = app.indexOf("      const raw = await callAI(apiFor(charId), blockBundleFor");
  const code = app.slice(i, j);
  const seen = new Set(); let free = 0;
  for (let n = 0; n < 300; n++) {
    const out = new Function("charId", "saidWhileBlocked", "window", code + "\nreturn _blkAxes;")("c" + n, { length: n }, global.window);
    seen.add(out);
    if (out.includes("你自己想") || out.includes("没有给你任何限制")) free++;
  }
  assert.ok(seen.size > 40, "300 次只掷出 " + seen.size + " 种，组合空间太小");
  assert.ok(free > 120, "300 次只有 " + free + " 次把某一轴还给模型，关门关太死");
});
