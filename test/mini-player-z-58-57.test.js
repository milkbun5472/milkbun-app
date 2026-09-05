const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const comp = R("components.js");

// 她 2026-08-30：「跑团旧版的 x 没用删除不了」→「.55 根本没有确认框」。
// 查下来既不是删除坏了，也不是系统弹窗被屏蔽（别处的 confirm 她都用得好好的）：
// 是那颗可拖动的迷你播放器被她拖到了屏幕上半部，正好压在战役卡右上角的 ✕ 上。
// 播放器和跑团的全屏壳都是 zIndex 60，平级时后画的赢 —— 手指压根碰不到 ✕。
// 无头实测：✕ 中心 (353,272)，药丸停在 (142,257) 242×64，
// elementFromPoint 在那个点返回的是药丸；改成 45 之后返回的是 ✕。
const Z = (() => {
  const m = comp.match(/const MINI_PLAYER_Z = (\d+);/);
  assert.ok(m, "MINI_PLAYER_Z 没了——层级又散回各处写死");
  return Number(m[1]);
})();

test("悬浮播放器必须低于半窗和全屏 app 壳", () => {
  assert.ok(Z < 50, "半窗是 z-50，播放器压在半窗上会挡住它的按钮（同一个病）：现在是 " + Z);
  ["trpg.js", "theater.js"].forEach(f => {
    // v62.63 小剧场的壳外面套了一层 Object.assign（要把纸的底纹并进来），
    // 所以这里认「wrap: 后面不管有没有 Object.assign(」——判的是 z 序，不是写法。
    const m = R(f).match(/wrap: (?:Object\.assign\()?\{ position: "fixed", inset: 0, zIndex: (\d+)/);
    assert.ok(m, f + " 的全屏壳找不到 zIndex");
    assert.ok(Z < Number(m[1]), f + " 的壳是 " + m[1] + "，播放器 " + Z + " 压在它上面，页面上的按钮会被吃掉");
  });
});

test("播放器还是浮在普通界面之上——只是不再压全屏页", () => {
  assert.ok(Z > 0, "别把它压到正文底下去了");
  const mini = comp.slice(comp.indexOf("function MiniPlayer("), comp.indexOf("function MiniPlayer(") + 2600);
  assert.match(mini, /position: "fixed", zIndex: MINI_PLAYER_Z/, "播放器没用这个常量");
  assert.match(mini, /localStorage\.setItem\("x_miniPos"/, "还能拖动换位置这件事没了");
});

test("没人再自己写死 60 当层级——那正是撞车的那个数", () => {
  // 唯一的例外：主屏拖拽时那个跟着手指走的影子——它是 pointerEvents:"none"，吃不到点击
  const bad = comp.split("\n").filter(l => /zIndex: 60/.test(l) && !/pointerEvents: "none"/.test(l));
  assert.deepEqual(bad, [], "又有东西写死 zIndex 60，会和全屏 app 壳平级：\n" + bad.join("\n"));
});
