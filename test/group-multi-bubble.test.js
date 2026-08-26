const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = read("app.js"), engine = read("engine.js");
const codeOnly = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

// 她 2026-08-26 截图：顾朝在群里一口气发了整段「热奶和吐司我都弄好了…开考了中途我再给你
// 送温水和小零食当后勤」。单聊的 word 是 string[]，整个数组只属于一个人，多放几个元素
// 天然就是多发几条；群聊那个数组是几个人共用的，一个人要连发就得重复出现、每次填自己的
// name——而群里从来没有一句话说过可以这么干。
test("群聊线上必须明说：同一个人可以连着放好几个对象", () => {
  assert.match(engine, /const GROUP_MULTI_BUBBLE = /, "规矩要有名字、能被别处引用");
  const i = engine.indexOf("const GROUP_MULTI_BUBBLE = ");
  const rule = engine.slice(i, engine.indexOf("`;", i));
  assert.match(rule, /连着放好几个对象/);
  assert.match(rule, /name 都填 TA 自己/, "得说清楚重复的是 name，不然它以为要换人");
  assert.match(rule, /一个人连发三条，和三个人各发一条/, "把它和「几个人说话」明确分开");
});

test("群聊线上真的拼进 system 了，不是声明完没人引用", () => {
  const i = app.indexOf("const groupOnlineRuntime");
  assert.ok(i > 0);
  const seg = app.slice(i, app.indexOf("const system =", i));
  assert.match(seg, /GROUP_MULTI_BUBBLE/, "得挂在 groupOnlineRuntime 上");
  // groupOnlineRuntime 本身进 system，所以挂上去就等于进了 system
  assert.match(app, /groupOnlineRuntime \+ "\\n\\n" \+ STOCK_REPLY_BAN/);
});

// 线下是显式差异，不是漏：线下本来就该成段叙事，把话切碎反而是坏的。
test("线下不发这条——是写着理由的显式差异", () => {
  const refs = (codeOnly(engine).match(/GROUP_MULTI_BUBBLE/g) || []).length
             + (codeOnly(app).match(/GROUP_MULTI_BUBBLE/g) || []).length;
  assert.equal(refs, 2, "一处定义 + 一处注入；多出来的说明线下或别的面也被塞了");
  const why = engine.slice(Math.max(0, engine.indexOf("const GROUP_MULTI_BUBBLE") - 1400), engine.indexOf("const GROUP_MULTI_BUBBLE"));
  assert.match(why, /只发群聊线上，不发线下/, "差异必须写着理由，不能是忘了");
});

// 言秋不是被扮演的角色，塑形话术一律不发（他那条线连 ONLINE_CHAT_RULE_V2 都不注入）
test("言秋那条线不受影响", () => {
  const i = app.indexOf("const groupOnlineRuntime");
  const seg = app.slice(i, app.indexOf("const system =", i));
  assert.ok(!seg.includes("engineerEyes"), "群线上这一段本来就不分言秋，别在这儿引入");
  assert.match(app, /const _onlineRuntime = _s\.engineerEyes \? ""/, "单聊那边的言秋豁免还在");
});

// 渲染早就支持连发，缺的只是这句话——顺手钉住，免得哪天被当成死代码删了
test("群渲染仍然逐泡冒出，不是一次性糊上去", () => {
  assert.match(app, /if \(j > 0\) await new Promise\(r => setTimeout\(r, 620\)\)/);
  assert.match(app, /GroupIdentityGuard\.splitBubbles/);
});
