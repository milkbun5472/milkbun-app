// 她 2026-09-22 转群里读者：点开「一起读」是白屏 + 底下一条「启动出错了。点这里进入救援页」。
//
// 病根不是那一页本身，是【没有围栏】：React 渲染里抛一个异常，整棵树直接卸掉，#root 一空，
// engine.js 那道兜底守卫就以为是没启动起来，贴出那条红带——于是一页的一行错，看着像整个 App 挂了。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), engine = P("js/engine.js"), comps = P("js/components.js"), studio = P("js/theme-studio.js");

const guard = (() => {
  const i = app.indexOf("function ScreenBoundaryClass() {");
  assert.ok(i > 0, "没有围栏");
  // ⚠️它必须是【用到时才建】的：顶层写 class ... extends React.Component，
  //   在 app.js 比 React 先求值时会整个文件抛掉——来兜白屏的自己成了白屏的原因。
  assert.ok(!/^class ScreenBoundary extends/m.test(app), "围栏又写回文件顶层了");
  return app.slice(i, app.indexOf("\n}", app.indexOf("  render() {", i)));
})();

test("围栏真的拦得住，而且只包着那一页", () => {
  assert.match(guard, /static getDerivedStateFromError\(err\)/, "没有 getDerivedStateFromError，拦不住渲染异常");
  assert.match(guard, /componentDidCatch\(err, info\)/, "出事不留痕");
  assert.match(app, /h\(ScreenBoundaryClass\(\), \{ screen: screen, onBack: \(\) => setScreen\("home"\) \}, body\)/,
    "围栏没套在页面主体上（或者套错了层，把顶栏、底栏一起圈进去）");
});

test("换一页要把围栏重新支起来", () => {
  assert.match(guard, /componentDidUpdate\(prev\)/, "退回首页之后还挂着那张错误卡");
  assert.match(guard, /prev\.screen !== this\.props\.screen && this\.state\.err/, "重置的条件不对");
});

test("错误卡说人话，而且给得出两条路", () => {
  assert.match(guard, /出问题的只有这一页，别的地方和你的数据都好好的/, "没安抚——她看到白屏第一反应是数据没了");
  assert.match(guard, /"回首页"/, "没有回去的路");
  assert.match(guard, /rescue\.html/, "没有救援页那条路");
  assert.match(guard, /this\.state\.err && this\.state\.err\.message/, "不报是哪儿错了，下次还是只能猜");
});

// ⚠️写 x_errlog 的路只许有一条（engine.js 那个 log）
test("留痕走公共那一处，不另开一条写存档的路", () => {
  assert.match(engine, /window\.errLog = log;/, "engine 没把写日志的口子公开出去");
  assert.match(guard, /window\.errLog\("screen",/, "围栏没走公共那一处");
  assert.ok(!/localStorage\.setItem\("x_errlog"/.test(app), "app 里又自己写了一份 x_errlog");
});

// 同一轮的第二件事：点头像那张心声卡一个挂点都没有，页面 CSS 抓不住它
test("心声卡挂上了挂点，名单只有 ThemeStudio 那一份", () => {
  ["statecard", "statehead", "stateseen", "statevoice", "stateaff"].forEach(k => {
    assert.ok(comps.includes('"data-wk": "' + k + '"') || comps.includes('wk: "' + k + '"'), "心声卡少了挂点：" + k);
    assert.ok(studio.includes('["' + k + '", "'), "工作台的名单里没有：" + k);
  });
  // 外壳那一层走【转交】：值由调用点给，且每个调用点都传写死的名字
  //（theme-hooks-61-00 那条闸只认 `wk || undefined` 这一种转交写法）
  assert.match(comps, /"data-wk": wk \|\| undefined,/, "外壳那层不是转交写法，心声卡就挂不上自己的");
  assert.match(comps, /h\(CenterCard, \{ onClose: onClose, wk: "statecard" \}/, "心声卡没把自己的名字传给外壳");
});
