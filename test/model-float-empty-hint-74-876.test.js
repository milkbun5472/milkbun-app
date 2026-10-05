// 浮窗开着却看不见旋钮（她 2026-10-05 截图：「这玩意显示不出来悬浮球」）
//
// 一条线路都没【存】的时候，设置页会先摆一张空白「未命名配置」——那张卡还没保存。
// 旋钮认的是存好的线路（ModelQuickSwitch：一条都没有就 return null），
// 于是看着有一条、其实一条都没有：开关亮着，旋钮安安静静地不出现。
// 不改旋钮的规矩（没线路可切本来就不该有它），只是把这件事说出来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const scr = fs.readFileSync("js/screens.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");

test("① 旋钮的规矩没动：一条存好的线路都没有就不出现", () => {
  assert.match(app, /if \(!\(profiles \|\| \[\]\)\.length\) return null;/, "旋钮的出现条件被改了");
});

test("② 开着却没存线路时，开关底下说清楚为什么看不见", () => {
  assert.match(scr, /modelFloatOn && !\(profiles \|\| \[\]\)\.length/, "没按【存好的线路】判断");
  assert.match(scr, /现在还没有存好的线路，所以浮窗还不会出来/, "没把原因说出来");
});

test("③ 判断用的是存好的那份，不是页面上那张空白草稿", () => {
  // ApiConfig 里 profiles 是 App 那头存好的；list 是页面自己的草稿（会被预先塞一张空白卡）
  assert.match(scr, /const \[list, setList\] = useState\(profiles\.length \? profiles : \[\{/,
    "空白草稿卡那一处变了，这条提示的前提要重新核");
  const i = scr.indexOf("现在还没有存好的线路");
  assert.ok(!/!\(list \|\| \[\]\)\.length/.test(scr.slice(i - 300, i)), "拿草稿判断了——草稿永远至少有一张，提示永远不会出现");
});

// 位置是 x_ 键，会跟着云同步跑到别的设备上——高屏幕上拖到底下，
//   同步到矮屏幕就落在屏幕外面。拖完那一刻夹过一次不够，画的时候要再按当前屏幕夹。
test("④ 旋钮位置每次画都按【这块屏幕】夹一次，不会落到屏幕外", () => {
  assert.match(app, /top: pos \? Math\.min\(Math\.max\(pos\.top, 70\), Math\.max\(70, \(window\.innerHeight \|\| 800\) - 130\)\) : "42%"/,
    "画的时候没再夹一次——换设备同步过来的位置可能在屏幕外");
});
