// 公共版有人报修（她 2026-09-15 转来截图）：「老师把多段记忆总结成一段，这个功能好像有问题」。
// 截图里挑了 15 条碎片，按下「核对」，弹出「云服务未就绪，登录后再来」。
//
// 查下来不是坏了，是两件我们自己写错的事：
//  ① **那句提示是假话**。`Cloud.ready()` 的全部含义只是 supabase 那个 js 库加载起来了，
//     跟登没登录毫无关系——没加载上的人照着去登录，登完还是同一句，只能以为功能坏了。
//  ② **门口没有守卫**。事件层整条链都在云上，可聚类建议照常聚、碎片随便挑、按钮一直亮，
//     挑满十五条按下去才拒绝。白挑一遍比直接说不行更难受。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const screens = fs.readFileSync("js/screens.js", "utf8");
const cloud = fs.readFileSync("js/cloud.js", "utf8");
const live = screens.split("\n").map(l => l.split("//")[0]).join("\n");

test("ready() 确实跟登录无关——这是①的前提，别让它悄悄变了", () => {
  assert.match(cloud, /ready: \(\) => !!client,/,
    "ready() 的定义变了：它要是真的开始看登录态，下面那些文案就得跟着重写");
});

test("① 不许再说「登录后再来」", () => {
  assert.ok(live.indexOf("云服务未就绪，登录后再来") < 0,
    "那句假话又回来了——它把人支去做一件解决不了问题的事");
  assert.match(screens, /toast\("这台设备没跟云端接上（不是没登录，登录也解决不了）/,
    "报错要说真正那一条");
});

test("② 门口就要拦，不能等她挑完十五条", () => {
  assert.match(screens, /const \[cloudWhy, setCloudWhy\] = useState\(""\);/);
  assert.match(screens, /if \(!\(window\.Cloud && window\.Cloud\.ready\(\)\)\) \{ if \(alive\) setCloudWhy\("nolink"\); return; \}/);
  assert.match(screens, /const u = await window\.Cloud\.getUser\(\); if \(alive\) setCloudWhy\(u \? "" : "nologin"\);/,
    "接上了但没登录，跟压根没接上是两回事，说法也得是两种");
  // 两种情况各说各的，不许合成一句「云端不可用」
  assert.match(screens, /把碎片整理成事件要先登录云端/);
  assert.match(screens, /这台设备没跟云端接上，暂时整理不了事件/);
  // 那颗按钮在断线时根本不该出现
  assert.match(screens, /cloudWhy\n?\s*\? h\("div"[\s\S]{0,600}?: h\("button", \{ onClick: \(\) => setComposeOpen\(true\)/,
    "断线时「＋ 挑碎片整理成事件」还亮着，等于请人白挑一遍");
});

test("断线时不要再招手：聚类建议也一起收起来", () => {
  assert.match(screens, /\(!cloudWhy && sugs\.length\) \?/,
    "「帮你聚了 N 摞」照常显示，点开却走不通——那比没有建议更气人");
});
